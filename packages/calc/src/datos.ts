import { z } from "zod";

export const MODALIDADES = [
  "renuncia",
  "terminacion_trabajador_con_responsabilidad",
  "despido_con_responsabilidad",
  "despido_sin_responsabilidad",
  "pension",
  "mutuo_acuerdo",
  "vencimiento_plazo",
  "conclusion_obra",
  "otra",
] as const;
export type Modalidad = (typeof MODALIDADES)[number];

export const ETIQUETA_MODALIDAD: Record<Modalidad, string> = {
  renuncia: "Renuncia voluntaria",
  terminacion_trabajador_con_responsabilidad: "Terminación por el trabajador con responsabilidad patronal",
  despido_con_responsabilidad: "Despido con responsabilidad patronal",
  despido_sin_responsabilidad: "Despido sin responsabilidad patronal",
  pension: "Terminación relacionada con pensión o jubilación",
  mutuo_acuerdo: "Mutuo acuerdo",
  vencimiento_plazo: "Vencimiento de plazo",
  conclusion_obra: "Conclusión de obra",
  otra: "Otra",
};

export const RUBROS = ["preaviso", "cesantia", "aguinaldo", "vacaciones", "salarios_pendientes"] as const;
export type Rubro = (typeof RUBROS)[number];

export const ETIQUETA_RUBRO: Record<Rubro, string> = {
  preaviso: "Preaviso",
  cesantia: "Auxilio de cesantía",
  aguinaldo: "Aguinaldo proporcional",
  vacaciones: "Vacaciones no disfrutadas",
  salarios_pendientes: "Salarios pendientes",
};

const FUENTES_DATO = ["declarado", "documentado"] as const;
const monto = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Monto en colones, sin separadores de miles (use punto decimal)");
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha AAAA-MM-DD");

export const datosLiquidacionSchema = z
  .object({
    fechaIngreso: fecha,
    /** Último día efectivamente laborado o, si el preaviso se pagó, último día de la relación. */
    fechaTerminacion: fecha,
    modalidad: z.enum(MODALIDADES),
    /** Modalidad que sostiene la otra parte, si está controvertida: se calcula como escenario. */
    modalidadAlternativa: z.enum(MODALIDADES).optional(),
    /** Remuneraciones mensuales computables (ordinarias y extraordinarias) por periodo AAAA-MM. */
    salarios: z
      .array(
        z.object({
          periodo: z.string().regex(/^\d{4}-\d{2}$/, "Periodo AAAA-MM"),
          monto,
          fuente: z.enum(FUENTES_DATO).default("declarado"),
        }),
      )
      .min(1, "Indique al menos un mes de salario"),
    preaviso: z
      .object({
        /** Días de preaviso que el trabajador efectivamente laboró después de recibir la comunicación escrita. */
        diasOtorgados: z.number().min(0).default(0),
      })
      .default({ diasOtorgados: 0 }),
    vacaciones: z
      .object({
        /** Si se indica, sustituye el cómputo automático de días generados. */
        diasGenerados: z.number().min(0).optional(),
        diasDisfrutados: z.number().min(0).default(0),
      })
      .default({ diasDisfrutados: 0 }),
    salariosPendientes: monto.optional(),
    pagos: z
      .array(
        z.object({
          concepto: z.enum([...RUBROS, "sin_imputar"]),
          monto,
          fecha: fecha.optional(),
          comprobante: z.string().max(200).optional(),
          /** Pago cuya existencia o imputación está controvertida: se calculan escenarios con y sin él. */
          discutido: z.boolean().default(false),
        }),
      )
      .default([]),
    opciones: z
      .object({
        divisorDiario: z.number().int().min(1).max(31).default(30),
        cesantiaFraccion: z.enum(["literal", "proporcional"]).default("literal"),
      })
      .default({ divisorDiario: 30, cesantiaFraccion: "literal" }),
  })
  .refine((d) => !d.modalidadAlternativa || d.modalidadAlternativa !== d.modalidad, {
    message: "La modalidad alternativa debe ser distinta de la principal",
    path: ["modalidadAlternativa"],
  });

export type DatosLiquidacion = z.input<typeof datosLiquidacionSchema>;
export type DatosLiquidacionValidados = z.output<typeof datosLiquidacionSchema>;
