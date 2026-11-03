"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComponenteSalud, InformeSalud, SesionActiva } from "@cl/shared";
import { Marco } from "@/componentes/Marco";
import { api, ErrorApi } from "@/lib/api";

const fecha = (iso: string) => new Date(iso).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" });
const NOMBRES: Record<keyof InformeSalud, string> = {
  servidor: "Servidor",
  baseDatos: "Base de datos",
  ia: "Servicio de IA",
  busqueda: "Búsqueda y lectura web",
  fuentes: "Acceso a fuentes jurídicas",
};
const ESTADOS: Record<ComponenteSalud["estado"], string> = {
  operativo: "Operativo",
  fallo: "Fallo",
  no_configurado: "No configurado",
};

export default function Configuracion() {
  const [salud, setSalud] = useState<InformeSalud | null>(null);
  const [errorSalud, setErrorSalud] = useState<string | null>(null);
  const [sesiones, setSesiones] = useState<SesionActiva[] | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const comprobar = useCallback(() => {
    setErrorSalud(null);
    api<InformeSalud>("/salud").then(setSalud).catch((e: ErrorApi) => setErrorSalud(e.message));
  }, []);
  const cargarSesiones = useCallback(() => {
    api<SesionActiva[]>("/auth/sesiones").then(setSesiones).catch((e: ErrorApi) => setMensaje(e.message));
  }, []);

  useEffect(() => {
    comprobar();
    cargarSesiones();
  }, [comprobar, cargarSesiones]);

  async function cerrarOtras() {
    if (!confirm("¿Cerrar la sesión en todos los demás dispositivos?")) return;
    try {
      const r = await api<{ cerradas: number }>("/auth/sesiones/cerrar-otras", { metodo: "POST" });
      setMensaje(`Se cerraron ${r.cerradas} sesiones.`);
      cargarSesiones();
    } catch (e) {
      setMensaje((e as ErrorApi).message);
    }
  }

  return (
    <Marco>
      <h1>Configuración, privacidad y consumo</h1>

      <h2>Estado de los servicios</h2>
      <p className="meta">Cada componente se comprueba por separado. Un servicio no integrado se muestra como «No configurado».</p>
      {errorSalud && (
        <p className="error" role="alert">
          {errorSalud}
        </p>
      )}
      {salud && (
        <ul className="lista">
          {(Object.keys(NOMBRES) as (keyof InformeSalud)[]).map((k) => (
            <li key={k} className="tarjeta">
              <strong>{NOMBRES[k]}:</strong> {ESTADOS[salud[k].estado]}
              <div className="meta">
                {salud[k].detalle} Comprobado: {fecha(salud[k].comprobadoEn)}
              </div>
            </li>
          ))}
        </ul>
      )}
      <button className="secundario" onClick={comprobar}>
        Comprobar de nuevo
      </button>

      <h2>Sesiones abiertas</h2>
      {mensaje && <p className="meta" role="status">{mensaje}</p>}
      <ul className="lista">
        {sesiones?.map((s) => (
          <li key={s.id} className="tarjeta">
            <strong>{s.dispositivo}</strong> {s.actual && <span className="etiqueta">Este dispositivo</span>}
            <div className="meta">
              Inicio {fecha(s.creadaEn)} · último uso {fecha(s.ultimoUso)}
            </div>
          </li>
        ))}
      </ul>
      <button onClick={cerrarOtras} disabled={!sesiones || sesiones.length < 2}>
        Cerrar sesión en los demás dispositivos
      </button>

      <h2>Consumo</h2>
      <p className="meta">
        El seguimiento de consumo de IA, búsquedas, OCR y voz se habilita cuando esos servicios se integren (fases 3 a 5). Hoy no se
        consume ningún servicio de pago.
      </p>
    </Marco>
  );
}
