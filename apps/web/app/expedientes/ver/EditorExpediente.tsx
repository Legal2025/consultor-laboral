"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PERSPECTIVAS, type ContenidoExpediente, type Expediente, type VersionExpediente } from "@cl/shared";
import { api, ErrorApi } from "@/lib/api";

const CAMPOS: (keyof ContenidoExpediente)[] = [
  "titulo",
  "cliente",
  "contraparte",
  "perspectiva",
  "hechosDeclarados",
  "hechosDocumentados",
  "notas",
];
const ETIQUETA_PERSPECTIVA: Record<(typeof PERSPECTIVAS)[number], string> = {
  trabajador: "Trabajador",
  empresarial: "Empresarial",
  neutral: "Litigante / neutral",
};

const fecha = (iso: string) => new Date(iso).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" });
const claveBorrador = (id: string) => `cl.borrador.${id}`;

interface Borrador {
  base: number;
  contenido: ContenidoExpediente;
  guardadoEn: string;
}

function extraer(x: Expediente): ContenidoExpediente {
  return Object.fromEntries(CAMPOS.map((c) => [c, x[c]])) as unknown as ContenidoExpediente;
}

function leerBorrador(id: string): Borrador | null {
  try {
    const t = localStorage.getItem(claveBorrador(id));
    return t ? (JSON.parse(t) as Borrador) : null;
  } catch {
    return null;
  }
}

function escribirBorrador(id: string, b: Borrador | null) {
  try {
    if (b) localStorage.setItem(claveBorrador(id), JSON.stringify(b));
    else localStorage.removeItem(claveBorrador(id));
  } catch {
    /* sin almacenamiento local */
  }
}

/**
 * Edición con guardado local automático (borrador) y control de versiones:
 * si otro dispositivo guardó antes, se muestra la versión vigente y el usuario decide;
 * nunca se sobrescribe en silencio.
 */
export function EditorExpediente({ id }: { id: string }) {
  const router = useRouter();
  const [exp, setExp] = useState<Expediente | null>(null);
  const [form, setForm] = useState<ContenidoExpediente | null>(null);
  const [base, setBase] = useState(0);
  const [borradorPendiente, setBorradorPendiente] = useState<Borrador | null>(null);
  const [conflicto, setConflicto] = useState<Expediente | null>(null);
  const [estado, setEstado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [versiones, setVersiones] = useState<VersionExpediente[] | null>(null);
  const modificado = useRef(false);

  useEffect(() => {
    api<Expediente>(`/expedientes/${id}`)
      .then((x) => {
        setExp(x);
        setForm(extraer(x));
        setBase(x.version);
        const b = leerBorrador(id);
        if (b) setBorradorPendiente(b);
      })
      .catch((e: ErrorApi) => {
        // Sin conexión: se ofrece el borrador local si existe, indicando su fecha.
        const b = leerBorrador(id);
        if (e.sinConexion && b) {
          setForm(b.contenido);
          setBase(b.base);
          setEstado(`Sin conexión. Se muestra el borrador local del ${fecha(b.guardadoEn)}; se podrá guardar al reconectar.`);
        } else setError(e.message);
      });
  }, [id]);

  // Guardado local automático tras cada cambio (con breve espera).
  useEffect(() => {
    if (!form || !modificado.current) return;
    const t = setTimeout(() => escribirBorrador(id, { base, contenido: form, guardadoEn: new Date().toISOString() }), 600);
    return () => clearTimeout(t);
  }, [form, base, id]);

  function cambiar<K extends keyof ContenidoExpediente>(campo: K, valor: ContenidoExpediente[K]) {
    modificado.current = true;
    setForm((f) => (f ? { ...f, [campo]: valor } : f));
    setEstado("Cambios sin guardar (borrador local guardado en este dispositivo).");
  }

  async function guardar(sobreVersion = base) {
    if (!form) return;
    setError(null);
    setEstado("Guardando…");
    try {
      const x = await api<Expediente>(`/expedientes/${id}`, { metodo: "PUT", cuerpo: { version: sobreVersion, contenido: form } });
      setExp(x);
      setBase(x.version);
      setConflicto(null);
      escribirBorrador(id, null);
      modificado.current = false;
      setEstado(`Guardado como versión ${x.version} (${fecha(x.actualizadoEn)})`);
      if (versiones) cargarVersiones();
    } catch (err) {
      const e = err as ErrorApi;
      if (e.codigo === "conflicto_version") {
        setConflicto(e.datos?.vigente as Expediente);
        setEstado(null);
      } else {
        setEstado(null);
        setError(e.sinConexion ? `${e.message} Sus cambios siguen guardados como borrador en este dispositivo.` : e.message);
      }
    }
  }

  function cargarVersiones() {
    api<VersionExpediente[]>(`/expedientes/${id}/versiones`)
      .then(setVersiones)
      .catch((e: ErrorApi) => setError(e.message));
  }

  async function enviarAPapelera() {
    if (!confirm("¿Enviar este expediente a la papelera? Podrá restaurarlo desde allí.")) return;
    try {
      await api(`/expedientes/${id}`, { metodo: "DELETE" });
      escribirBorrador(id, null);
      router.replace("/expedientes/");
    } catch (err) {
      setError((err as ErrorApi).message);
    }
  }

  if (error && !form) return <p className="error">{error}</p>;
  if (!form) return <p className="meta">Cargando…</p>;

  return (
    <>
      <h1>{form.titulo || "Expediente"}</h1>
      {exp && (
        <p className="meta">
          Versión {base} · creado {fecha(exp.creadoEn)} · última actualización {fecha(exp.actualizadoEn)}
        </p>
      )}

      {borradorPendiente && (
        <div className="aviso" role="alert">
          Hay un borrador local de este expediente del {fecha(borradorPendiente.guardadoEn)}, basado en la versión {borradorPendiente.base}.
          <div className="fila" style={{ marginTop: "0.5rem" }}>
            <button
              onClick={() => {
                modificado.current = true;
                setForm(borradorPendiente.contenido);
                setBase(borradorPendiente.base);
                setBorradorPendiente(null);
                setEstado("Borrador recuperado; aún no guardado.");
              }}
            >
              Recuperar borrador
            </button>
            <button
              className="secundario"
              onClick={() => {
                escribirBorrador(id, null);
                setBorradorPendiente(null);
              }}
            >
              Descartar borrador
            </button>
          </div>
        </div>
      )}

      {conflicto && (
        <div className="aviso" role="alert">
          <strong>Conflicto de versiones.</strong> Mientras editaba, se guardó la versión {conflicto.version} desde otro dispositivo
          ({fecha(conflicto.actualizadoEn)}). Sus cambios no se han guardado y siguen como borrador local.
          <div className="fila" style={{ marginTop: "0.5rem" }}>
            <button className="secundario" onClick={() => { setForm(extraer(conflicto)); setBase(conflicto.version); setExp(conflicto); setConflicto(null); modificado.current = false; }}>
              Ver versión vigente
            </button>
            <button onClick={() => guardar(conflicto.version)}>Guardar mis cambios como versión nueva</button>
          </div>
          <p className="meta">La versión vigente se conserva en el historial aunque guarde sus cambios encima.</p>
        </div>
      )}

      <div className="tarjeta">
        <label htmlFor="titulo">Título</label>
        <input id="titulo" value={form.titulo} onChange={(e) => cambiar("titulo", e.target.value)} />
        <div className="fila">
          <div className="crece">
            <label htmlFor="cliente">Cliente</label>
            <input id="cliente" value={form.cliente} onChange={(e) => cambiar("cliente", e.target.value)} />
          </div>
          <div className="crece">
            <label htmlFor="contraparte">Contraparte</label>
            <input id="contraparte" value={form.contraparte} onChange={(e) => cambiar("contraparte", e.target.value)} />
          </div>
        </div>
        <label htmlFor="perspectiva">
          Perspectiva <span className="ayuda">(cambia el enfoque de la explicación, nunca los hechos ni las fuentes)</span>
        </label>
        <select id="perspectiva" value={form.perspectiva} onChange={(e) => cambiar("perspectiva", e.target.value as ContenidoExpediente["perspectiva"])}>
          {PERSPECTIVAS.map((p) => (
            <option key={p} value={p}>
              {ETIQUETA_PERSPECTIVA[p]}
            </option>
          ))}
        </select>
        <label htmlFor="hd">
          Hechos declarados <span className="ayuda">(relatados por el cliente, sin respaldo documental aún)</span>
        </label>
        <textarea id="hd" value={form.hechosDeclarados} onChange={(e) => cambiar("hechosDeclarados", e.target.value)} />
        <label htmlFor="hdoc">
          Hechos documentados <span className="ayuda">(con referencia al documento que los respalda)</span>
        </label>
        <textarea id="hdoc" value={form.hechosDocumentados} onChange={(e) => cambiar("hechosDocumentados", e.target.value)} />
        <label htmlFor="notas">Notas del abogado</label>
        <textarea id="notas" value={form.notas} onChange={(e) => cambiar("notas", e.target.value)} />

        {error && <p className="error" role="alert">{error}</p>}
        {estado && <p className="meta" role="status">{estado}</p>}
        <div className="fila" style={{ marginTop: "1rem" }}>
          <button onClick={() => guardar()} disabled={!!conflicto || form.titulo.trim().length < 3}>
            Guardar versión
          </button>
          <button className="secundario" onClick={cargarVersiones}>
            Ver historial de versiones
          </button>
          <button className="secundario" onClick={enviarAPapelera} style={{ marginLeft: "auto" }}>
            Enviar a papelera
          </button>
        </div>
      </div>

      {versiones && (
        <>
          <h2>Historial de versiones</h2>
          <ul className="lista">
            {versiones.map((v) => (
              <li key={v.version} className="tarjeta">
                <strong>Versión {v.version}</strong> <span className="meta">· {fecha(v.creadoEn)} · {v.autor}</span>
                <details>
                  <summary>Ver contenido</summary>
                  <p><strong>Título:</strong> {v.contenido.titulo}</p>
                  <p><strong>Hechos declarados:</strong> {v.contenido.hechosDeclarados || "—"}</p>
                  <p><strong>Hechos documentados:</strong> {v.contenido.hechosDocumentados || "—"}</p>
                  <p><strong>Notas:</strong> {v.contenido.notas || "—"}</p>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
