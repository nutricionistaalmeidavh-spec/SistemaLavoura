CREATE TABLE IF NOT EXISTS crop_fields (id TEXT PRIMARY KEY, farm_unit_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, area_ha REAL NOT NULL);
CREATE TABLE IF NOT EXISTS crop_seasons (id TEXT PRIMARY KEY, production_period_id TEXT NOT NULL, crop TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS crop_season_fields (season_id TEXT NOT NULL, field_id TEXT NOT NULL, PRIMARY KEY (season_id, field_id));
CREATE TABLE IF NOT EXISTS crop_operations (id TEXT PRIMARY KEY, season_id TEXT NOT NULL, field_id TEXT NOT NULL, operation_type TEXT NOT NULL, occurred_at TEXT NOT NULL, payload_json TEXT);
