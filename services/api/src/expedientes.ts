import type { FastifyInstance } from "fastify";
import {
  actualizarExpedienteSchema,
  contenidoExpedienteSchema,
  type ContenidoExpediente,
  type Expediente,
  type VersionExpediente,
} from "@cl/shared";
import type { BaseDatos } from "./bd";
import type { Guardia } from "./autenticacion";
import { errorValidacion } from "./errores";
import { nuevoId } from "./seguridad";

interface FilaExpediente {
  id: string;
  version: number;
  contenido: ContenidoExpediente;
  creado_en: Date;
  actualizado_en: Date;
  eliminado_en: Date | null;
}

const iso = (d: Date | string) => new Date(d).toISOString();

function aExpediente(f: FilaExpediente): Expediente {
  return {
    ...f.contenido,
    id: f.id,
    version: f.version,
    creadoEn: iso(f.creado_en),
    actualizadoEn: iso(f.actualizado_en),
    eliminadoEn: f.eliminado_en ? iso(f.eliminado_en) : null,
  };
}

const COLUMNAS = "id, version, contenido, creado_en, actualizado_en, eliminado_en";

/**
 * Expedientes del usuario autenticado.
 * - Cada cambio crea una versión nueva; las anteriores se conservan.
 * - Una actualización debe indicar la versión sobre la que se editó: si otro dispositivo
 *   guardó antes, se responde 409 con la versión vigente y no se sobrescribe nada.
 * - La eliminación es recuperable (papelera).
 */
export function rutasExpedientes(app: FastifyInstance, bd: BaseDatos, exigirSesion: Guardia) {
  const opciones = { preHandler: exigirSesion };

  async function buscar(id: string, usuarioId: string) {
    const [f] = await bd.consulta<FilaExpediente>(
      `SELECT ${COLUMNAS} FROM expedientes WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId],
    );
    return f;
  }

  app.get<{ Querystring: { papelera?: string } }>("/expedientes", opciones, async (req) => {
    const papelera = req.query.papelera === "1";
    const filas = await bd.consulta<FilaExpediente>(
      `SELECT ${COLUMNAS} FROM expedientes
        WHERE usuario_id = $1 AND (eliminado_en IS ${papelera ? "NOT " : ""}NULL)
        ORDER BY actualizado_en DESC`,
      [req.usuario!.id],
    );
    return filas.map(aExpediente);
  });

  app.post("/expedientes", opciones, async (req, rep) => {
    const r = contenidoExpedienteSchema.safeParse(req.body);
    if (!r.success) return errorValidacion(rep, r.error);
    const id = nuevoId();
    const usuarioId = req.usuario!.id;
    const fila = await bd.transaccion(async (tx) => {
      const [f] = await tx.consulta<FilaExpediente>(
        `INSERT INTO expedientes (id, usuario_id, version, contenido) VALUES ($1, $2, 1, $3)
         RETURNING ${COLUMNAS}`,
        [id, usuarioId, JSON.stringify(r.data)],
      );
      await tx.consulta(
        "INSERT INTO expediente_versiones (expediente_id, version, contenido, autor_id) VALUES ($1, 1, $2, $3)",
        [id, JSON.stringify(r.data), usuarioId],
      );
      return f!;
    });
    return rep.code(201).send(aExpediente(fila));
  });

  app.get<{ Params: { id: string } }>("/expedientes/:id", opciones, async (req, rep) => {
    const f = await buscar(req.params.id, req.usuario!.id);
    if (!f) return rep.code(404).send({ error: "no_encontrado", mensaje: "Expediente no encontrado." });
    return aExpediente(f);
  });

  app.put<{ Params: { id: string } }>("/expedientes/:id", opciones, async (req, rep) => {
    const r = actualizarExpedienteSchema.safeParse(req.body);
    if (!r.success) return errorValidacion(rep, r.error);
    const usuarioId = req.usuario!.id;
    const resultado = await bd.transaccion(async (tx) => {
      const [actual] = await tx.consulta<FilaExpediente>(
        `SELECT ${COLUMNAS} FROM expedientes WHERE id = $1 AND usuario_id = $2 FOR UPDATE`,
        [req.params.id, usuarioId],
      );
      if (!actual) return { tipo: "no_encontrado" as const };
      if (actual.eliminado_en) return { tipo: "eliminado" as const };
      if (actual.version !== r.data.version) return { tipo: "conflicto" as const, actual };
      const nueva = actual.version + 1;
      const [f] = await tx.consulta<FilaExpediente>(
        `UPDATE expedientes SET version = $1, contenido = $2, actualizado_en = now()
          WHERE id = $3 RETURNING ${COLUMNAS}`,
        [nueva, JSON.stringify(r.data.contenido), req.params.id],
      );
      await tx.consulta(
        "INSERT INTO expediente_versiones (expediente_id, version, contenido, autor_id) VALUES ($1, $2, $3, $4)",
        [req.params.id, nueva, JSON.stringify(r.data.contenido), usuarioId],
      );
      return { tipo: "ok" as const, fila: f! };
    });
    switch (resultado.tipo) {
      case "no_encontrado":
        return rep.code(404).send({ error: "no_encontrado", mensaje: "Expediente no encontrado." });
      case "eliminado":
        return rep.code(409).send({ error: "en_papelera", mensaje: "El expediente está en la papelera; restáurelo antes de editarlo." });
      case "conflicto":
        return rep.code(409).send({
          error: "conflicto_version",
          mensaje: "El expediente fue modificado desde otro dispositivo. Revise la versión vigente antes de guardar.",
          vigente: aExpediente(resultado.actual),
        });
      case "ok":
        return aExpediente(resultado.fila);
    }
  });

  app.get<{ Params: { id: string } }>("/expedientes/:id/versiones", opciones, async (req, rep) => {
    const f = await buscar(req.params.id, req.usuario!.id);
    if (!f) return rep.code(404).send({ error: "no_encontrado", mensaje: "Expediente no encontrado." });
    const filas = await bd.consulta<{ version: number; contenido: ContenidoExpediente; creado_en: Date; nombre: string }>(
      `SELECT v.version, v.contenido, v.creado_en, u.nombre
         FROM expediente_versiones v JOIN usuarios u ON u.id = v.autor_id
        WHERE v.expediente_id = $1 ORDER BY v.version DESC`,
      [req.params.id],
    );
    return filas.map<VersionExpediente>((v) => ({
      version: v.version,
      contenido: v.contenido,
      creadoEn: iso(v.creado_en),
      autor: v.nombre,
    }));
  });

  app.delete<{ Params: { id: string } }>("/expedientes/:id", opciones, async (req, rep) => {
    const filas = await bd.consulta(
      "UPDATE expedientes SET eliminado_en = now() WHERE id = $1 AND usuario_id = $2 AND eliminado_en IS NULL RETURNING id",
      [req.params.id, req.usuario!.id],
    );
    if (!filas.length) return rep.code(404).send({ error: "no_encontrado", mensaje: "Expediente no encontrado o ya en papelera." });
    await bd.consulta("INSERT INTO auditoria (usuario_id, accion, objeto) VALUES ($1, 'expediente_a_papelera', $2)", [
      req.usuario!.id,
      req.params.id,
    ]);
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/expedientes/:id/restaurar", opciones, async (req, rep) => {
    const [f] = await bd.consulta<FilaExpediente>(
      `UPDATE expedientes SET eliminado_en = NULL WHERE id = $1 AND usuario_id = $2 AND eliminado_en IS NOT NULL
       RETURNING ${COLUMNAS}`,
      [req.params.id, req.usuario!.id],
    );
    if (!f) return rep.code(404).send({ error: "no_encontrado", mensaje: "No hay un expediente en papelera con ese identificador." });
    return aExpediente(f);
  });
}
