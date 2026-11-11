# Estado del proyecto

Última actualización: 2026-11-11.

## Fase 0 — Fundaciones (esta entrega)

Implementado y probado:

- Monorepo pnpm con TypeScript estricto e integración continua (tipos, pruebas, compilación).
- Servidor API:
  - `GET /salud`: comprobación separada de servidor, base de datos, IA, búsqueda y fuentes. Lo no integrado se informa como `no_configurado`, nunca como operativo.
  - Cuentas y sesiones por dispositivo: registro, ingreso, salida, lista de sesiones abiertas, cierre de las demás sesiones. Contraseñas con scrypt; en base de datos solo se guarda el hash del token.
  - Expedientes por usuario con versiones conservadas, detección de conflicto entre dispositivos (409, sin sobrescritura), papelera y restauración, auditoría de acciones.
- Interfaz web: ingreso y registro, panel con los 12 apartados, navegación adaptable a teléfono y tableta, indicador de conexión del dispositivo y del servidor, expedientes con borrador local automático, resolución explícita de conflictos e historial de versiones, configuración con estado de servicios y sesiones.

Pruebas automatizadas: 4 en `packages/shared`, 10 en `services/api` (salud, autenticación, sesiones, versiones, conflictos, aislamiento entre usuarios, papelera).

## Fase 1 — Motor de cálculo (primera entrega: liquidación)

Implementado y probado (`packages/calc`, 28 pruebas):

- Antigüedad por calendario (ingreso y último día inclusive, sin días negativos en fin de mes).
- Preaviso (art. 28 CT) y cesantía (art. 29 CT, tabla y tope de ocho años) con base en el promedio de los últimos seis meses (art. 30 CT).
- Aguinaldo proporcional del 1 de diciembre a la terminación; vacaciones por saldo de días.
- Procedencia por modalidad de salida, sin asignar rubros por la sola etiqueta: pensión y mutuo acuerdo quedan «condicionados» y fuera del total procedente.
- Imputación de cada pago solo a su rubro; abonos sin imputar no se rebajan; pagos discutidos y modalidad controvertida generan escenarios.
- Clasificación del informe: cálculo completo, estimación provisional o escenario sujeto a decisión jurídica.
- API: `POST /calculos/liquidacion` y `GET /expedientes/:id/calculos` (cada recálculo se conserva con la versión del motor).
- Web: pantalla de calculadora que calcula en el dispositivo (funciona sin conexión), exporta CSV con fórmulas y guarda en expedientes.

### Verificación de normas

| Regla | Estado | Fuente consultada |
| --- | --- | --- |
| CT arts. 28, 29, 30, 31 | Verificada (2026-11-11) | Texto del Código publicado por el MTSS (incluye Ley 9343) |
| CT art. 83, art. 85 | Pendiente | SCIJ no permitió lectura automatizada; el PDF del MTSS legible llega hasta el art. 76 |
| CT arts. 153, 156, 157 (vacaciones) | Pendiente | Ídem |
| Ley 2412 (aguinaldo) | Pendiente | No se localizó texto oficial legible |
| Divisor 30, fracción de cesantía, vacaciones 1 día/mes | Criterio de cómputo configurable | — |

Mientras haya reglas pendientes, ningún informe se clasifica como «cálculo con datos completos».

## Pendiente

| Fase | Pendiente | Depende de |
| --- | --- | --- |
| 1 | Horas extra, feriados y descansos, diferencias salariales, art. 31 (plazo fijo); verificación de reglas pendientes | Texto oficial de los artículos pendientes |
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
