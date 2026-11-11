/**
 * Catálogo de reglas jurídicas que usa el motor de cálculo.
 *
 * Cada regla declara su fuente y su estado de verificación. Una regla "pendiente_verificacion"
 * puede usarse para una estimación, pero obliga a clasificar el informe como provisional:
 * nunca se presenta un resultado como cálculo completo si descansa en una regla no contrastada
 * con el texto oficial vigente.
 *
 * `sintesis` es una paráfrasis del contenido de la norma, no una cita textual.
 */
export type EstadoVerificacion = "verificada" | "pendiente_verificacion" | "interpretacion";

export interface Regla {
  id: string;
  norma: string;
  articulo: string;
  sintesis: string;
  estado: EstadoVerificacion;
  /** Fuente efectivamente consultada y fecha real de la consulta. */
  verificacion?: { fuente: string; url?: string; fecha: string; nota?: string };
}

const MTSS_PDF = {
  fuente: "Código de Trabajo, texto publicado por el Ministerio de Trabajo y Seguridad Social (incluye modificaciones de la Ley N° 9343)",
  url: "https://www.mtss.go.cr/elministerio/marco-legal/documentos/Codigo_Trabajo_RPL.pdf",
  fecha: "2026-11-11",
  nota: "Reproducción oficial del MTSS; SCIJ/SINALEVI no permitió lectura automatizada en esa fecha. Contrastar con SCIJ antes de cerrar la Fase 1.",
};

export const REGLAS = {
  preaviso: {
    id: "ct-28",
    norma: "Código de Trabajo",
    articulo: "28",
    sintesis:
      "En contratos por tiempo indefinido, la parte que lo termina sin justa causa debe dar preaviso escrito: una semana tras 3 a 6 meses de trabajo continuo; quince días tras más de 6 meses y hasta un año; un mes después de un año.",
    estado: "verificada",
    verificacion: MTSS_PDF,
  },
  cesantia: {
    id: "ct-29",
    norma: "Código de Trabajo",
    articulo: "29 (reformado por art. 88 inc. a) Ley N° 7983 de 16/02/2000)",
    sintesis:
      "Despido sin justa causa en contrato indefinido: 7 días de salario entre 3 y 6 meses; 14 días con más de 6 meses y menos de un año; con más de un año, los días de la tabla legal por año laborado o fracción superior a seis meses; tope de los últimos ocho años.",
    estado: "verificada",
    verificacion: MTSS_PDF,
  },
  promedioSeisMeses: {
    id: "ct-30",
    norma: "Código de Trabajo",
    articulo: "30",
    sintesis:
      "Preaviso y cesantía se calculan con el promedio de salarios de los últimos seis meses o fracción de tiempo menor; la continuidad no se interrumpe por enfermedad, vacaciones o huelga legal.",
    estado: "verificada",
    verificacion: MTSS_PDF,
  },
  plazoFijoAnticipado: {
    id: "ct-31",
    norma: "Código de Trabajo",
    articulo: "31 (dos últimos párrafos reformados por art. 88 inc. b) Ley N° 7983)",
    sintesis:
      "Terminación anticipada sin justa causa de contratos a plazo fijo u obra determinada: daños y perjuicios a probar; si la termina el patrono, además un día de salario por cada siete trabajados, nunca menos de tres; si el contrato es de seis meses o más, no menos de 22 días.",
    estado: "verificada",
    verificacion: MTSS_PDF,
  },
  responsabilidadPatronalPorTrabajador: {
    id: "ct-83",
    norma: "Código de Trabajo",
    articulo: "83",
    sintesis:
      "Causas justas por las que el trabajador puede terminar el contrato con responsabilidad patronal; efectos económicos equiparables al despido injustificado.",
    estado: "pendiente_verificacion",
  },
  pension: {
    id: "ct-85",
    norma: "Código de Trabajo",
    articulo: "85",
    sintesis:
      "Terminación sin responsabilidad para el trabajador por causas como muerte, obligaciones legales o acogerse a pensión, con efectos sobre la cesantía según el texto vigente.",
    estado: "pendiente_verificacion",
  },
  vacaciones: {
    id: "ct-153",
    norma: "Código de Trabajo",
    articulo: "153 y 156",
    sintesis:
      "Dos semanas de vacaciones remuneradas por cada cincuenta semanas de labores continuas; compensación en dinero de las no disfrutadas al terminar el contrato.",
    estado: "pendiente_verificacion",
  },
  vacacionesProporcionales: {
    id: "interp-vac-proporcional",
    norma: "Criterio de cómputo",
    articulo: "—",
    sintesis:
      "Cómputo proporcional de un día de vacaciones por cada mes completo laborado cuando no se completan cincuenta semanas; el usuario puede indicar otro número de días generados.",
    estado: "interpretacion",
  },
  aguinaldo: {
    id: "ley-2412",
    norma: "Ley de Aguinaldo para la Empresa Privada (N° 2412)",
    articulo: "1 a 3",
    sintesis:
      "Aguinaldo equivalente a la doceava parte de los salarios ordinarios y extraordinarios devengados del 1 de diciembre al 30 de noviembre; proporcional al terminar la relación.",
    estado: "pendiente_verificacion",
  },
  divisorDiario: {
    id: "interp-divisor-30",
    norma: "Criterio de conversión",
    articulo: "—",
    sintesis: "Salario diario = salario mensual promedio ÷ 30. Configurable en los datos del cálculo.",
    estado: "interpretacion",
  },
  cesantiaFraccion: {
    id: "interp-cesantia-fraccion",
    norma: "Criterio de cómputo",
    articulo: "29",
    sintesis:
      "Lectura literal: con más de un año, la fracción de seis meses o menos no genera días adicionales; los días por año se toman de la fila de la tabla correspondiente a la antigüedad computable. Alternativa configurable: fracción proporcional.",
    estado: "interpretacion",
  },
} as const satisfies Record<string, Regla>;

export type ClaveRegla = keyof typeof REGLAS;

/** Tabla del artículo 29 inciso 3): días de salario por año, según el año de la relación. */
export const TABLA_CESANTIA: readonly { año: number; dias: string }[] = [
  { año: 1, dias: "19.5" },
  { año: 2, dias: "20" },
  { año: 3, dias: "20.5" },
  { año: 4, dias: "21" },
  { año: 5, dias: "21.24" },
  { año: 6, dias: "21.5" },
  { año: 7, dias: "22" },
  { año: 8, dias: "22" },
  { año: 9, dias: "22" },
  { año: 10, dias: "21.5" },
  { año: 11, dias: "21" },
  { año: 12, dias: "20.5" },
  { año: 13, dias: "20" },
];

export function diasCesantiaPorAño(añoComputable: number): string {
  if (añoComputable < 1) return "0";
  const fila = TABLA_CESANTIA.find((f) => f.año === Math.min(añoComputable, 13));
  return fila!.dias;
}
