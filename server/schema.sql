PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 120),
  phone TEXT CHECK (phone IS NULL OR length(phone) <= 32),
  role TEXT NOT NULL CHECK (role IN ('farmer', 'buyer', 'retailer', 'restaurant', 'processor', 'ngo', 'administrator')),
  preferred_language TEXT NOT NULL CHECK (preferred_language IN ('en', 'te')),
  farm_or_business_name TEXT CHECK (farm_or_business_name IS NULL OR length(farm_or_business_name) <= 160),
  state TEXT CHECK (state IS NULL OR length(state) <= 100),
  district TEXT CHECK (district IS NULL OR length(district) <= 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_state_district_idx ON users (state, district);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS password_reset_expiry_idx ON password_reset_tokens (expires_at);
