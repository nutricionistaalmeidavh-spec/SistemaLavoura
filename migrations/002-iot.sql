CREATE TABLE IF NOT EXISTS iot_devices (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  protocol TEXT NOT NULL,
  manufacturer TEXT,
  model TEXT,
  gateway_id TEXT,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_seen_at TEXT,
  battery_level REAL,
  signal_strength REAL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS iot_device_capabilities (
  device_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  key TEXT NOT NULL,
  unit TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (device_id, kind, key),
  FOREIGN KEY (device_id) REFERENCES iot_devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iot_field_bindings (
  device_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  installed_at TEXT NOT NULL,
  removed_at TEXT,
  position_json TEXT,
  notes TEXT,
  PRIMARY KEY (device_id, field_id, installed_at),
  FOREIGN KEY (device_id) REFERENCES iot_devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iot_telemetry (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  quality TEXT NOT NULL DEFAULT 'good',
  sequence TEXT,
  raw_payload_hash TEXT,
  FOREIGN KEY (device_id) REFERENCES iot_devices(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_iot_telemetry_device_sequence
  ON iot_telemetry(device_id, sequence)
  WHERE sequence IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_iot_telemetry_device_metric_time
  ON iot_telemetry(device_id, metric, observed_at DESC);

CREATE TABLE IF NOT EXISTS iot_commands (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  command TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  acknowledged_at TEXT,
  failure_reason TEXT,
  FOREIGN KEY (device_id) REFERENCES iot_devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS iot_adapter_configs (
  id TEXT PRIMARY KEY,
  protocol TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  config_json TEXT NOT NULL DEFAULT '{}',
  secret_ref TEXT,
  updated_at TEXT NOT NULL
);
