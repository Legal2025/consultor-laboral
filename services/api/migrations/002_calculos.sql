-- Cálculos guardados: cada recálculo crea un registro nuevo; los anteriores se conservan.
CREATE TABLE IF NOT EXISTS calculos (
  id              TEXT PRIMARY KEY,
  usuario_id      TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expediente_id   TEXT REFERENCES expedientes(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,
  version_motor   TEXT NOT NULL,
  datos           JSONB NOT NULL,
  informe         JSONB NOT NULL,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calculos_expediente ON calculos(expediente_id);
