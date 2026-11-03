import type { FastifyReply } from "fastify";
import type { ZodError } from "zod";

export function errorValidacion(rep: FastifyReply, error: ZodError) {
  return rep.code(400).send({
    error: "validacion",
    mensaje: "Datos incompletos o no válidos.",
    campos: error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })),
  });
}
