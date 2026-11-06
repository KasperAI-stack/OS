-- HeyOtto Tasks: nøgle/værdi-lageret (samme nøgler som Netlify Blobs). Se worker/store.mts.
CREATE TABLE IF NOT EXISTS docs (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  metadata   TEXT,
  updated_at TEXT NOT NULL
);
