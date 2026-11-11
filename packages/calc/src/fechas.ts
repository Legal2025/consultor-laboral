/** Fechas civiles en formato AAAA-MM-DD, sin horas ni zonas horarias. */

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface FechaCivil {
  a: number;
  m: number; // 1-12
  d: number;
}

export function leerFecha(iso: string): FechaCivil {
  const r = RE_FECHA.exec(iso);
  if (!r) throw new Error(`Fecha no válida: ${iso}`);
  const f = { a: Number(r[1]), m: Number(r[2]), d: Number(r[3]) };
  if (f.m < 1 || f.m > 12 || f.d < 1 || f.d > diasDelMes(f.a, f.m)) throw new Error(`Fecha no válida: ${iso}`);
  return f;
}

export function diasDelMes(a: number, m: number): number {
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export const aIso = (f: FechaCivil) =>
  `${String(f.a).padStart(4, "0")}-${String(f.m).padStart(2, "0")}-${String(f.d).padStart(2, "0")}`;

export function sumarDia(f: FechaCivil): FechaCivil {
  if (f.d < diasDelMes(f.a, f.m)) return { ...f, d: f.d + 1 };
  if (f.m < 12) return { a: f.a, m: f.m + 1, d: 1 };
  return { a: f.a + 1, m: 1, d: 1 };
}

export function sumarMeses(f: FechaCivil, n: number): FechaCivil {
  const total = f.a * 12 + (f.m - 1) + n;
  const a = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { a, m, d: Math.min(f.d, diasDelMes(a, m)) };
}

export function compararFechas(x: FechaCivil, y: FechaCivil): number {
  return x.a - y.a || x.m - y.m || x.d - y.d;
}

export interface Antiguedad {
  años: number;
  meses: number;
  dias: number;
  /** Meses completos totales (años × 12 + meses). */
  mesesTotales: number;
  /** Días naturales de la relación, contando el día de ingreso y el último día laborado. */
  diasNaturales: number;
}

/**
 * Antigüedad entre el día de ingreso y el último día laborado, ambos inclusive.
 * Se calcula por calendario: del ingreso al día siguiente del último laborado.
 */
export function calcularAntiguedad(ingresoIso: string, ultimoDiaIso: string): Antiguedad {
  const ini = leerFecha(ingresoIso);
  const ult = leerFecha(ultimoDiaIso);
  if (compararFechas(ult, ini) < 0) throw new Error("La fecha de terminación es anterior a la de ingreso.");
  const fin = sumarDia(ult);
  const utc = (f: FechaCivil) => Date.UTC(f.a, f.m - 1, f.d);
  // Mayor número de meses completos k tal que ingreso + k meses <= fin
  // (si el día no existe en el mes de llegada, se toma el último día de ese mes).
  let k = (fin.a - ini.a) * 12 + (fin.m - ini.m);
  while (k > 0 && compararFechas(sumarMeses(ini, k), fin) > 0) k--;
  const ancla = sumarMeses(ini, k);
  const dias = Math.round((utc(fin) - utc(ancla)) / 86_400_000);
  const diasNaturales = Math.round((utc(fin) - utc(ini)) / 86_400_000);
  return { años: Math.floor(k / 12), meses: k % 12, dias, mesesTotales: k, diasNaturales };
}

export function describirAntiguedad(a: Antiguedad): string {
  const p = (n: number, s: string, pl: string) => `${n} ${n === 1 ? s : pl}`;
  return `${p(a.años, "año", "años")}, ${p(a.meses, "mes", "meses")} y ${p(a.dias, "día", "días")}`;
}

/** Periodo mensual AAAA-MM. */
export const periodoDe = (f: FechaCivil) => `${String(f.a).padStart(4, "0")}-${String(f.m).padStart(2, "0")}`;
