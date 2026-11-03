# Consulting Laboral Costa Rica

Aplicación de asesoría, investigación, cálculos y redacción en derecho laboral costarricense, para web y Android.

Plan y arquitectura: ver [docs/arquitectura.md](docs/arquitectura.md). Estado por fase y pendientes: [docs/estado.md](docs/estado.md).

## Estructura

| Ruta | Contenido |
| --- | --- |
| `apps/web` | Interfaz Next.js (exportación estática; se reutiliza en Android con Capacitor en la Fase 5) |
| `services/api` | Servidor API (Fastify): autenticación, sesiones, expedientes, salud de servicios. Única ubicación de claves externas |
| `packages/shared` | Tipos, esquemas de validación y catálogo de módulos compartidos |

## Requisitos

- Node.js 22 o superior
- pnpm 10 (`corepack enable`)

## Ejecución local

```bash
pnpm install
pnpm dev:api     # http://localhost:4000 — usa PostgreSQL embebido (PGlite) en services/api/data/
pnpm dev:web     # http://localhost:3000
```

Variables de entorno: copie `services/api/.env.example` y `apps/web/.env.example`. Sin `DATABASE_URL`, el servidor usa PGlite local, apto solo para desarrollo.

## Verificación

```bash
pnpm check       # tipos + pruebas + compilación (lo mismo que ejecuta la integración continua)
```

## Principios no negociables

- Ninguna función se presenta como operativa si solo tiene interfaz. Los módulos pendientes muestran su fase.
- Las claves de servicios externos residen solo en el servidor; nunca en el navegador ni en el APK.
- Ningún cambio de expediente sobrescribe otro en silencio: versiones conservadas y conflicto explícito (HTTP 409).
- La eliminación es recuperable (papelera).
- No se contratan servicios de pago ni se publica en tiendas sin autorización expresa del titular.
