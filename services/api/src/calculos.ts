import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { calcularLiquidacion, datosLiquidacionSchema, type InformeCalculo } from "@cl/calc";
import type { BaseDatos } from "./bd";
import type { Guardia } from "./autenticacion";
import { errorValidacion } from "./errores";
import { nuevoId } from "./seguridad";

/** Se incrementa cuando cambian reglas o fórmulas, para saber con qué motor se produjo cada informe guardado. */
export const VERSION_MOTOR = "liquidacion-1.0.0";

const solicitudSchema = z.object({
  datos: datosLiquidacionSchema,
  expedienteId: z.string().uuid().optional(),
  guardar: z.boolean().default(false),
});

interface FilaCalculo {
  id: string;
  expediente_id: string | null;
  version_motor: string;
  datos: unknown;
  informe: InformeCalculo;
  creado_en: Date;
}

const aRespuesta = (f: FilaCalculo) => ({
  id: f.id,
  expedienteId: f.expediente_id,
  versionMotor: f.version_motor,
  datos: f.datos,
  informe: f.informe,
  creadoEn: new Date(f.creado_en).toISOString(),
});

export function rutasCalculos(app: FastifyInstance, bd: BaseDatos, exigirSesion: Guardia) {
  const opciones = { preHandler: exigirSesion };

  /** Calcula una liquidación. Si `guardar`, conserva datos e informe (nunca sobrescribe cálculos anteriores). */
  app.post("/calculos/liquidacion", opciones, async (req, rep) => {
    const r = solicitudSchema.safeParse(req.body);
    if (!r.success) return errorValidacion(rep, r.error);
    let informe: InformeCalculo;
    try {
      informe = calcularLiquidacion(r.data.datos);
    } catch (e) {
      return rep.code(400).send({ error: "calculo", mensaje: (e as Error).message });
    }
    if (!r.data.guardar) return { informe, versionMotor: VERSION_MOTOR, guardado: null };

    const usuarioId = req.usuario!.id;
    if (r.data.expedienteId) {
      const [exp] = await bd.consulta(
        "SELECT 1 FROM expedientes WHERE id = $1 AND usuario_id = $2 AND eliminado_en IS NULL",
        [r.data.expedienteId, usuarioId],
      );
      if (!exp) return rep.code(404).send({ error: "no_encontrado", mensaje: "Expediente no encontrado." });
    }
    const [f] = await bd.consulta<FilaCalculo>(
      `INSERT INTO calculos (id, usuario_id, expediente_id, tipo, version_motor, datos, informe)
       VALUES ($1, $2, $3, 'liquidacion', $4, $5, $6)
       RETURNING id, expediente_id, version_motor, datos, informe, creado_en`,
      [nuevoId(), usuarioId, r.data.expedienteId ?? null, VERSION_MOTOR, JSON.stringify(r.data.datos), JSON.stringify(informe)],
    );
    return { informe, versionMotor: VERSION_MOTOR, guardado: aRespuesta(f!) };
  });

  app.get<{ Params: { id: string } }>("/expedientes/:id/calculos", opciones, async (req, rep) => {
    const [exp] = await bd.consulta("SELECT 1 FROM expedientes WHERE id = $1 AND usuario_id = $2", [req.params.id, req.usuario!.id]);
    if (!exp) return rep.code(404).send({ error: "no_encontrado", mensaje: "Expediente no encontrado." });
    const filas = await bd.consulta<FilaCalculo>(
      `SELECT id, expediente_id, version_motor, datos, informe, creado_en FROM calculos
        WHERE expediente_id = $1 AND usuario_id = $2 ORDER BY creado_en DESC`,
      [req.params.id, req.usuario!.id],
    );
    return filas.map(aRespuesta);
  });
}
