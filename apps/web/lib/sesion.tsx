"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ErrorApi, guardarToken, leerToken } from "./api";

export interface Usuario {
  id: string;
  correo: string;
  nombre: string;
}

interface EstadoSesion {
  usuario: Usuario | null;
  cargando: boolean;
  /** Mensaje si no se pudo verificar la sesión por falta de conexión. */
  aviso: string | null;
  ingresar: (token: string, usuario: Usuario) => void;
  salir: () => Promise<void>;
}

const Contexto = createContext<EstadoSesion | null>(null);

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!leerToken()) {
      setCargando(false);
      return;
    }
    api<Usuario>("/auth/yo")
      .then(setUsuario)
      .catch((e: ErrorApi) => {
        if (e.sinConexion) setAviso(e.message);
      })
      .finally(() => setCargando(false));
  }, []);

  const ingresar = useCallback((token: string, u: Usuario) => {
    guardarToken(token);
    setUsuario(u);
    setAviso(null);
  }, []);

  const salir = useCallback(async () => {
    try {
      await api("/auth/salida", { metodo: "POST" });
    } catch {
      /* si no hay conexión, se descarta el token localmente igualmente */
    }
    guardarToken(null);
    setUsuario(null);
  }, []);

  return <Contexto.Provider value={{ usuario, cargando, aviso, ingresar, salir }}>{children}</Contexto.Provider>;
}

export function useSesion(): EstadoSesion {
  const c = useContext(Contexto);
  if (!c) throw new Error("useSesion fuera de ProveedorSesion");
  return c;
}
