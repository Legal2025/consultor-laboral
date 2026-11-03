/**
 * Cliente del servidor API. Ninguna credencial de servicios externos vive en el cliente:
 * solo el token de sesión del usuario.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const CLAVE_TOKEN = "cl.token";

export function leerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN);
  } catch {
    return null;
  }
}

export function guardarToken(token: string | null) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token);
    else localStorage.removeItem(CLAVE_TOKEN);
  } catch {
    /* almacenamiento no disponible: la sesión dura lo que la pestaña */
  }
}

export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly datos?: Record<string, unknown>,
  ) {
    super(mensaje);
  }
  /** El servidor no fue alcanzado (sin conexión, servidor caído o bloqueado). */
  get sinConexion() {
    return this.estado === 0;
  }
}

export async function api<T>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown } = {}): Promise<T> {
  const token = leerToken();
  let r: Response;
  try {
    r = await fetch(`${API_URL}${ruta}`, {
      method: opciones.metodo ?? "GET",
      headers: {
        ...(opciones.cuerpo !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined,
    });
  } catch {
    throw new ErrorApi(0, "sin_conexion", "No se pudo contactar el servidor. Compruebe la conexión y reintente.");
  }
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && token) guardarToken(null);
    throw new ErrorApi(r.status, datos.error ?? "error", datos.mensaje ?? `Error ${r.status}`, datos);
  }
  return datos as T;
}
