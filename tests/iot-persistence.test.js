import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createIoTRepository} from '../src/iot/repository.js';
import {createDevice,createTelemetryReading} from '../src/iot/domain.js';

const migration=readFileSync(fileURLToPath(new URL('../migrations/002-iot.sql',import.meta.url)),'utf8');
const openDb=()=>{const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;');return db;};

test('002-iot migration is additive on a legacy-compatible database',()=>{
  const db=openDb();
  db.exec("CREATE TABLE customer_data(id TEXT PRIMARY KEY,value TEXT); INSERT INTO customer_data VALUES('legacy','preserve-me');");
  db.exec(migration);
  const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'iot_%' ORDER BY name").all().map(r=>r.name);
  assert.deepEqual(tables,['iot_adapter_configs','iot_commands','iot_device_capabilities','iot_devices','iot_field_bindings','iot_telemetry']);
  assert.equal(db.prepare("SELECT value FROM customer_data WHERE id='legacy'").get().value,'preserve-me');
  db.close();
});

test('repository saves devices, bindings and adapter configuration',()=>{
  const db=openDb();db.exec(migration);const repo=createIoTRepository(db);
  const device=createDevice({id:'soil-1',name:'Solo 1',type:'soil-sensor',protocol:'mock',status:'online',metadata:{plot:'A'}});
  repo.saveDevice(device);
  assert.equal(repo.listDevices()[0].id,'soil-1');
  repo.bindField({deviceId:'soil-1',fieldId:'field-7',installedAt:'2026-09-19T20:00:00.000Z',position:{lat:-21,lng:-47},notes:'20cm'});
  assert.equal(repo.listFieldBindings({deviceId:'soil-1'}).length,1);
  repo.saveAdapterConfig({id:'mock-main',protocol:'mock',enabled:true,config:{intervalMs:1000},secretRef:null,updatedAt:'2026-09-19T20:00:00.000Z'});
  assert.deepEqual(repo.listAdapterConfigs().map(x=>x.id),['mock-main']);
  db.close();
});

test('appendTelemetry preserves history and is idempotent by deviceId plus sequence',()=>{
  const db=openDb();db.exec(migration);const repo=createIoTRepository(db);
  repo.saveDevice(createDevice({id:'soil-1',name:'Solo 1',type:'soil-sensor',protocol:'mock'}));
  const first=createTelemetryReading({id:'r1',deviceId:'soil-1',metric:'soil.moisture',value:20,unit:'%',observedAt:'2026-09-19T20:00:00Z',receivedAt:'2026-09-19T20:00:01Z',sequence:7});
  const duplicate=createTelemetryReading({...first,id:'r2',value:99});
  const second=createTelemetryReading({id:'r3',deviceId:'soil-1',metric:'soil.moisture',value:21,unit:'%',observedAt:'2026-09-19T20:01:00Z',receivedAt:'2026-09-19T20:01:01Z',sequence:8});
  assert.equal(repo.appendTelemetry(first).inserted,true);
  assert.equal(repo.appendTelemetry(duplicate).inserted,false);
  assert.equal(repo.appendTelemetry(second).inserted,true);
  const rows=repo.latestTelemetry({deviceId:'soil-1',metric:'soil.moisture',limit:10});
  assert.equal(rows.length,2);
  assert.deepEqual(rows.map(r=>r.value),[21,20]);
  db.close();
});
