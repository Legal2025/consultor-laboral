import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import type { BaseDatos } from "./bd";
import type { Configuracion } from "./configuracion";
import { rutasAutenticacion } from "./autenticacion";
import { rutasExpedientes } from "./expedientes";
import { rutasSalud } from "./salud";
import { rutasCalculos } from "./calculos";

export async function crearAplicacion(bd: BaseDatos, config: Configuracion, registro = false): Promise<FastifyInstance> {
  const app = Fastify({
    logger: registro
      ? {
          // Nunca registrar tokens ni cuerpos de solicitudes (pueden contener datos de expedientes).
          redact: ["req.headers.authorization"],
        }
      : false,
    bodyLimit: 2 * 1024 * 1024,
  });

  await app.register(cors, {
    origin: (origen, cb) => cb(null, !origen || config.origenesPermitidos.includes(origen)),
    methods: ["GET", "POST", "PUT", "DELETE"],
  });

  app.addHook("onSend", async (_req, rep, carga) => {
    rep.header("Cache-Control", "no-store");
    rep.header("X-Content-Type-Options", "nosniff");
    return carga;
  });

  rutasSalud(app, bd, config);
  const exigirSesion = rutasAutenticacion(app, bd, config.duracionSesionDias);
  rutasExpedientes(app, bd, exigirSesion);
  rutasCalculos(app, bd, exigirSesion);

  app.setErrorHandler((error: { statusCode?: number; message?: string }, _req, rep) => {
    app.log.error(error);
    const codigo = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
    return rep.code(codigo).send({
      error: codigo === 500 ? "error_interno" : "solicitud_invalida",
      mensaje: codigo === 500 ? "Error interno del servidor. Reintente; si persiste, informe el problema." : error.message,
    });
  });

  return app;
}
