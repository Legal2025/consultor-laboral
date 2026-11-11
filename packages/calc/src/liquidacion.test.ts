import { describe, expect, it } from "vitest";
import { calcularLiquidacion, type DatosLiquidacion, type Escenario } from "./index";
import { calcularAntiguedad } from "./fechas";

/** Genera salarios mensuales iguales entre dos periodos AAAA-MM inclusive. */
function mensuales(desde: string, hasta: string, monto: string) {
  const out: { periodo: string; monto: string; fuente: "documentado" }[] = [];
  let [a, m] = desde.split("-").map(Number) as [number, number];
  const [af, mf] = hasta.split("-").map(Number) as [number, number];
  while (a < af || (a === af && m <= mf)) {
    out.push({ periodo: `${a}-${String(m).padStart(2, "0")}`, monto, fuente: "documentado" });
    m++;
    if (m > 12) {
      m = 1;
      a++;
    }
  }
  return out;
}

const r = (e: Escenario, rubro: string) => e.rubros.find((x) => x.rubro === rubro)!;

const base: DatosLiquidacion = {
  fechaIngreso: "2020-03-02",
  fechaTerminacion: "2026-10-15",
  modalidad: "despido_con_responsabilidad",
  salarios: mensuales("2020-03", "2026-10", "600000"),
  vacaciones: { diasDisfrutados: 70 },
};

describe("antigüedad", () => {
  it("cuenta por calendario incluyendo el último día laborado", () => {
    expect(calcularAntiguedad("2020-03-02", "2026-10-15")).toMatchObject({ años: 6, meses: 7, dias: 14 });
    expect(calcularAntiguedad("2010-01-04", "2026-01-03")).toMatchObject({ años: 16, meses: 0, dias: 0 });
    expect(calcularAntiguedad("2024-01-15", "2024-02-14")).toMatchObject({ años: 0, meses: 1, dias: 0 });
    // Fin de mes: 31 de enero + 1 mes = 29 de febrero (bisiesto); nunca días negativos.
    expect(calcularAntiguedad("2024-01-31", "2024-02-29")).toMatchObject({ años: 0, meses: 1, dias: 1 });
  });
  it("rechaza terminación anterior al ingreso", () => {
    expect(() => calcularAntiguedad("2026-01-10", "2026-01-09")).toThrow();
  });
});

describe("despido con responsabilidad patronal", () => {
  const inf = calcularLiquidacion(base);
  const e = inf.escenarios[0]!;

  it("cesantía: fracción superior a seis meses computa como año, fila 7 de la tabla", () => {
    expect(r(e, "cesantia").procedencia).toBe("procede");
    // 22 días × 7 años = 154 días × ₡20 000
    expect(r(e, "cesantia").bruto).toBe("3080000.00");
  });
  it("preaviso de un mes con promedio de seis meses", () => {
    expect(r(e, "preaviso").bruto).toBe("600000.00");
  });
  it("aguinaldo proporcional del 1 de diciembre a la terminación", () => {
    expect(r(e, "aguinaldo").periodo).toBe("2025-12 a 2026-10");
    expect(r(e, "aguinaldo").bruto).toBe("550000.00");
  });
  it("vacaciones: saldo de días por salario diario", () => {
    // 79 meses completos − 70 disfrutados = 9 días × ₡20 000
    expect(r(e, "vacaciones").bruto).toBe("180000.00");
  });
  it("es estimación provisional mientras haya reglas sin verificar", () => {
    expect(inf.clasificacion).toBe("estimacion_provisional");
    expect(inf.reglasUtilizadas.some((x) => x.estado === "pendiente_verificacion")).toBe(true);
    expect(e.totalProcedente).toBe("4410000.00");
  });
  it("es reproducible", () => {
    expect(calcularLiquidacion(base)).toEqual(inf);
  });
});

describe("cesantía por tramos", () => {
  it("tope de ocho años con fila 13 y siguientes", () => {
    const inf = calcularLiquidacion({ ...base, fechaIngreso: "2010-01-04", fechaTerminacion: "2026-01-03", salarios: mensuales("2025-07", "2026-01", "300000") });
    // 20 días × 8 años = 160 días × ₡10 000
    expect(r(inf.escenarios[0]!, "cesantia").bruto).toBe("1600000.00");
  });
  it("fracción de seis meses o menos: lectura literal y alternativa proporcional", () => {
    const d = { ...base, fechaIngreso: "2023-01-01", fechaTerminacion: "2025-06-30", salarios: mensuales("2023-01", "2025-06", "300000") };
    expect(r(calcularLiquidacion(d).escenarios[0]!, "cesantia").bruto).toBe("400000.00"); // 20 × 2 = 40 días
    const prop = calcularLiquidacion({ ...d, opciones: { cesantiaFraccion: "proporcional" } });
    expect(r(prop.escenarios[0]!, "cesantia").bruto).toBe("512500.00"); // 20,5 × 2,5 = 51,25 días
  });
  it("tres a seis meses: siete días de cesantía y una semana de preaviso", () => {
    const inf = calcularLiquidacion({ ...base, fechaIngreso: "2026-05-01", fechaTerminacion: "2026-09-30", salarios: mensuales("2026-05", "2026-09", "450000") });
    const e = inf.escenarios[0]!;
    expect(r(e, "cesantia").bruto).toBe("105000.00");
    expect(r(e, "preaviso").bruto).toBe("105000.00");
  });
  it("menos de tres meses: sin cesantía ni preaviso", () => {
    const e = calcularLiquidacion({ ...base, fechaIngreso: "2026-08-01", fechaTerminacion: "2026-10-15", salarios: mensuales("2026-08", "2026-10", "450000") }).escenarios[0]!;
    expect(r(e, "cesantia").procedencia).toBe("no_procede");
    expect(r(e, "preaviso").procedencia).toBe("no_procede");
  });
});

describe("modalidades de salida", () => {
  it("renuncia: sin preaviso ni cesantía, sin descontar preaviso al trabajador", () => {
    const inf = calcularLiquidacion({ ...base, modalidad: "renuncia" });
    const e = inf.escenarios[0]!;
    expect(r(e, "cesantia").procedencia).toBe("no_procede");
    expect(r(e, "preaviso").procedencia).toBe("no_procede");
    expect(r(e, "aguinaldo").procedencia).toBe("procede");
    expect(e.totalProcedente).toBe("730000.00");
    expect(inf.advertencias.some((a) => a.includes("no se descuenta"))).toBe(true);
  });
  it("despido sin responsabilidad: conserva aguinaldo y vacaciones", () => {
    const e = calcularLiquidacion({ ...base, modalidad: "despido_sin_responsabilidad" }).escenarios[0]!;
    expect(r(e, "cesantia").procedencia).toBe("no_procede");
    expect(e.totalProcedente).toBe("730000.00");
  });
  it("pensión: cesantía condicionada, fuera del total procedente", () => {
    const inf = calcularLiquidacion({ ...base, modalidad: "pension" });
    const e = inf.escenarios[0]!;
    expect(r(e, "cesantia").procedencia).toBe("condicionada");
    expect(e.totalCondicionado).toBe("3080000.00");
    expect(e.totalProcedente).toBe("730000.00");
    expect(inf.clasificacion).toBe("escenario_sujeto_a_decision");
  });
  it("vencimiento de plazo: no asigna rubros por etiqueta", () => {
    const e = calcularLiquidacion({ ...base, modalidad: "vencimiento_plazo" }).escenarios[0]!;
    expect(r(e, "cesantia").procedencia).toBe("no_procede");
    expect(r(e, "preaviso").procedencia).toBe("no_procede");
  });
  it("modalidad controvertida: un escenario por posición", () => {
    const inf = calcularLiquidacion({ ...base, modalidad: "despido_con_responsabilidad", modalidadAlternativa: "despido_sin_responsabilidad" });
    expect(inf.escenarios).toHaveLength(2);
    expect(inf.escenarios[0]!.totalProcedente).toBe("4410000.00");
    expect(inf.escenarios[1]!.totalProcedente).toBe("730000.00");
    expect(inf.clasificacion).toBe("escenario_sujeto_a_decision");
  });
});

describe("pagos anteriores", () => {
  it("preaviso otorgado y laborado completo no genera saldo", () => {
    const e = calcularLiquidacion({ ...base, preaviso: { diasOtorgados: 30 } }).escenarios[0]!;
    expect(r(e, "preaviso").bruto).toBe("0.00");
  });
  it("preaviso parcial", () => {
    const e = calcularLiquidacion({ ...base, preaviso: { diasOtorgados: 10 } }).escenarios[0]!;
    expect(r(e, "preaviso").bruto).toBe("400000.00");
  });
  it("aguinaldo pagado se imputa solo al aguinaldo", () => {
    const e = calcularLiquidacion({ ...base, pagos: [{ concepto: "aguinaldo", monto: "550000" }] }).escenarios[0]!;
    expect(r(e, "aguinaldo").saldo).toBe("0.00");
    expect(r(e, "cesantia").pagado).toBe("0.00");
  });
  it("vacaciones disfrutadas reducen el saldo de días", () => {
    const e = calcularLiquidacion({ ...base, vacaciones: { diasGenerados: 24, diasDisfrutados: 24 } }).escenarios[0]!;
    expect(r(e, "vacaciones").procedencia).toBe("no_procede");
  });
  it("un abono sin imputar no se rebaja de ningún rubro", () => {
    const e = calcularLiquidacion({ ...base, pagos: [{ concepto: "sin_imputar", monto: "100000" }] }).escenarios[0]!;
    expect(e.totalProcedente).toBe("4410000.00");
    expect(e.pagosSinImputar).toBe("100000.00");
  });
  it("pago discutido: escenarios con y sin reconocimiento", () => {
    const inf = calcularLiquidacion({ ...base, pagos: [{ concepto: "cesantia", monto: "1000000", discutido: true }] });
    expect(inf.escenarios.map((x) => x.totalProcedente)).toEqual(["3410000.00", "4410000.00"]);
    expect(inf.clasificacion).toBe("escenario_sujeto_a_decision");
  });
});

describe("bases independientes y conversiones", () => {
  it("un pago extraordinario fuera de los últimos seis meses afecta el aguinaldo, no el preaviso", () => {
    const salarios = mensuales("2020-03", "2026-10", "600000").map((s) => (s.periodo === "2026-01" ? { ...s, monto: "900000" } : s));
    const e = calcularLiquidacion({ ...base, salarios }).escenarios[0]!;
    expect(r(e, "preaviso").bruto).toBe("600000.00");
    expect(r(e, "aguinaldo").bruto).toBe("575000.00");
  });
  it("conserva precisión interna y redondea solo al presentar", () => {
    const e = calcularLiquidacion({ ...base, salarios: mensuales("2020-03", "2026-10", "333333.33") }).escenarios[0]!;
    // diario = 11 111,111 exacto; × 154 días = 1 711 111,094
    expect(r(e, "cesantia").bruto).toBe("1711111.09");
  });
  it("divisor diario configurable", () => {
    const e = calcularLiquidacion({ ...base, opciones: { divisorDiario: 26 } }).escenarios[0]!;
    expect(r(e, "preaviso").bruto).toBe("692307.69");
  });
  it("indica datos pendientes si faltan meses de salario", () => {
    const inf = calcularLiquidacion({ ...base, salarios: mensuales("2026-08", "2026-10", "600000") });
    expect(inf.datosPendientes.some((d) => d.includes("3 de 6"))).toBe(true);
  });
  it("valida datos de entrada", () => {
    expect(() => calcularLiquidacion({ ...base, salarios: [] })).toThrow();
    expect(() => calcularLiquidacion({ ...base, modalidadAlternativa: "despido_con_responsabilidad" })).toThrow();
  });
});
