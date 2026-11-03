# Arquitectura

Documento completo con diagrama, plan por fases, servicios externos y riesgos:
https://claude.ai/artifact/RZqgyo8iuAd54EM8ueuMqD

## Resumen

- **Una base de código TypeScript.** Interfaz Next.js exportada como sitio estático; la misma compilación se empaqueta para Android con Capacitor (cámara, micrófono, «Compartir», biometría, archivos).
- **Servidor API propio.** Concentra autenticación, claves de servicios, límites de gasto y registro de consumo. Ningún cliente habla directamente con proveedores externos.
- **Servicios internos separados:** investigación (IA + búsqueda + lectura HTML/PDF con registro auditable), documentos y OCR, motor de cálculo determinista, datos y respaldo.
- **Datos:** PostgreSQL. Cada expediente conserva todas sus versiones; la edición exige la versión de origen y un conflicto se resuelve de forma explícita.
- **Motor de cálculo independiente de la IA:** la IA selecciona y explica reglas; el código calcula con aritmética exacta y deja base, período, fórmula y fundamento por rubro.

## Decisiones registradas

| Decisión | Motivo |
| --- | --- |
| Capacitor en lugar de app nativa separada | Un solo código de interfaz; acceso real a APIs nativas; APK y AAB estándar |
| Exportación estática de Next.js | Requisito de Capacitor; el servidor queda separado y sin estado de interfaz |
| Fastify + SQL explícito | Control total de consultas, versiones y transacciones; sin generación de código |
| PGlite en desarrollo y pruebas | PostgreSQL real embebido, sin instalar servicios; mismas consultas que producción |
| Tokens opacos con hash en base de datos | Permite listar y revocar sesiones por dispositivo |
