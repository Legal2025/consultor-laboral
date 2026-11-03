/**
 * Estado de cada componente, comprobado por separado.
 * "no_configurado": falta la credencial o el servicio no se ha integrado todavía.
 * No se informa "operativo" para un servicio que no se haya comprobado efectivamente.
 */
export type EstadoComponente = "operativo" | "fallo" | "no_configurado";

export interface ComponenteSalud {
  estado: EstadoComponente;
  detalle: string;
  comprobadoEn: string;
}

export interface InformeSalud {
  servidor: ComponenteSalud;
  baseDatos: ComponenteSalud;
  ia: ComponenteSalud;
  busqueda: ComponenteSalud;
  fuentes: ComponenteSalud;
}
