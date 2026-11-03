import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ingresoSchema, registroSchema, type SesionActiva } from "@cl/shared";
import type { BaseDatos } from "./bd";
import { hashToken, hashearClave, nuevoId, nuevoToken, verificarClave } from "./seguridad";
import { errorValidacion } from "./errores";

export interface UsuarioAutenticado {
  id: string;
  correo: string;
  nombre: string;
  sesionId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    usuario?: UsuarioAutenticado;
  }
}

interface FilaSesion {
  sesion_id: string;
  usuario_id: string;
  correo: string;
  nombre: string;
}

export type Guardia = (req: FastifyRequest, rep: FastifyReply) => Promise<unknown>;

export function extraerToken(req: FastifyRequest): string | undefined {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7).trim() || undefined;
  return undefined;
}

export function crearGuardia(bd: BaseDatos): Guardia {
  return async function exigirSesion(req, rep) {
    const token = extraerToken(req);
    if (!token) return rep.code(401).send({ error: "no_autenticado", mensaje: "Debe iniciar sesión." });
    const filas = await bd.consulta<FilaSesion>(
      `SELECT s.id AS sesion_id, u.id AS usuario_id, u.correo, u.nombre
         FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.hash_token = $1 AND s.revocada_en IS NULL AND s.expira_en > now()`,
      [hashToken(token)],
    );
    const f = filas[0];
    if (!f) return rep.code(401).send({ error: "sesion_invalida", mensaje: "La sesión expiró o fue cerrada." });
    await bd.consulta("UPDATE sesiones SET ultimo_uso = now() WHERE id = $1", [f.sesion_id]);
    req.usuario = { id: f.usuario_id, correo: f.correo, nombre: f.nombre, sesionId: f.sesion_id };
  };
}

async function abrirSesion(bd: BaseDatos, usuarioId: string, dispositivo: string, dias: number) {
  const { token, hash } = nuevoToken();
  await bd.consulta(
    `INSERT INTO sesiones (id, usuario_id, hash_token, dispositivo, expira_en)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5::int))`,
    [nuevoId(), usuarioId, hash, dispositivo, dias],
  );
  return token;
}

export function rutasAutenticacion(app: FastifyInstance, bd: BaseDatos, duracionSesionDias: number): Guardia {
  const exigirSesion = crearGuardia(bd);
  const dispositivoDe = (req: FastifyRequest, indicado?: string) =>
    (indicado || String(req.headers["user-agent"] ?? "Dispositivo desconocido")).slice(0, 120);

  app.post("/auth/registro", async (req, rep) => {
    const r = registroSchema.safeParse(req.body);
    if (!r.success) return errorValidacion(rep, r.error);
    const existe = await bd.consulta("SELECT 1 FROM usuarios WHERE correo = $1", [r.data.correo]);
    if (existe.length) return rep.code(409).send({ error: "correo_registrado", mensaje: "Ese correo ya tiene una cuenta." });
    const id = nuevoId();
    await bd.consulta("INSERT INTO usuarios (id, correo, nombre, hash_clave) VALUES ($1, $2, $3, $4)", [
      id,
      r.data.correo,
      r.data.nombre,
      await hashearClave(r.data.contrasena),
    ]);
    await bd.consulta("INSERT INTO auditoria (usuario_id, accion) VALUES ($1, 'registro')", [id]);
    const token = await abrirSesion(bd, id, dispositivoDe(req, r.data.dispositivo), duracionSesionDias);
    return rep.code(201).send({ token, usuario: { id, correo: r.data.correo, nombre: r.data.nombre } });
  });

  app.post("/auth/ingreso", async (req, rep) => {
    const r = ingresoSchema.safeParse(req.body);
    if (!r.success) return errorValidacion(rep, r.error);
    const [u] = await bd.consulta<{ id: string; nombre: string; hash_clave: string }>(
      "SELECT id, nombre, hash_clave FROM usuarios WHERE correo = $1",
      [r.data.correo],
    );
    // Mismo mensaje para correo inexistente y contraseña errónea.
    if (!u || !(await verificarClave(r.data.contrasena, u.hash_clave))) {
      return rep.code(401).send({ error: "credenciales", mensaje: "Correo o contraseña incorrectos." });
    }
    const token = await abrirSesion(bd, u.id, dispositivoDe(req, r.data.dispositivo), duracionSesionDias);
    await bd.consulta("INSERT INTO auditoria (usuario_id, accion) VALUES ($1, 'ingreso')", [u.id]);
    return { token, usuario: { id: u.id, correo: r.data.correo, nombre: u.nombre } };
  });

  app.get("/auth/yo", { preHandler: exigirSesion }, async (req) => {
    const u = req.usuario!;
    return { id: u.id, correo: u.correo, nombre: u.nombre };
  });

  app.post("/auth/salida", { preHandler: exigirSesion }, async (req) => {
    await bd.consulta("UPDATE sesiones SET revocada_en = now() WHERE id = $1", [req.usuario!.sesionId]);
    return { ok: true };
  });

  app.get("/auth/sesiones", { preHandler: exigirSesion }, async (req): Promise<SesionActiva[]> => {
    const filas = await bd.consulta<{ id: string; dispositivo: string; creada_en: Date; ultimo_uso: Date }>(
      `SELECT id, dispositivo, creada_en, ultimo_uso FROM sesiones
        WHERE usuario_id = $1 AND revocada_en IS NULL AND expira_en > now()
        ORDER BY ultimo_uso DESC`,
      [req.usuario!.id],
    );
    return filas.map((f) => ({
      id: f.id,
      dispositivo: f.dispositivo,
      creadaEn: new Date(f.creada_en).toISOString(),
      ultimoUso: new Date(f.ultimo_uso).toISOString(),
      actual: f.id === req.usuario!.sesionId,
    }));
  });

  /** Cierra todas las sesiones del usuario salvo la actual. */
  app.post("/auth/sesiones/cerrar-otras", { preHandler: exigirSesion }, async (req) => {
    const filas = await bd.consulta(
      `UPDATE sesiones SET revocada_en = now()
        WHERE usuario_id = $1 AND id <> $2 AND revocada_en IS NULL RETURNING id`,
      [req.usuario!.id, req.usuario!.sesionId],
    );
    await bd.consulta("INSERT INTO auditoria (usuario_id, accion) VALUES ($1, 'cerrar_otras_sesiones')", [req.usuario!.id]);
    return { cerradas: filas.length };
  });

  return exigirSesion;
}
