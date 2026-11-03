/** Nombre legible del dispositivo para la lista de sesiones (no se usa para identificar al usuario). */
export function nombreDispositivo(ua: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): string {
  const so = /Android/.test(ua)
    ? /Mobile/.test(ua)
      ? "Teléfono Android"
      : "Tableta Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Dispositivo";
  const nav = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "navegador";
  return `${so} · ${nav}`;
}
