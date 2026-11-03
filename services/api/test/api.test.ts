import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { abrirPglite, migrar, type BaseDatos } from "../src/bd";
import { crearAplicacion } from "../src/aplicacion";
import { leerConfiguracion } from "../src/configuracion";

let bd: BaseDatos;
let app: FastifyInstance;

beforeAll(async () => {
  bd = await abrirPglite();
  await migrar(bd);
  app = await crearAplicacion(bd, leerConfiguracion({}));
});

afterAll(async () => {
  await app.close();
  await bd.cerrar();
});

async function registrar(correo: string) {
  const r = await app.inject({
    method: "POST",
    url: "/auth/registro",
    payload: { correo, nombre: "Lcda. Prueba", contrasena: "una-clave-segura" },
  });
  expect(r.statusCode).toBe(201);
  return r.json().token as string;
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

describe("salud", () => {
  it("informa cada componente por separado sin declarar operativos los no integrados", async () => {
    const r = await app.inject({ method: "GET", url: "/salud" });
    const s = r.json();
    expect(s.servidor.estado).toBe("operativo");
    expect(s.baseDatos.estado).toBe("operativo");
    expect(s.ia.estado).toBe("no_configurado");
    expect(s.busqueda.estado).toBe("no_configurado");
    expect(s.fuentes.estado).toBe("no_configurado");
  });
});

describe("autenticación y sesiones", () => {
  it("rechaza registro con datos inválidos y detalla campos", async () => {
    const r = await app.inject({ method: "POST", url: "/auth/registro", payload: { correo: "x", nombre: "A", contrasena: "corta" } });
    expect(r.statusCode).toBe(400);
    expect(r.json().campos.length).toBeGreaterThanOrEqual(3);
  });

  it("no permite registrar dos veces el mismo correo", async () => {
    await registrar("dup@ejemplo.cr");
    const r = await app.inject({
      method: "POST",
      url: "/auth/registro",
      payload: { correo: "DUP@ejemplo.cr", nombre: "Otro", contrasena: "una-clave-segura" },
    });
    expect(r.statusCode).toBe(409);
  });

  it("ingreso con contraseña errónea no revela si el correo existe", async () => {
    await registrar("ingreso@ejemplo.cr");
    const mala = await app.inject({ method: "POST", url: "/auth/ingreso", payload: { correo: "ingreso@ejemplo.cr", contrasena: "otra" } });
    const inexistente = await app.inject({ method: "POST", url: "/auth/ingreso", payload: { correo: "nadie@ejemplo.cr", contrasena: "otra" } });
    expect(mala.statusCode).toBe(401);
    expect(inexistente.statusCode).toBe(401);
    expect(mala.json().mensaje).toBe(inexistente.json().mensaje);
  });

  it("lista sesiones por dispositivo y cierra las demás", async () => {
    const t1 = await registrar("multi@ejemplo.cr");
    const ingreso = await app.inject({
      method: "POST",
      url: "/auth/ingreso",
      payload: { correo: "multi@ejemplo.cr", contrasena: "una-clave-segura", dispositivo: "Tableta Android" },
    });
    const t2 = ingreso.json().token as string;

    const sesiones = (await app.inject({ method: "GET", url: "/auth/sesiones", headers: auth(t2) })).json();
    expect(sesiones).toHaveLength(2);
    expect(sesiones.find((s: { actual: boolean }) => s.actual).dispositivo).toBe("Tableta Android");

    const cierre = await app.inject({ method: "POST", url: "/auth/sesiones/cerrar-otras", headers: auth(t2) });
    expect(cierre.json().cerradas).toBe(1);
    expect((await app.inject({ method: "GET", url: "/auth/yo", headers: auth(t1) })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/auth/yo", headers: auth(t2) })).statusCode).toBe(200);
  });

  it("la salida invalida el token", async () => {
    const t = await registrar("salida@ejemplo.cr");
    await app.inject({ method: "POST", url: "/auth/salida", headers: auth(t) });
    expect((await app.inject({ method: "GET", url: "/auth/yo", headers: auth(t) })).statusCode).toBe(401);
  });
});

describe("expedientes", () => {
  it("exige sesión", async () => {
    expect((await app.inject({ method: "GET", url: "/expedientes" })).statusCode).toBe(401);
  });

  it("versiona cambios y rechaza sobrescritura desde una versión desactualizada", async () => {
    const t = await registrar("versiones@ejemplo.cr");
    const creado = (
      await app.inject({ method: "POST", url: "/expedientes", headers: auth(t), payload: { titulo: "Despido de oficial de seguridad" } })
    ).json();
    expect(creado.version).toBe(1);
    expect(creado.perspectiva).toBe("neutral");

    const contenido = { ...creado, hechosDeclarados: "Ingreso el 3 de marzo; despido verbal." };
    const v2 = await app.inject({ method: "PUT", url: `/expedientes/${creado.id}`, headers: auth(t), payload: { version: 1, contenido } });
    expect(v2.statusCode).toBe(200);
    expect(v2.json().version).toBe(2);

    // Otro dispositivo intenta guardar sobre la versión 1.
    const conflicto = await app.inject({
      method: "PUT",
      url: `/expedientes/${creado.id}`,
      headers: auth(t),
      payload: { version: 1, contenido: { ...creado, notas: "cambio tardío" } },
    });
    expect(conflicto.statusCode).toBe(409);
    expect(conflicto.json().error).toBe("conflicto_version");
    expect(conflicto.json().vigente.version).toBe(2);

    const versiones = (await app.inject({ method: "GET", url: `/expedientes/${creado.id}/versiones`, headers: auth(t) })).json();
    expect(versiones.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(versiones[1].contenido.hechosDeclarados).toBe("");
  });

  it("no mezcla expedientes de usuarios distintos", async () => {
    const a = await registrar("a@ejemplo.cr");
    const b = await registrar("b@ejemplo.cr");
    const exp = (await app.inject({ method: "POST", url: "/expedientes", headers: auth(a), payload: { titulo: "Caso reservado" } })).json();
    expect((await app.inject({ method: "GET", url: `/expedientes/${exp.id}`, headers: auth(b) })).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/expedientes", headers: auth(b) })).json()).toHaveLength(0);
  });

  it("la eliminación es recuperable desde la papelera", async () => {
    const t = await registrar("papelera@ejemplo.cr");
    const exp = (await app.inject({ method: "POST", url: "/expedientes", headers: auth(t), payload: { titulo: "Caso a eliminar" } })).json();
    await app.inject({ method: "DELETE", url: `/expedientes/${exp.id}`, headers: auth(t) });
    expect((await app.inject({ method: "GET", url: "/expedientes", headers: auth(t) })).json()).toHaveLength(0);
    expect((await app.inject({ method: "GET", url: "/expedientes?papelera=1", headers: auth(t) })).json()).toHaveLength(1);
    const editar = await app.inject({ method: "PUT", url: `/expedientes/${exp.id}`, headers: auth(t), payload: { version: 1, contenido: exp } });
    expect(editar.json().error).toBe("en_papelera");
    const restaurado = await app.inject({ method: "POST", url: `/expedientes/${exp.id}/restaurar`, headers: auth(t) });
    expect(restaurado.json().eliminadoEn).toBeNull();
  });
});
