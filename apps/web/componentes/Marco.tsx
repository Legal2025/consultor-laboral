"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { MODULOS, type Modulo } from "@cl/shared";
import { useSesion } from "@/lib/sesion";
import { EstadoConexion } from "./EstadoConexion";

export function rutaModulo(m: Modulo): string {
  if (m.slug === "expedientes") return "/expedientes/";
  if (m.slug === "configuracion") return "/configuracion/";
  return `/modulos/${m.slug}/`;
}

/** Estructura común: barra superior, navegación de los 12 apartados y contenido. Exige sesión. */
export function Marco({ children }: { children: ReactNode }) {
  const { usuario, cargando, aviso, salir } = useSesion();
  const router = useRouter();
  const ruta = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    if (!cargando && !usuario && !aviso) router.replace("/ingresar/");
  }, [cargando, usuario, aviso, router]);

  useEffect(() => setMenuAbierto(false), [ruta]);

  if (cargando) return <p className="centrado">Verificando sesión…</p>;
  if (!usuario) {
    return aviso ? (
      <div className="centrado">
        <p>{aviso}</p>
        <button onClick={() => location.reload()}>Reintentar</button>
      </div>
    ) : null;
  }

  return (
    <div className="marco">
      <header className="barra">
        <button className="boton-menu" aria-label="Abrir menú" aria-expanded={menuAbierto} onClick={() => setMenuAbierto((v) => !v)}>
          ☰
        </button>
        <Link href="/" className="marca">
          Consulting Laboral <span>Costa Rica</span>
        </Link>
        <EstadoConexion />
        <span className="usuario">{usuario.nombre}</span>
        <button className="secundario" onClick={() => salir().then(() => router.replace("/ingresar/"))}>
          Salir
        </button>
      </header>
      <nav className={`lateral ${menuAbierto ? "abierto" : ""}`} aria-label="Apartados">
        <ol>
          {MODULOS.map((m) => {
            const href = rutaModulo(m);
            return (
              <li key={m.slug}>
                <Link href={href} aria-current={ruta?.startsWith(href) ? "page" : undefined}>
                  <span className="num">{m.numero}</span>
                  {m.titulo}
                  {m.estado === "en_construccion" && <span className="etiqueta">Fase {m.fase}</span>}
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>
      <main className="contenido">{children}</main>
    </div>
  );
}
