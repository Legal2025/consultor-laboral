-- Esquema inicial: usuarios, sesiones por dispositivo, expedientes versionados y auditoría.
CREATE TABLE IF NOT EXISTS usuarios (
  id            TEXT PRIMARY KEY,
  correo        TEXT NOT NULL UNIQUE,
  nombre        TEXT NOT NULL,
  hash_clave    TEXT NOT NULL,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sesiones (
  id            TEXT PRIMARY KEY,
  usuario_id    TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  hash_token    TEXT NOT NULL UNIQUE,
  dispositivo   TEXT NOT NULL,
  creada_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_uso    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en     TIMESTAMPTZ NOT NULL,
  revocada_en   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sesiones_usuario ON sesiones(usuario_id);

CREATE TABLE IF NOT EXISTS expedientes (
  id              TEXT PRIMARY KEY,
  usuario_id      TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  contenido       JSONB NOT NULL,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
  eliminado_en    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS expedientes_usuario ON expedientes(usuario_id);

-- Cada versión se conserva; nunca se sobrescribe una versión anterior.
CREATE TABLE IF NOT EXISTS expediente_versiones (
  expediente_id   TEXT NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL,
  contenido       JSONB NOT NULL,
  autor_id        TEXT NOT NULL REFERENCES usuarios(id),
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (expediente_id, version)
);

CREATE TABLE IF NOT EXISTS auditoria (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    TEXT,
  accion        TEXT NOT NULL,
  objeto        TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS migraciones (
  nombre        TEXT PRIMARY KEY,
  aplicada_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
