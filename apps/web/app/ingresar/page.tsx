"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api, ErrorApi } from "@/lib/api";
import { useSesion, type Usuario } from "@/lib/sesion";
import { nombreDispositivo } from "@/lib/dispositivo";

type Modo = "ingreso" | "registro";

export default function Ingresar() {
  const { usuario, ingresar } = useSesion();
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("ingreso");
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (usuario) router.replace("/");
  }, [usuario, router]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r =
        modo === "ingreso"
          ? await api<{ token: string; usuario: Usuario }>("/auth/ingreso", { metodo: "POST", cuerpo: { correo, contrasena, dispositivo: nombreDispositivo() } })
          : await api<{ token: string; usuario: Usuario }>("/auth/registro", { metodo: "POST", cuerpo: { correo, nombre, contrasena, dispositivo: nombreDispositivo() } });
      ingresar(r.token, r.usuario);
      router.replace("/");
    } catch (err) {
      const e2 = err as ErrorApi;
      const campos = (e2.datos?.campos as { mensaje: string }[] | undefined)?.map((c) => c.mensaje).join(" ");
      setError(campos || e2.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="centrado" style={{ textAlign: "left" }}>
      <h1>Consulting Laboral Costa Rica</h1>
      <p className="meta">{modo === "ingreso" ? "Inicie sesión con su cuenta." : "Cree una cuenta para web, teléfono y tableta."}</p>
      <form onSubmit={enviar} className="tarjeta" noValidate>
        <label htmlFor="correo">Correo</label>
        <input id="correo" type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
        {modo === "registro" && (
          <>
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          </>
        )}
        <label htmlFor="contrasena">
          Contraseña {modo === "registro" && <span className="ayuda">(mínimo 10 caracteres)</span>}
        </label>
        <input
          id="contrasena"
          type="password"
          autoComplete={modo === "ingreso" ? "current-password" : "new-password"}
          value={contrasena}
          onChange={(e) => setContrasena(e.target.value)}
          required
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="fila" style={{ marginTop: "1rem" }}>
          <button type="submit" disabled={enviando}>
            {enviando ? "Enviando…" : modo === "ingreso" ? "Ingresar" : "Crear cuenta"}
          </button>
          <button
            type="button"
            className="secundario"
            onClick={() => {
              setModo(modo === "ingreso" ? "registro" : "ingreso");
              setError(null);
            }}
          >
            {modo === "ingreso" ? "Crear una cuenta" : "Ya tengo cuenta"}
          </button>
        </div>
      </form>
    </div>
  );
}
