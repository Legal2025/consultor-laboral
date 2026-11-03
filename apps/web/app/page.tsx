"use client";

import Link from "next/link";
import { MODULOS } from "@cl/shared";
import { Marco, rutaModulo } from "@/componentes/Marco";

export default function Panel() {
  return (
    <Marco>
      <h1>Panel</h1>
      <p className="meta">
        Seleccione un apartado. Los marcados con «Fase» están en construcción y no ofrecen todavía resultados jurídicos.
      </p>
      <div className="rejilla">
        {MODULOS.map((m) => (
          <Link key={m.slug} href={rutaModulo(m)} className="tarjeta">
            <h3>
              {m.numero}. {m.titulo}
            </h3>
            <p>{m.descripcion}</p>
            {m.estado === "en_construccion" && (
              <p className="meta" style={{ marginTop: "0.5rem" }}>
                En construcción · Fase {m.fase}
              </p>
            )}
          </Link>
        ))}
      </div>
    </Marco>
  );
}
