/**
 * Catálogo de los doce apartados de la aplicación.
 * `fase` indica la fase del plan en que el módulo pasa a ser operativo;
 * la interfaz no debe presentar como funcional un módulo cuya fase no se ha completado.
 */
export type EstadoModulo = "operativo" | "en_construccion";

export interface Modulo {
  slug: string;
  numero: number;
  titulo: string;
  descripcion: string;
  fase: number;
  estado: EstadoModulo;
}

export const MODULOS: readonly Modulo[] = [
  { slug: "asistente", numero: 1, titulo: "Asistente jurídico laboral", descripcion: "Consulta investigada sobre un caso concreto, con fuentes verificadas y datos pendientes.", fase: 3, estado: "en_construccion" },
  { slug: "robot", numero: 2, titulo: "Robot IA para consultas rápidas", descripcion: "Respuesta breve con investigación acotada, disponible desde todos los módulos.", fase: 3, estado: "en_construccion" },
  { slug: "leyes", numero: 3, titulo: "Leyes y SCIJ", descripcion: "Normativa oficial, versiones históricas, reformas y vigencia.", fase: 3, estado: "en_construccion" },
  { slug: "jurisprudencia", numero: 4, titulo: "Jurisprudencia y criterios del MTSS", descripcion: "Resoluciones de la Sala Segunda y Sala Constitucional; criterios administrativos del MTSS.", fase: 3, estado: "en_construccion" },
  { slug: "doctrina", numero: 5, titulo: "Doctrina nacional e internacional", descripcion: "Biblioteca doctrinal por temas, con distinción entre bibliografía localizada y leída.", fase: 3, estado: "en_construccion" },
  { slug: "calculadora", numero: 6, titulo: "Calculadora laboral y salarios mínimos", descripcion: "Liquidación por modalidad de salida con fórmula por rubro y escenarios. Extras, feriados, diferencias y mínimos: en construcción.", fase: 1, estado: "operativo" },
  { slug: "seguridad-privada", numero: 7, titulo: "Seguridad privada", descripcion: "Habilitaciones, acreditaciones, operación, disciplina y régimen laboral del sector.", fase: 3, estado: "en_construccion" },
  { slug: "documentos", numero: 8, titulo: "Análisis de documentos", descripcion: "Informe de análisis documental asistido por IA, con OCR y revisión de datos extraídos.", fase: 4, estado: "en_construccion" },
  { slug: "redactor", numero: 9, titulo: "Redactor de documentos jurídicos", descripcion: "Borradores individualizados con control de datos esenciales faltantes.", fase: 4, estado: "en_construccion" },
  { slug: "expedientes", numero: 10, titulo: "Historial y expedientes", descripcion: "Expedientes con versiones, papelera y recuperación.", fase: 0, estado: "operativo" },
  { slug: "biblioteca", numero: 11, titulo: "Favoritos y biblioteca personal", descripcion: "Artículos, resoluciones, criterios, doctrina y notas propias.", fase: 6, estado: "en_construccion" },
  { slug: "configuracion", numero: 12, titulo: "Configuración, privacidad y consumo", descripcion: "Sesiones abiertas, estado de servicios, privacidad y consumo.", fase: 0, estado: "operativo" },
] as const;

export function moduloPorSlug(slug: string): Modulo | undefined {
  return MODULOS.find((m) => m.slug === slug);
}
