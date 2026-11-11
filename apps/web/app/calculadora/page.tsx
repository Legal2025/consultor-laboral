"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calcularLiquidacion,
  ETIQUETA_CLASIFICACION,
  ETIQUETA_MODALIDAD,
  ETIQUETA_RUBRO,
  MODALIDADES,
  RUBROS,
  type DatosLiquidacion,
  type InformeCalculo,
  type Modalidad,
} from "@cl/calc";
import type { Expediente } from "@cl/shared";
import { Marco } from "@/componentes/Marco";
import { api, ErrorApi } from "@/lib/api";

type FilaSalario = { periodo: string; monto: string; fuente: "declarado" | "documentado" };
type FilaPago = { concepto: (typeof RUBROS)[number] | "sin_imputar"; monto: string; fecha: string; discutido: boolean };

const CLAVE_BORRADOR = "cl.calculadora.borrador";
const PROCEDENCIA: Record<string, string> = { procede: "Procede", no_procede: "No procede", condicionada: "Condicionada" };
const ESTADO_REGLA: Record<string, string> = {
  verificada: "Verificada",
  pendiente_verificacion: "Pendiente de verificación",
  interpretacion: "Interpretación / criterio de cómputo",
};

const colones = (v: string) =>
  `₡${Number(v).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function mesesEntre(desde: string, hasta: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}$/.test(hasta) || desde > hasta) return [];
  const out: string[] = [];
  let [a, m] = desde.split("-").map(Number) as [number, number];
  while (out.length < 600) {
    const p = `${a}-${String(m).padStart(2, "0")}`;
    out.push(p);
    if (p === hasta) break;
    m++;
    if (m > 12) {
      m = 1;
      a++;
    }
  }
  return out;
}

function aCsv(inf: InformeCalculo): string {
  const esc = (s: string) => `"${s.replaceAll('"', '""')}"`;
  const filas = [["Escenario", "Rubro", "Procedencia", "Base", "Fórmula", "Bruto", "Pagado", "Saldo", "Reglas", "Motivo"]];
  for (const e of inf.escenarios)
    for (const r of e.rubros)
      filas.push([e.nombre, r.titulo, PROCEDENCIA[r.procedencia]!, r.base ? `${r.base.concepto}: ${r.base.monto} ${r.base.unidad}` : "", r.formula, r.bruto, r.pagado, r.saldo, r.reglas.join(" "), r.motivo]);
  return "﻿" + filas.map((f) => f.map(esc).join(";")).join("\n");
}

export default function Calculadora() {
  const [ingreso, setIngreso] = useState("");
  const [terminacion, setTerminacion] = useState("");
  const [modalidad, setModalidad] = useState<Modalidad>("despido_con_responsabilidad");
  const [alternativa, setAlternativa] = useState<Modalidad | "">("");
  const [salarios, setSalarios] = useState<FilaSalario[]>([]);
  const [montoUniforme, setMontoUniforme] = useState("");
  const [preavisoDias, setPreavisoDias] = useState("0");
  const [vacGenerados, setVacGenerados] = useState("");
  const [vacDisfrutados, setVacDisfrutados] = useState("0");
  const [salariosPendientes, setSalariosPendientes] = useState("");
  const [pagos, setPagos] = useState<FilaPago[]>([]);
  const [divisor, setDivisor] = useState("30");
  const [fraccion, setFraccion] = useState<"literal" | "proporcional">("literal");
  const [informe, setInforme] = useState<InformeCalculo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expedientes, setExpedientes] = useState<Expediente[]>([]);
  const [expedienteId, setExpedienteId] = useState("");
  const [estadoGuardado, setEstadoGuardado] = useState<string | null>(null);

  // Recuperación de borrador local.
  useEffect(() => {
    try {
      const b = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) ?? "null");
      if (b) {
        setIngreso(b.ingreso ?? "");
        setTerminacion(b.terminacion ?? "");
        setModalidad(b.modalidad ?? "despido_con_responsabilidad");
        setAlternativa(b.alternativa ?? "");
        setSalarios(b.salarios ?? []);
        setPreavisoDias(b.preavisoDias ?? "0");
        setVacGenerados(b.vacGenerados ?? "");
        setVacDisfrutados(b.vacDisfrutados ?? "0");
        setSalariosPendientes(b.salariosPendientes ?? "");
        setPagos(b.pagos ?? []);
      }
    } catch {
      /* sin borrador */
    }
    api<Expediente[]>("/expedientes").then(setExpedientes).catch(() => setExpedientes([]));
  }, []);

  const borrador = useMemo(
    () => ({ ingreso, terminacion, modalidad, alternativa, salarios, preavisoDias, vacGenerados, vacDisfrutados, salariosPendientes, pagos }),
    [ingreso, terminacion, modalidad, alternativa, salarios, preavisoDias, vacGenerados, vacDisfrutados, salariosPendientes, pagos],
  );
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(borrador));
      } catch {
        /* sin almacenamiento */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [borrador]);

  function generarMeses() {
    const meses = mesesEntre(ingreso.slice(0, 7), terminacion.slice(0, 7));
    const previos = new Map(salarios.map((s) => [s.periodo, s]));
    setSalarios(meses.map((p) => previos.get(p) ?? { periodo: p, monto: montoUniforme, fuente: "declarado" }));
  }

  function datos(): DatosLiquidacion {
    return {
      fechaIngreso: ingreso,
      fechaTerminacion: terminacion,
      modalidad,
      modalidadAlternativa: alternativa || undefined,
      salarios: salarios.filter((s) => s.monto.trim() !== ""),
      preaviso: { diasOtorgados: Number(preavisoDias) || 0 },
      vacaciones: {
        diasGenerados: vacGenerados.trim() === "" ? undefined : Number(vacGenerados),
        diasDisfrutados: Number(vacDisfrutados) || 0,
      },
      salariosPendientes: salariosPendientes.trim() || undefined,
      pagos: pagos.filter((p) => p.monto.trim() !== "").map((p) => ({ ...p, fecha: p.fecha || undefined })),
      opciones: { divisorDiario: Number(divisor) || 30, cesantiaFraccion: fraccion },
    };
  }

  function calcular() {
    setError(null);
    setEstadoGuardado(null);
    try {
      setInforme(calcularLiquidacion(datos()));
    } catch (e) {
      setInforme(null);
      const issues = (e as { issues?: { path: (string | number)[]; message: string }[] }).issues;
      setError(issues ? issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ") : (e as Error).message);
    }
  }

  async function guardar() {
    setEstadoGuardado("Guardando…");
    try {
      await api("/calculos/liquidacion", { metodo: "POST", cuerpo: { datos: datos(), expedienteId: expedienteId || undefined, guardar: true } });
      setEstadoGuardado("Cálculo guardado. Los cálculos anteriores del expediente se conservan.");
    } catch (e) {
      setEstadoGuardado((e as ErrorApi).message);
    }
  }

  function descargarCsv() {
    if (!informe) return;
    const url = URL.createObjectURL(new Blob([aCsv(informe)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `informe-calculo-laboral-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Marco>
      <h1>Calculadora laboral</h1>
      <p className="meta">
        Liquidación por modalidad de salida. El cálculo se ejecuta con código en este dispositivo (funciona sin conexión); la IA no interviene en
        las operaciones. Horas extra, feriados, diferencias salariales y salarios mínimos están en construcción.
      </p>

      <div className="tarjeta">
        <h2 style={{ marginTop: 0 }}>Relación laboral</h2>
        <div className="fila">
          <div className="crece">
            <label htmlFor="ing">Fecha de ingreso</label>
            <input id="ing" type="date" value={ingreso} onChange={(e) => setIngreso(e.target.value)} />
          </div>
          <div className="crece">
            <label htmlFor="ter">
              Último día de la relación <span className="ayuda">(último laborado)</span>
            </label>
            <input id="ter" type="date" value={terminacion} onChange={(e) => setTerminacion(e.target.value)} />
          </div>
        </div>
        <div className="fila">
          <div className="crece">
            <label htmlFor="mod">Modalidad de salida</label>
            <select id="mod" value={modalidad} onChange={(e) => setModalidad(e.target.value as Modalidad)}>
              {MODALIDADES.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_MODALIDAD[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="crece">
            <label htmlFor="alt">
              Modalidad que sostiene la otra parte <span className="ayuda">(si está controvertida)</span>
            </label>
            <select id="alt" value={alternativa} onChange={(e) => setAlternativa(e.target.value as Modalidad | "")}>
              <option value="">No hay controversia</option>
              {MODALIDADES.filter((m) => m !== modalidad).map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_MODALIDAD[m]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="tarjeta" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Historial salarial</h2>
        <p className="meta">
          Remuneraciones computables de cada mes (ordinarias y extraordinarias), en colones, con punto decimal y sin separadores de miles. Indique si
          cada dato está documentado (boletas, planillas, CCSS) o solo declarado.
        </p>
        <div className="fila">
          <div className="crece">
            <label htmlFor="uni">Monto para meses nuevos (opcional)</label>
            <input id="uni" inputMode="decimal" placeholder="600000" value={montoUniforme} onChange={(e) => setMontoUniforme(e.target.value)} />
          </div>
          <button type="button" className="secundario" style={{ alignSelf: "flex-end" }} onClick={generarMeses} disabled={!ingreso || !terminacion}>
            Generar meses de la relación
          </button>
        </div>
        {salarios.length > 0 && (
          <div className="tabla-scroll" style={{ maxHeight: 360, overflowY: "auto" }}>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Periodo</th>
                  <th>Monto (₡ por mes)</th>
                  <th>Respaldo</th>
                </tr>
              </thead>
              <tbody>
                {salarios.map((s, i) => (
                  <tr key={s.periodo}>
                    <td>{s.periodo}</td>
                    <td>
                      <input
                        aria-label={`Monto ${s.periodo}`}
                        inputMode="decimal"
                        value={s.monto}
                        onChange={(e) => setSalarios(salarios.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))}
                      />
                    </td>
                    <td>
                      <select
                        aria-label={`Respaldo ${s.periodo}`}
                        value={s.fuente}
                        onChange={(e) => setSalarios(salarios.map((x, j) => (j === i ? { ...x, fuente: e.target.value as FilaSalario["fuente"] } : x)))}
                      >
                        <option value="declarado">Declarado</option>
                        <option value="documentado">Documentado</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="tarjeta" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Preaviso, vacaciones y otros datos</h2>
        <div className="fila">
          <div className="crece">
            <label htmlFor="pre">
              Días de preaviso otorgados y laborados <span className="ayuda">(0 si se despidió de inmediato)</span>
            </label>
            <input id="pre" type="number" min={0} value={preavisoDias} onChange={(e) => setPreavisoDias(e.target.value)} />
          </div>
          <div className="crece">
            <label htmlFor="vg">
              Días de vacaciones generados <span className="ayuda">(vacío: cómputo automático)</span>
            </label>
            <input id="vg" type="number" min={0} value={vacGenerados} onChange={(e) => setVacGenerados(e.target.value)} />
          </div>
          <div className="crece">
            <label htmlFor="vd">Días de vacaciones disfrutados</label>
            <input id="vd" type="number" min={0} value={vacDisfrutados} onChange={(e) => setVacDisfrutados(e.target.value)} />
          </div>
        </div>
        <label htmlFor="sp">Salarios pendientes de pago (₡, opcional)</label>
        <input id="sp" inputMode="decimal" value={salariosPendientes} onChange={(e) => setSalariosPendientes(e.target.value)} />

        <h2>Pagos ya realizados</h2>
        <p className="meta">Cada pago se imputa solo al rubro indicado. Un pago «sin imputar» no se rebaja de ningún rubro.</p>
        {pagos.map((p, i) => (
          <div key={i} className="fila" style={{ marginBottom: "0.5rem" }}>
            <select
              aria-label="Concepto"
              value={p.concepto}
              onChange={(e) => setPagos(pagos.map((x, j) => (j === i ? { ...x, concepto: e.target.value as FilaPago["concepto"] } : x)))}
              style={{ maxWidth: 220 }}
            >
              {RUBROS.map((r) => (
                <option key={r} value={r}>
                  {ETIQUETA_RUBRO[r]}
                </option>
              ))}
              <option value="sin_imputar">Abono sin imputar</option>
            </select>
            <input
              aria-label="Monto"
              inputMode="decimal"
              placeholder="Monto ₡"
              value={p.monto}
              onChange={(e) => setPagos(pagos.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))}
              style={{ maxWidth: 160 }}
            />
            <input aria-label="Fecha" type="date" value={p.fecha} onChange={(e) => setPagos(pagos.map((x, j) => (j === i ? { ...x, fecha: e.target.value } : x)))} style={{ maxWidth: 170 }} />
            <label style={{ margin: 0, fontWeight: 400 }}>
              <input type="checkbox" checked={p.discutido} onChange={(e) => setPagos(pagos.map((x, j) => (j === i ? { ...x, discutido: e.target.checked } : x)))} style={{ width: "auto" }} /> Discutido
            </label>
            <button type="button" className="secundario" onClick={() => setPagos(pagos.filter((_, j) => j !== i))}>
              Quitar
            </button>
          </div>
        ))}
        <button type="button" className="secundario" onClick={() => setPagos([...pagos, { concepto: "aguinaldo", monto: "", fecha: "", discutido: false }])}>
          Añadir pago
        </button>

        <details style={{ marginTop: "1rem" }}>
          <summary>Criterios de cómputo</summary>
          <div className="fila">
            <div className="crece">
              <label htmlFor="div">Divisor para salario diario</label>
              <input id="div" type="number" min={1} max={31} value={divisor} onChange={(e) => setDivisor(e.target.value)} />
            </div>
            <div className="crece">
              <label htmlFor="frac">Fracción de cesantía de seis meses o menos</label>
              <select id="frac" value={fraccion} onChange={(e) => setFraccion(e.target.value as "literal" | "proporcional")}>
                <option value="literal">No genera días (lectura literal del art. 29)</option>
                <option value="proporcional">Proporcional (criterio alternativo)</option>
              </select>
            </div>
          </div>
        </details>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="fila" style={{ marginTop: "1rem" }}>
          <button type="button" onClick={calcular}>
            Calcular
          </button>
        </div>
      </div>

      {informe && (
        <section aria-labelledby="titulo-informe" style={{ marginTop: "1.5rem" }}>
          <h2 id="titulo-informe">{informe.titulo}</h2>
          <div className="aviso" role="note">
            <strong>{ETIQUETA_CLASIFICACION[informe.clasificacion]}.</strong>
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.2rem" }}>
              {informe.motivosClasificacion.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <p>
            <strong>Antigüedad:</strong> {informe.antiguedad.descripcion} ({informe.antiguedad.diasNaturales} días naturales).
          </p>

          <h3>Bases de cálculo</h3>
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Monto</th>
                  <th>Unidad</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {informe.bases.map((b) => (
                  <tr key={b.concepto}>
                    <td>{b.concepto}</td>
                    <td className="num">{colones(b.monto)}</td>
                    <td>{b.unidad}</td>
                    <td className="meta">{b.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {informe.escenarios.map((e) => (
            <div key={e.nombre} className="tarjeta" style={{ marginTop: "1rem" }}>
              <h3 style={{ marginTop: 0 }}>{e.nombre}</h3>
              <p className="meta">{e.supuestos.join(" ")}</p>
              <div className="tabla-scroll">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Rubro</th>
                      <th>Procedencia</th>
                      <th>Fórmula</th>
                      <th>Bruto</th>
                      <th>Pagado</th>
                      <th>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {e.rubros.map((r) => (
                      <tr key={r.rubro}>
                        <td>
                          <strong>{r.titulo}</strong>
                          <div className="meta">{r.motivo}</div>
                          {r.reglas.length > 0 && <div className="meta">Reglas: {r.reglas.join(", ")}</div>}
                        </td>
                        <td>{PROCEDENCIA[r.procedencia]}</td>
                        <td className="meta">{r.formula}</td>
                        <td className="num">{colones(r.bruto)}</td>
                        <td className="num">{colones(r.pagado)}</td>
                        <td className="num">{colones(r.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                <strong>Total de rubros que proceden:</strong> {colones(e.totalProcedente)}
                {Number(e.totalCondicionado) > 0 && (
                  <>
                    {" "}
                    · <strong>Condicionado a decisión jurídica:</strong> {colones(e.totalCondicionado)}
                  </>
                )}
                {Number(e.pagosSinImputar) > 0 && <> · Abonos sin imputar (no rebajados): {colones(e.pagosSinImputar)}</>}
              </p>
            </div>
          ))}

          {informe.datosPendientes.length > 0 && (
            <>
              <h3>Datos pendientes</h3>
              <ul>
                {informe.datosPendientes.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </>
          )}
          {informe.advertencias.length > 0 && (
            <>
              <h3>Advertencias</h3>
              <ul>
                {informe.advertencias.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </>
          )}

          <h3>Fuentes y reglas aplicadas</h3>
          <ul className="lista">
            {informe.reglasUtilizadas.map((r) => (
              <li key={r.id} className="tarjeta">
                <strong>
                  {r.norma}, art. {r.articulo}
                </strong>{" "}
                <span className="etiqueta">{ESTADO_REGLA[r.estado]}</span>
                <div className="meta">Síntesis (no es cita textual): {r.sintesis}</div>
                {r.verificacion && (
                  <div className="meta">
                    Última verificación: {r.verificacion.fecha} ·{" "}
                    {r.verificacion.url ? (
                      <a href={r.verificacion.url} target="_blank" rel="noreferrer">
                        {r.verificacion.fuente}
                      </a>
                    ) : (
                      r.verificacion.fuente
                    )}
                    {r.verificacion.nota && <> · {r.verificacion.nota}</>}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="tarjeta fila" style={{ marginTop: "1rem" }}>
            <button type="button" className="secundario" onClick={descargarCsv}>
              Exportar detalle y fórmulas (CSV)
            </button>
            <select aria-label="Expediente" value={expedienteId} onChange={(e) => setExpedienteId(e.target.value)} style={{ maxWidth: 320 }}>
              <option value="">Sin vincular a expediente</option>
              {expedientes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.titulo}
                </option>
              ))}
            </select>
            <button type="button" onClick={guardar}>
              Guardar cálculo
            </button>
            {estadoGuardado && <span className="meta">{estadoGuardado}</span>}
          </div>
        </section>
      )}
    </Marco>
  );
}
