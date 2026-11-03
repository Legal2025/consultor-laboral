import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** Interfaz mínima común a PostgreSQL (pg) y PGlite. */
export interface BaseDatos {
  consulta<T = Record<string, unknown>>(sql: string, parametros?: unknown[]): Promise<T[]>;
  transaccion<R>(fn: (bd: BaseDatos) => Promise<R>): Promise<R>;
  cerrar(): Promise<void>;
}

export async function abrirPglite(ruta?: string): Promise<BaseDatos> {
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = ruta ? new PGlite(ruta) : new PGlite();
  await pg.waitReady;
  const envolver = (q: { query: typeof pg.query }): BaseDatos => ({
    async consulta(sql, parametros) {
      const r = await q.query(sql, parametros ?? []);
      return r.rows as never[];
    },
    transaccion: (fn) => pg.transaction((tx) => fn(envolver(tx))),
    cerrar: () => pg.close(),
  });
  return envolver(pg);
}

export async function abrirPostgres(url: string): Promise<BaseDatos> {
  const { default: pgmod } = await import("pg");
  const pool = new pgmod.Pool({ connectionString: url });
  const base: BaseDatos = {
    async consulta(sql, parametros) {
      const r = await pool.query(sql, parametros ?? []);
      return r.rows;
    },
    async transaccion(fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query("BEGIN");
        const tx: BaseDatos = {
          consulta: async (sql, p) => (await cliente.query(sql, p ?? [])).rows,
          transaccion: (f) => f(tx),
          cerrar: async () => {},
        };
        const r = await fn(tx);
        await cliente.query("COMMIT");
        return r;
      } catch (e) {
        await cliente.query("ROLLBACK");
        throw e;
      } finally {
        cliente.release();
      }
    },
    cerrar: () => pool.end(),
  };
  return base;
}

function directorioMigraciones(): string {
  const aqui = path.dirname(fileURLToPath(import.meta.url));
  // En desarrollo: src/../migrations ; compilado: dist/migrations
  return path.basename(aqui) === "dist" ? path.join(aqui, "migrations") : path.join(aqui, "..", "migrations");
}

export async function migrar(bd: BaseDatos, dir = directorioMigraciones()): Promise<string[]> {
  await bd.consulta(
    "CREATE TABLE IF NOT EXISTS migraciones (nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now())",
  );
  const archivos = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const aplicadas = new Set(
    (await bd.consulta<{ nombre: string }>("SELECT nombre FROM migraciones")).map((r) => r.nombre),
  );
  const nuevas: string[] = [];
  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    const sql = await readFile(path.join(dir, archivo), "utf8");
    await bd.transaccion(async (tx) => {
      for (const sentencia of sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) {
        await tx.consulta(sentencia);
      }
      await tx.consulta("INSERT INTO migraciones (nombre) VALUES ($1)", [archivo]);
    });
    nuevas.push(archivo);
  }
  return nuevas;
}
