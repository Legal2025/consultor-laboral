# Estado del proyecto

Última actualización: 2026-11-03.

## Fase 0 — Fundaciones (esta entrega)

Implementado y probado:

- Monorepo pnpm con TypeScript estricto e integración continua (tipos, pruebas, compilación).
- Servidor API:
  - `GET /salud`: comprobación separada de servidor, base de datos, IA, búsqueda y fuentes. Lo no integrado se informa como `no_configurado`, nunca como operativo.
  - Cuentas y sesiones por dispositivo: registro, ingreso, salida, lista de sesiones abiertas, cierre de las demás sesiones. Contraseñas con scrypt; en base de datos solo se guarda el hash del token.
  - Expedientes por usuario con versiones conservadas, detección de conflicto entre dispositivos (409, sin sobrescritura), papelera y restauración, auditoría de acciones.
- Interfaz web: ingreso y registro, panel con los 12 apartados, navegación adaptable a teléfono y tableta, indicador de conexión del dispositivo y del servidor, expedientes con borrador local automático, resolución explícita de conflictos e historial de versiones, configuración con estado de servicios y sesiones.

Pruebas automatizadas: 4 en `packages/shared`, 10 en `services/api` (salud, autenticación, sesiones, versiones, conflictos, aislamiento entre usuarios, papelera).

## Pendiente

| Fase | Pendiente | Depende de |
| --- | --- | --- |
| 1 | Motor de cálculo laboral con trazabilidad por rubro | — |
| 2 | Catálogo versionado de salarios mínimos y perfiles ocupacionales | Acceso a publicaciones del MTSS |
| 3 | IA, motor de investigación, asistente, robot rápido, leyes, jurisprudencia, doctrina, seguridad privada | Clave de API de IA (decisión pendiente) |
| 4 | Análisis documental con OCR y redactor | — |
| 5 | Proyecto Android (Capacitor), APK firmado, AAB, voz | Keystore de firma; dispositivos de prueba |
| 6 | Sincronización sin conexión completa, respaldos con restauración comprobada, consumo y límites de gasto | Alojamiento (autorización de costos) |

## Limitaciones conocidas de la Fase 0

- El token de sesión se guarda en `localStorage` del navegador; en Android se trasladará a almacenamiento seguro (Fase 5).
- El borrador local cubre la edición de expedientes; la cola de operaciones sin conexión para el resto de módulos llega en la Fase 6.
- No hay recuperación de contraseña por correo (requiere un servicio de envío de correo; pendiente de decisión).
- No hay despliegue: todo se ejecuta localmente hasta autorizar un proveedor de alojamiento.
