import { z } from "zod";

export const PERSPECTIVAS = ["trabajador", "empresarial", "neutral"] as const;
export type Perspectiva = (typeof PERSPECTIVAS)[number];

export const registroSchema = z.object({
  correo: z.string().trim().toLowerCase().email("Correo no válido"),
  nombre: z.string().trim().min(2, "Indique un nombre").max(120),
  contrasena: z.string().min(10, "La contraseña debe tener al menos 10 caracteres").max(200),
  dispositivo: z.string().trim().max(120).optional(),
});
export type Registro = z.infer<typeof registroSchema>;

export const ingresoSchema = z.object({
  correo: z.string().trim().toLowerCase().email("Correo no válido"),
  contrasena: z.string().min(1, "Indique la contraseña"),
  dispositivo: z.string().trim().max(120).optional(),
});
export type Ingreso = z.infer<typeof ingresoSchema>;

/** Contenido editable de un expediente. Los hechos se separan según su respaldo. */
export const contenidoExpedienteSchema = z.object({
  titulo: z.string().trim().min(3, "Indique un título").max(200),
  cliente: z.string().trim().max(200).default(""),
  contraparte: z.string().trim().max(200).default(""),
  perspectiva: z.enum(PERSPECTIVAS).default("neutral"),
  hechosDeclarados: z.string().max(50_000).default(""),
  hechosDocumentados: z.string().max(50_000).default(""),
  notas: z.string().max(50_000).default(""),
});
export type ContenidoExpediente = z.infer<typeof contenidoExpedienteSchema>;

export const actualizarExpedienteSchema = z.object({
  /** Versión sobre la que el cliente hizo los cambios; si no coincide, el servidor responde 409. */
  version: z.number().int().positive(),
  contenido: contenidoExpedienteSchema,
});

export interface Expediente extends ContenidoExpediente {
  id: string;
  version: number;
  creadoEn: string;
  actualizadoEn: string;
  eliminadoEn: string | null;
}

export interface VersionExpediente {
  version: number;
  contenido: ContenidoExpediente;
  creadoEn: string;
  autor: string;
}

export interface SesionActiva {
  id: string;
  dispositivo: string;
  creadaEn: string;
  ultimoUso: string;
  actual: boolean;
}
