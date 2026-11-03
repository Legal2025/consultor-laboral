"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Marco } from "@/componentes/Marco";
import { EditorExpediente } from "./EditorExpediente";

function Contenido() {
  const id = useSearchParams().get("id");
  return id ? <EditorExpediente id={id} /> : <p>Falta el identificador del expediente.</p>;
}

export default function VerExpediente() {
  return (
    <Marco>
      <Suspense fallback={<p className="meta">Cargando…</p>}>
        <Contenido />
      </Suspense>
    </Marco>
  );
}
