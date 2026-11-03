import { createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scrypt(clave: string, sal: Buffer, largo: number, opciones: typeof PARAMS): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(clave, sal, largo, opciones, (err, derivada) => (err ? reject(err) : resolve(derivada))),
  );
}

export async function hashearClave(clave: string): Promise<string> {
  const sal = randomBytes(16);
  const derivada = await scrypt(clave, sal, 64, PARAMS);
  return `scrypt$${PARAMS.N}$${sal.toString("base64")}$${derivada.toString("base64")}`;
}

export async function verificarClave(clave: string, almacenado: string): Promise<boolean> {
  const [alg, n, salB64, hashB64] = almacenado.split("$");
  if (alg !== "scrypt" || !n || !salB64 || !hashB64) return false;
  const esperado = Buffer.from(hashB64, "base64");
  const derivada = await scrypt(clave, Buffer.from(salB64, "base64"), esperado.length, { ...PARAMS, N: Number(n) });
  return derivada.length === esperado.length && timingSafeEqual(derivada, esperado);
}

/** Token opaco para el cliente; en base de datos solo se guarda su hash. */
export function nuevoToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const nuevoId = (): string => randomUUID();
