"use client";

import { useEffect, useState } from "react";
import type { InformeSalud } from "@cl/shared";
import { api, ErrorApi } from "@/lib/api";

/**
 * Comprueba por separado: conexión del dispositivo y disponibilidad del servidor.
 * El detalle de IA, búsqueda y fuentes se muestra en Configuración.
 */
export function EstadoConexion() {
  const [enLinea, setEnLinea] = useState(true);
  const [servidor, setServidor] = useState<"comprobando" | "disponible" | "no_disponible">("comprobando");

  useEffect(() => {
    const actualizar = () => setEnLinea(navigator.onLine);
    actualizar();
    window.addEventListener("online", actualizar);
    window.addEventListener("offline", actualizar);
    let activo = true;
    const comprobar = () =>
      api<InformeSalud>("/salud")
        .then(() => activo && setServidor("disponible"))
        .catch((e: ErrorApi) => activo && setServidor(e.sinConexion ? "no_disponible" : "disponible"));
    comprobar();
    const t = setInterval(comprobar, 60_000);
    return () => {
      activo = false;
      clearInterval(t);
      window.removeEventListener("online", actualizar);
      window.removeEventListener("offline", actualizar);
    };
  }, []);

  const texto = !enLinea
    ? "Sin conexión en el dispositivo"
    : servidor === "comprobando"
      ? "Comprobando servidor…"
      : servidor === "disponible"
        ? "Servidor disponible"
        : "Servidor no disponible";
  const clase = !enLinea || servidor === "no_disponible" ? "punto fallo" : servidor === "disponible" ? "punto ok" : "punto";

  return (
    <span className="estado-conexion" role="status" aria-live="polite">
      <span className={clase} aria-hidden="true" />
      {texto}
    </span>
  );
}
