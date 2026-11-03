import type { FastifyInstance } from "fastify";
import type { ComponenteSalud, InformeSalud } from "@cl/shared";
import type { BaseDatos } from "./bd";
import type { Configuracion } from "./configuracion";

const ahora = () => new Date().toISOString();
const componente = (estado: ComponenteSalud["estado"], detalle: string): ComponenteSalud => ({
  estado,
  detalle,
  comprobadoEn: ahora(),
});

/**
 * Comprobación separada de cada componente. En la Fase 0 la IA, la búsqueda y el acceso a
 * fuentes aún no están integrados: se informan como "no_configurado", nunca como operativos.
 */
export async function informeSalud(bd: BaseDatos, config: Configuracion): Promise<InformeSalud> {
  let baseDatos: ComponenteSalud;
  try {
    await bd.consulta("SELECT 1");
    baseDatos = componente("operativo", "La base de datos respondió a una consulta de prueba.");
  } catch (e) {
    baseDatos = componente("fallo", `La base de datos no respondió: ${(e as Error).message}`);
  }
  return {
    servidor: componente("operativo", "El servidor respondió."),
    baseDatos,
    ia: config.claveIa
      ? componente("no_configurado", "Hay credencial, pero la integración de IA se implementa en la Fase 3.")
      : componente("no_configurado", "Falta la credencial del servicio de IA."),
    busqueda: componente("no_configurado", "La búsqueda y lectura web se implementan en la Fase 3."),
    fuentes: componente("no_configurado", "El acceso a SCIJ, Nexus, MTSS y OIT se comprobará en la Fase 3."),
  };
}

export function rutasSalud(app: FastifyInstance, bd: BaseDatos, config: Configuracion) {
  app.get("/salud", async () => informeSalud(bd, config));
}
