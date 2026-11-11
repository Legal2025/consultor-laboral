import Decimal from "decimal.js";
import {
  datosLiquidacionSchema,
  ETIQUETA_MODALIDAD,
  ETIQUETA_RUBRO,
  type DatosLiquidacion,
  type DatosLiquidacionValidados,
  type Modalidad,
  type Rubro,
} from "./datos";
import { calcularAntiguedad, describirAntiguedad, leerFecha, periodoDe, type Antiguedad } from "./fechas";
import { diasCesantiaPorAño, REGLAS, type ClaveRegla, type Regla } from "./reglas";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type Procedencia = "procede" | "no_procede" | "condicionada";

export interface ResultadoRubro {
  rubro: Rubro;
  titulo: string;
  procedencia: Procedencia;
  motivo: string;
  reglas: string[];
  periodo?: string;
  base?: { concepto: string; monto: string; unidad: string };
  formula: string;
  /** Monto bruto del derecho, en colones (2 decimales; el cálculo interno conserva precisión completa). */
  bruto: string;
  pagado: string;
  saldo: string;
}

export interface Escenario {
  nombre: string;
  supuestos: string[];
  rubros: ResultadoRubro[];
  /** Suma de saldos de rubros que proceden. */
  totalProcedente: string;
  /** Suma de saldos de rubros condicionados (no incluidos en el total procedente). */
  totalCondicionado: string;
  pagosSinImputar: string;
}

export type Clasificacion = "calculo_completo" | "estimacion_provisional" | "escenario_sujeto_a_decision";

export const ETIQUETA_CLASIFICACION: Record<Clasificacion, string> = {
  calculo_completo: "Cálculo con datos completos",
  estimacion_provisional: "Estimación provisional",
  escenario_sujeto_a_decision: "Escenario sujeto a decisión jurídica",
};

export interface InformeCalculo {
  titulo: "Informe de cálculo laboral";
  clasificacion: Clasificacion;
  motivosClasificacion: string[];
  antiguedad: Antiguedad & { descripcion: string };
  bases: { concepto: string; monto: string; unidad: string; detalle: string }[];
  escenarios: Escenario[];
  datosPendientes: string[];
  advertencias: string[];
  reglasUtilizadas: Regla[];
}

const D = (v: Decimal.Value) => new Decimal(v);
const col = (v: Decimal) => v.toDecimalPlaces(2).toFixed(2);
const fmt = (v: Decimal) =>
  `₡${v
    .toDecimalPlaces(2)
    .toNumber()
    .toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtN = (v: Decimal.Value) => D(v).toDecimalPlaces(4).toString();

interface Contexto {
  datos: DatosLiquidacionValidados;
  antig: Antiguedad;
  promedioMensual6: Decimal;
  diarioPromedio6: Decimal;
  promedioMensual12: Decimal;
  diarioPromedio12: Decimal;
  reglas: Set<ClaveRegla>;
}

function usar(ctx: Contexto, ...claves: ClaveRegla[]): string[] {
  claves.forEach((c) => ctx.reglas.add(c));
  return claves.map((c) => REGLAS[c].id);
}

function rubro(
  r: Rubro,
  procedencia: Procedencia,
  motivo: string,
  reglas: string[],
  bruto: Decimal,
  formula: string,
  extra: Partial<Pick<ResultadoRubro, "periodo" | "base">> = {},
): ResultadoRubro {
  return {
    rubro: r,
    titulo: ETIQUETA_RUBRO[r],
    procedencia,
    motivo,
    reglas,
    formula,
    bruto: col(bruto),
    pagado: "0.00",
    saldo: col(bruto),
    ...extra,
  };
}

/** Promedio de las remuneraciones de los últimos `n` periodos mensuales hasta el mes de terminación. */
function promedio(datos: DatosLiquidacionValidados, n: number): { promedio: Decimal; periodos: string[] } {
  const fin = periodoDe(leerFecha(datos.fechaTerminacion));
  const ordenados = [...datos.salarios].filter((s) => s.periodo <= fin).sort((a, b) => (a.periodo < b.periodo ? 1 : -1));
  const tomados = ordenados.slice(0, n);
  if (!tomados.length) return { promedio: D(0), periodos: [] };
  const suma = tomados.reduce((acc, s) => acc.plus(s.monto), D(0));
  return { promedio: suma.div(tomados.length), periodos: tomados.map((s) => s.periodo).reverse() };
}

// ── Preaviso ─────────────────────────────────────────────────────────────────

function diasPreavisoLegales(a: Antiguedad): { dias: number; tramo: string } {
  const m = a.mesesTotales;
  const exacto = a.dias === 0;
  if (m < 3) return { dias: 0, tramo: "menos de tres meses de trabajo continuo" };
  if (m < 6 || (m === 6 && exacto)) return { dias: 7, tramo: "de tres a seis meses: una semana" };
  if (m < 12 || (m === 12 && exacto)) return { dias: 15, tramo: "más de seis meses y hasta un año: quince días" };
  return { dias: 30, tramo: "más de un año: un mes" };
}

function calcularPreaviso(ctx: Contexto, modalidad: Modalidad): ResultadoRubro {
  const { antig, datos, diarioPromedio6 } = ctx;
  const legal = diasPreavisoLegales(antig);
  const reglasBase = usar(ctx, "preaviso", "promedioSeisMeses", "divisorDiario");
  const sinMonto = (procedencia: Procedencia, motivo: string, reglas = reglasBase) =>
    rubro("preaviso", procedencia, motivo, reglas, D(0), "—");

  switch (modalidad) {
    case "renuncia":
      return sinMonto(
        "no_procede",
        "En la renuncia el preaviso lo debe el trabajador al patrono. No se rebaja automáticamente: una eventual reclamación patronal debe verificarse por separado (procedencia, plazo y compensación).",
      );
    case "despido_sin_responsabilidad":
      return sinMonto("no_procede", "El despido sin responsabilidad patronal no genera preaviso a favor del trabajador.");
    case "pension":
      return sinMonto(
        "condicionada",
        "Terminación por pensión: el preaviso depende del tipo de pensión, régimen y de quién promovió la terminación. Requiere análisis jurídico; no se asigna por la sola etiqueta.",
        [...reglasBase, ...usar(ctx, "pension")],
      );
    case "mutuo_acuerdo":
      return sinMonto("condicionada", "En el mutuo acuerdo los rubros dependen de lo pactado; verifique el acuerdo.");
    case "vencimiento_plazo":
    case "conclusion_obra":
    case "otra":
      return sinMonto(
        "no_procede",
        "No se asigna preaviso por la sola etiqueta de la modalidad. Si hubo terminación anticipada o el contrato es en realidad indefinido, el análisis es distinto.",
      );
    case "despido_con_responsabilidad":
    case "terminacion_trabajador_con_responsabilidad":
      break;
  }
  const reglas =
    modalidad === "terminacion_trabajador_con_responsabilidad"
      ? [...reglasBase, ...usar(ctx, "responsabilidadPatronalPorTrabajador")]
      : reglasBase;
  if (legal.dias === 0) return rubro("preaviso", "no_procede", `Antigüedad inferior al mínimo legal (${legal.tramo}).`, reglas, D(0), "—");
  const otorgados = Math.min(datos.preaviso.diasOtorgados, legal.dias);
  const adeudados = legal.dias - otorgados;
  const bruto = diarioPromedio6.times(adeudados);
  return rubro(
    "preaviso",
    "procede",
    adeudados === 0
      ? `Preaviso otorgado y laborado completo (${legal.tramo}).`
      : `Corresponde preaviso (${legal.tramo}); ${otorgados} días otorgados y laborados.`,
    reglas,
    bruto,
    `(${legal.dias} días legales − ${otorgados} días otorgados) × ${fmt(diarioPromedio6)} diario = ${fmt(bruto)}`,
    { base: { concepto: "Salario diario promedio (últimos seis meses)", monto: col(diarioPromedio6), unidad: "colones por día" } },
  );
}

// ── Cesantía ─────────────────────────────────────────────────────────────────

function calcularCesantia(ctx: Contexto, modalidad: Modalidad): ResultadoRubro {
  const { antig, diarioPromedio6, datos } = ctx;
  const reglasBase = usar(ctx, "cesantia", "promedioSeisMeses", "divisorDiario");
  let procedencia: Procedencia = "procede";
  let motivoModalidad = "";
  let reglas = reglasBase;

  switch (modalidad) {
    case "renuncia":
      return rubro("cesantia", "no_procede", "La renuncia voluntaria no genera auxilio de cesantía.", reglasBase, D(0), "—");
    case "despido_sin_responsabilidad":
      return rubro("cesantia", "no_procede", "El despido sin responsabilidad patronal no genera cesantía.", reglasBase, D(0), "—");
    case "vencimiento_plazo":
    case "conclusion_obra":
    case "otra":
      return rubro(
        "cesantia",
        "no_procede",
        "No se asigna cesantía por la sola etiqueta de la modalidad; requiere análisis del tipo real de contrato y de la causa de terminación.",
        reglasBase,
        D(0),
        "—",
      );
    case "pension":
      procedencia = "condicionada";
      motivoModalidad =
        "Terminación por pensión: la procedencia depende del texto vigente del art. 85 CT (pendiente de verificación), del tipo de pensión y de la causa efectiva. Se muestra el monto para análisis, sin incluirlo en el total procedente.";
      reglas = [...reglasBase, ...usar(ctx, "pension")];
      break;
    case "mutuo_acuerdo":
      procedencia = "condicionada";
      motivoModalidad = "Mutuo acuerdo: depende de lo pactado. Se muestra el monto de referencia sin incluirlo en el total procedente.";
      break;
    case "terminacion_trabajador_con_responsabilidad":
      reglas = [...reglasBase, ...usar(ctx, "responsabilidadPatronalPorTrabajador")];
      break;
    case "despido_con_responsabilidad":
      break;
  }

  const m = antig.mesesTotales;
  const base = { concepto: "Salario diario promedio (últimos seis meses)", monto: col(diarioPromedio6), unidad: "colones por día" };
  if (m < 3) return rubro("cesantia", "no_procede", "Antigüedad inferior a tres meses.", reglas, D(0), "—");
  if (m < 6 || (m === 6 && antig.dias === 0)) {
    const b = diarioPromedio6.times(7);
    return rubro("cesantia", procedencia, motivoModalidad || "Antigüedad de tres a seis meses: 7 días.", reglas, b, `7 días × ${fmt(diarioPromedio6)} = ${fmt(b)}`, { base });
  }
  if (m < 12) {
    const b = diarioPromedio6.times(14);
    return rubro(
      "cesantia",
      procedencia,
      motivoModalidad || "Más de seis meses y menos de un año: 14 días.",
      reglas,
      b,
      `14 días × ${fmt(diarioPromedio6)} = ${fmt(b)}`,
      { base },
    );
  }

  // Más de un año: tabla del inciso 3), tope de ocho años.
  const fraccionMeses = antig.meses + antig.dias / 30;
  const fraccionSuperiorSeis = antig.meses > 6 || (antig.meses === 6 && antig.dias > 0);
  let añosComputables: Decimal;
  let notaFraccion: string;
  if (datos.opciones.cesantiaFraccion === "literal") {
    añosComputables = D(antig.años + (fraccionSuperiorSeis ? 1 : 0));
    notaFraccion = fraccionSuperiorSeis
      ? "la fracción superior a seis meses se computa como año"
      : antig.meses || antig.dias
        ? "la fracción de seis meses o menos no genera días (lectura literal)"
        : "sin fracción";
  } else {
    añosComputables = D(antig.años).plus(D(fraccionMeses).div(12));
    notaFraccion = "fracción computada proporcionalmente (criterio alternativo configurado)";
  }
  usar(ctx, "cesantiaFraccion");
  const filaTabla = Math.max(1, Math.ceil(añosComputables.toNumber()));
  const diasPorAño = D(diasCesantiaPorAño(filaTabla));
  const tope = Decimal.min(añosComputables, 8);
  const dias = diasPorAño.times(tope);
  const b = diarioPromedio6.times(dias);
  return rubro(
    "cesantia",
    procedencia,
    motivoModalidad ||
      `Antigüedad de ${describirAntiguedad(antig)}; ${notaFraccion}. Tabla: ${fmtN(diasPorAño)} días por año (fila ${filaTabla}).${
        añosComputables.gt(8) ? " Se aplica el tope de ocho años." : ""
      }`,
    reglas,
    b,
    `${fmtN(diasPorAño)} días/año × ${fmtN(tope)} años = ${fmtN(dias)} días × ${fmt(diarioPromedio6)} = ${fmt(b)}`,
    { base },
  );
}

// ── Aguinaldo ────────────────────────────────────────────────────────────────

function calcularAguinaldo(ctx: Contexto): ResultadoRubro {
  const { datos } = ctx;
  const reglas = usar(ctx, "aguinaldo");
  const term = leerFecha(datos.fechaTerminacion);
  const ing = leerFecha(datos.fechaIngreso);
  const inicioAño = term.m === 12 ? term.a : term.a - 1;
  let inicio = `${inicioAño}-12`;
  const periodoIngreso = periodoDe(ing);
  if (periodoIngreso > inicio) inicio = periodoIngreso;
  const fin = periodoDe(term);
  const incluidos = datos.salarios.filter((s) => s.periodo >= inicio && s.periodo <= fin);
  const suma = incluidos.reduce((acc, s) => acc.plus(s.monto), D(0));
  const bruto = suma.div(12);
  return rubro(
    "aguinaldo",
    "procede",
    `Remuneraciones computables del periodo ${inicio} a ${fin} (${incluidos.length} meses con datos).`,
    reglas,
    bruto,
    `${fmt(suma)} ÷ 12 = ${fmt(bruto)}`,
    { periodo: `${inicio} a ${fin}`, base: { concepto: "Suma de remuneraciones del periodo", monto: col(suma), unidad: "colones" } },
  );
}

// ── Vacaciones ───────────────────────────────────────────────────────────────

function calcularVacaciones(ctx: Contexto): ResultadoRubro {
  const { datos, antig, diarioPromedio12 } = ctx;
  const reglas = usar(ctx, "vacaciones", "divisorDiario");
  let generados: number;
  let origen: string;
  if (datos.vacaciones.diasGenerados !== undefined) {
    generados = datos.vacaciones.diasGenerados;
    origen = "días generados indicados por el usuario";
  } else {
    generados = antig.mesesTotales;
    origen = `cómputo automático: un día por cada mes completo laborado (${antig.mesesTotales} meses)`;
    reglas.push(...usar(ctx, "vacacionesProporcionales"));
  }
  const saldoDias = Math.max(0, generados - datos.vacaciones.diasDisfrutados);
  const bruto = diarioPromedio12.times(saldoDias);
  return rubro(
    "vacaciones",
    saldoDias > 0 ? "procede" : "no_procede",
    `${origen}; ${datos.vacaciones.diasDisfrutados} días disfrutados.${
      generados < datos.vacaciones.diasDisfrutados ? " Los días disfrutados superan los generados: revise los registros." : ""
    }`,
    reglas,
    bruto,
    `(${generados} − ${datos.vacaciones.diasDisfrutados}) días × ${fmt(diarioPromedio12)} diario = ${fmt(bruto)}`,
    { base: { concepto: "Salario diario promedio (hasta últimos doce meses)", monto: col(diarioPromedio12), unidad: "colones por día" } },
  );
}

function calcularSalariosPendientes(ctx: Contexto): ResultadoRubro | null {
  const v = ctx.datos.salariosPendientes;
  if (!v || D(v).isZero()) return null;
  return rubro("salarios_pendientes", "procede", "Monto declarado por el usuario.", [], D(v), `Declarado: ${fmt(D(v))}`);
}

// ── Escenarios ───────────────────────────────────────────────────────────────

type Pago = DatosLiquidacionValidados["pagos"][number];

function construirEscenario(ctx: Contexto, modalidad: Modalidad, pagos: Pago[], supuestos: string[], nombre: string): Escenario {
  const rubros = [
    calcularPreaviso(ctx, modalidad),
    calcularCesantia(ctx, modalidad),
    calcularAguinaldo(ctx),
    calcularVacaciones(ctx),
    calcularSalariosPendientes(ctx),
  ].filter((r): r is ResultadoRubro => r !== null);

  // Imputación: cada pago solo se aplica al rubro de su concepto. Lo que excede el rubro no se traslada a otro.
  let sinImputar = D(0);
  for (const p of pagos) {
    if (p.concepto === "sin_imputar") {
      sinImputar = sinImputar.plus(p.monto);
      continue;
    }
    const r = rubros.find((x) => x.rubro === p.concepto);
    if (!r) {
      sinImputar = sinImputar.plus(p.monto);
      continue;
    }
    r.pagado = col(D(r.pagado).plus(p.monto));
  }
  for (const r of rubros) {
    const saldo = D(r.bruto).minus(r.pagado);
    r.saldo = col(saldo);
  }
  const suma = (pred: (r: ResultadoRubro) => boolean) =>
    rubros.filter(pred).reduce((acc, r) => acc.plus(r.saldo), D(0));
  return {
    nombre,
    supuestos,
    rubros,
    totalProcedente: col(suma((r) => r.procedencia === "procede")),
    totalCondicionado: col(suma((r) => r.procedencia === "condicionada")),
    pagosSinImputar: col(sinImputar),
  };
}

/**
 * Calcula una liquidación laboral. Valida los datos, determina bases independientes por rubro,
 * imputa pagos solo a su concepto y genera escenarios cuando la modalidad o algún pago están controvertidos.
 */
export function calcularLiquidacion(entrada: DatosLiquidacion): InformeCalculo {
  const datos = datosLiquidacionSchema.parse(entrada);
  const antig = calcularAntiguedad(datos.fechaIngreso, datos.fechaTerminacion);
  const p6 = promedio(datos, 6);
  const p12 = promedio(datos, 12);
  const divisor = datos.opciones.divisorDiario;
  const ctx: Contexto = {
    datos,
    antig,
    promedioMensual6: p6.promedio,
    diarioPromedio6: p6.promedio.div(divisor),
    promedioMensual12: p12.promedio,
    diarioPromedio12: p12.promedio.div(divisor),
    reglas: new Set(),
  };

  const datosPendientes: string[] = [];
  const advertencias: string[] = [];
  const mesesEsperados6 = Math.min(6, Math.max(1, antig.mesesTotales + (antig.dias > 0 ? 1 : 0)));
  if (p6.periodos.length < mesesEsperados6) {
    datosPendientes.push(
      `Salarios de los últimos seis meses: se recibieron ${p6.periodos.length} de ${mesesEsperados6} meses esperados. El promedio se calculó solo con los meses disponibles.`,
    );
  }
  const fuera = datos.salarios.filter((s) => s.periodo > periodoDe(leerFecha(datos.fechaTerminacion)) || s.periodo < periodoDe(leerFecha(datos.fechaIngreso)));
  if (fuera.length) advertencias.push(`Se ignoraron ${fuera.length} periodos salariales fuera de la relación laboral: ${fuera.map((s) => s.periodo).join(", ")}.`);
  const repetidos = datos.salarios.map((s) => s.periodo).filter((p, i, arr) => arr.indexOf(p) !== i);
  if (repetidos.length) advertencias.push(`Periodos salariales repetidos (se suman ambos registros): ${[...new Set(repetidos)].join(", ")}. Verifique si es un error.`);
  if (leerFecha(datos.fechaTerminacion).d < 28 || datos.salarios.some((s) => s.periodo === periodoDe(leerFecha(datos.fechaIngreso)) && leerFecha(datos.fechaIngreso).d > 1)) {
    advertencias.push("El primer o el último mes de la relación es parcial: el monto de ese mes influye en los promedios tal como fue indicado.");
  }
  if (datos.salarios.every((s) => s.fuente === "declarado")) {
    advertencias.push("Todos los salarios son declarados; ninguno consta como documentado (boletas, planillas o constancias de la CCSS).");
  }
  if (datos.modalidad === "renuncia" && datos.preaviso.diasOtorgados === 0) {
    advertencias.push("Renuncia sin preaviso registrado: no se descuenta ningún preaviso al trabajador; si el patrono lo reclama, debe analizarse su procedencia por separado.");
  }
  if (datos.vacaciones.diasGenerados === undefined) {
    datosPendientes.push("Registro de vacaciones generadas y disfrutadas (se usó un cómputo automático).");
  }

  const discutidos = datos.pagos.filter((p) => p.discutido);
  const firmes = datos.pagos.filter((p) => !p.discutido);
  const modalidades: Modalidad[] = [datos.modalidad, ...(datos.modalidadAlternativa ? [datos.modalidadAlternativa] : [])];
  const escenarios: Escenario[] = [];
  for (const mod of modalidades) {
    const esAlternativa = mod !== datos.modalidad;
    const sup = [`Modalidad: ${ETIQUETA_MODALIDAD[mod]}${esAlternativa ? " (posición alternativa)" : ""}.`];
    if (discutidos.length) {
      escenarios.push(
        construirEscenario(ctx, mod, [...firmes, ...discutidos], [...sup, "Se reconocen los pagos discutidos."], `${ETIQUETA_MODALIDAD[mod]} · con pagos discutidos`),
        construirEscenario(ctx, mod, firmes, [...sup, "No se reconocen los pagos discutidos."], `${ETIQUETA_MODALIDAD[mod]} · sin pagos discutidos`),
      );
    } else {
      escenarios.push(construirEscenario(ctx, mod, firmes, sup, ETIQUETA_MODALIDAD[mod]));
    }
  }

  const reglasUtilizadas = [...ctx.reglas].map((c) => REGLAS[c] as Regla);
  const pendientes = reglasUtilizadas.filter((r) => r.estado === "pendiente_verificacion");
  const motivos: string[] = [];
  let clasificacion: Clasificacion = "calculo_completo";
  const hayCondicionados = escenarios.some((e) => e.rubros.some((r) => r.procedencia === "condicionada"));
  if (escenarios.length > 1 || hayCondicionados) {
    clasificacion = "escenario_sujeto_a_decision";
    if (escenarios.length > 1) motivos.push("Hay hechos controvertidos (modalidad o pagos): se presentan escenarios.");
    if (hayCondicionados) motivos.push("Algún rubro depende de una decisión jurídica (procedencia condicionada).");
  } else if (pendientes.length || datosPendientes.length) {
    clasificacion = "estimacion_provisional";
  }
  if (pendientes.length) motivos.push(`Reglas pendientes de verificación contra el texto oficial: ${pendientes.map((r) => `${r.norma} art. ${r.articulo}`).join("; ")}.`);
  if (datosPendientes.length) motivos.push("Faltan datos indicados en «Datos pendientes».");

  return {
    titulo: "Informe de cálculo laboral",
    clasificacion,
    motivosClasificacion: motivos,
    antiguedad: { ...antig, descripcion: describirAntiguedad(antig) },
    bases: [
      {
        concepto: "Salario mensual promedio (últimos seis meses)",
        monto: col(ctx.promedioMensual6),
        unidad: "colones por mes",
        detalle: `Periodos: ${p6.periodos.join(", ") || "ninguno"}. Base de preaviso y cesantía.`,
      },
      {
        concepto: "Salario diario promedio (últimos seis meses)",
        monto: col(ctx.diarioPromedio6),
        unidad: "colones por día",
        detalle: `Promedio mensual ÷ ${divisor}.`,
      },
      {
        concepto: "Salario diario promedio (hasta últimos doce meses)",
        monto: col(ctx.diarioPromedio12),
        unidad: "colones por día",
        detalle: `Periodos: ${p12.periodos.join(", ") || "ninguno"}. Base de vacaciones (regla pendiente de verificación).`,
      },
    ],
    escenarios,
    datosPendientes,
    advertencias,
    reglasUtilizadas,
  };
}
