import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/servidor.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  // @cl/shared se distribuye como fuente TypeScript: se incluye en el paquete compilado.
  noExternal: ["@cl/shared", "@cl/calc"],
});
