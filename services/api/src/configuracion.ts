export interface Configuracion {
  puerto: number;
  host: string;
  /** Si no se indica, se usa PGlite (PostgreSQL embebido) en `rutaDatosLocal`. */
  databaseUrl?: string;
  rutaDatosLocal?: string;
  origenesPermitidos: string[];
  duracionSesionDias: number;
  claveIa?: string;
  claveBusqueda?: string;
}

export function leerConfiguracion(env: NodeJS.ProcessEnv = process.env): Configuracion {
  const origenes = (env.ORIGENES_PERMITIDOS ?? "http://localhost:3000,capacitor://localhost,https://localhost")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return {
    puerto: Number(env.PUERTO ?? env.PORT ?? 4000),
    host: env.HOST ?? "0.0.0.0",
    databaseUrl: env.DATABASE_URL || undefined,
    rutaDatosLocal: env.RUTA_DATOS_LOCAL ?? "./data/pglite",
    origenesPermitidos: origenes,
    duracionSesionDias: Number(env.DURACION_SESION_DIAS ?? 30),
    claveIa: env.ANTHROPIC_API_KEY || undefined,
    claveBusqueda: env.CLAVE_BUSQUEDA || undefined,
  };
}
