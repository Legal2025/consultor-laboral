import { describe, expect, it } from "vitest";
import { MODULOS, moduloPorSlug } from "./modulos";
import { contenidoExpedienteSchema } from "./esquemas";

describe("catálogo de módulos", () => {
  it("contiene los doce apartados numerados sin repetición", () => {
    expect(MODULOS).toHaveLength(12);
    expect(new Set(MODULOS.map((m) => m.numero)).size).toBe(12);
    expect(new Set(MODULOS.map((m) => m.slug)).size).toBe(12);
  });
  it("busca por slug", () => {
    expect(moduloPorSlug("calculadora")?.numero).toBe(6);
    expect(moduloPorSlug("inexistente")).toBeUndefined();
  });
});

describe("esquema de expediente", () => {
  it("aplica perspectiva neutral por defecto", () => {
    const r = contenidoExpedienteSchema.parse({ titulo: "Despido de guarda" });
    expect(r.perspectiva).toBe("neutral");
  });
  it("rechaza títulos vacíos", () => {
    expect(contenidoExpedienteSchema.safeParse({ titulo: " " }).success).toBe(false);
  });
});
