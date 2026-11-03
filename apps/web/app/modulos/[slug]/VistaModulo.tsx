"use client";

import { moduloPorSlug } from "@cl/shared";
import { Marco } from "@/componentes/Marco";

/** Vista de un apartado aún no operativo: no simula resultados ni formularios sin función. */
export function VistaModulo({ slug }: { slug: string }) {
  const m = moduloPorSlug(slug)!;
  return (
    <Marco>
      <h1>
        {m.numero}. {m.titulo}
      </h1>
      <p>{m.descripcion}</p>
      <div className="aviso" role="note">
        <strong>En construcción (Fase {m.fase}).</strong> Este apartado todavía no está operativo. No se muestran resultados,
        fuentes ni cálculos hasta que la función esté implementada y probada.
      </div>
    </Marco>
  );
}
