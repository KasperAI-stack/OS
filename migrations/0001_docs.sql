-- HeyOtto Tasks: nøgle/værdi-lageret (én række pr. nøgle). Se worker/store.mts.
CREATE TABLE IF NOT EXISTS docs (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  metadata   TEXT,
  updated_at TEXT NOT NULL
);
