"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Expediente } from "@cl/shared";
import { Marco } from "@/componentes/Marco";
import { api, ErrorApi } from "@/lib/api";

const fecha = (iso: string) => new Date(iso).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" });

export default function Expedientes() {
  const router = useRouter();
  const [papelera, setPapelera] = useState(false);
  const [lista, setLista] = useState<Expediente[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");

  const cargar = useCallback(() => {
    setError(null);
    api<Expediente[]>(`/expedientes${papelera ? "?papelera=1" : ""}`)
      .then(setLista)
      .catch((e: ErrorApi) => setError(e.message));
  }, [papelera]);

  useEffect(cargar, [cargar]);

  async function crear(e: FormEvent) {
    e.preventDefault();
    try {
      const nuevo = await api<Expediente>("/expedientes", { metodo: "POST", cuerpo: { titulo } });
      router.push(`/expedientes/ver/?id=${nuevo.id}`);
    } catch (err) {
      setError((err as ErrorApi).message);
    }
  }

  async function restaurar(id: string) {
    try {
      await api(`/expedientes/${id}/restaurar`, { metodo: "POST" });
      cargar();
    } catch (err) {
      setError((err as ErrorApi).message);
    }
  }

  return (
    <Marco>
      <h1>Historial y expedientes</h1>
      {!papelera && (
        <form onSubmit={crear} className="fila tarjeta">
          <div className="crece">
            <label htmlFor="titulo" style={{ marginTop: 0 }}>
              Nuevo expediente
            </label>
            <input id="titulo" placeholder="Ejemplo: Despido de oficial de seguridad — Empresa X" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <button type="submit" disabled={titulo.trim().length < 3} style={{ alignSelf: "flex-end" }}>
            Crear
          </button>
        </form>
      )}
      <div className="fila" style={{ marginTop: "1rem" }}>
        <button className={papelera ? "secundario" : ""} onClick={() => setPapelera(false)}>
          Activos
        </button>
        <button className={papelera ? "" : "secundario"} onClick={() => setPapelera(true)}>
          Papelera
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error} <button className="secundario" onClick={cargar}>Reintentar</button>
        </p>
      )}
      {lista === null && !error && <p className="meta">Cargando…</p>}
      {lista?.length === 0 && <p className="meta">{papelera ? "La papelera está vacía." : "Aún no hay expedientes."}</p>}
      <ul className="lista">
        {lista?.map((x) => (
          <li key={x.id} className="tarjeta fila">
            <div className="crece">
              {papelera ? <strong>{x.titulo}</strong> : <Link href={`/expedientes/ver/?id=${x.id}`}>{x.titulo}</Link>}
              <div className="meta">
                Versión {x.version} · actualizado {fecha(x.actualizadoEn)}
                {x.cliente && ` · ${x.cliente}`}
              </div>
            </div>
            {papelera && (
              <button className="secundario" onClick={() => restaurar(x.id)}>
                Restaurar
              </button>
            )}
          </li>
        ))}
      </ul>
    </Marco>
  );
}
