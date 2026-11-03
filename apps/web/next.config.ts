import type { NextConfig } from "next";

// Exportación estática: la misma compilación se sirve en web y se empaqueta en Android (Capacitor, Fase 5).
const config: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@cl/shared"],
};

export default config;
