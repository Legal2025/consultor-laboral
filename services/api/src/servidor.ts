import { mkdir } from "node:fs/promises";
import { abrirPglite, abrirPostgres, migrar } from "./bd";
import { crearAplicacion } from "./aplicacion";
import { leerConfiguracion } from "./configuracion";

const config = leerConfiguracion();

let bd;
if (config.databaseUrl) {
  bd = await abrirPostgres(config.databaseUrl);
} else {
  await mkdir(config.rutaDatosLocal!, { recursive: true });
  bd = await abrirPglite(config.rutaDatosLocal);
  console.warn(`Sin DATABASE_URL: se usa PostgreSQL embebido (PGlite) en ${config.rutaDatosLocal}. Solo para desarrollo.`);
}

const aplicadas = await migrar(bd);
if (aplicadas.length) console.log(`Migraciones aplicadas: ${aplicadas.join(", ")}`);

const app = await crearAplicacion(bd, config, true);
await app.listen({ port: config.puerto, host: config.host });

for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.on(senal, async () => {
    await app.close();
    await bd.cerrar();
    process.exit(0);
  });
}
