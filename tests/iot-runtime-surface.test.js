import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createStandaloneHost} from '../runtime/host.mjs';
import {createRpcBackend} from '../runtime/backend.mjs';
import {SECURITY_POLICY,PRESENTATION_ACCESS} from '../src/security.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const adminPassword=['Admin','IoT','2026!'].join('-');

async function withHost(work){
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-iot-runtime-'));
  const host=await createStandaloneHost({dataDir});
  try{return await work(host);}finally{await host.close().catch(()=>{});await rm(dataDir,{recursive:true,force:true}).catch(()=>{});}
}
async function login(host,username,password){const result=await host.backend.login({username,password});return {sessionId:result.session.id,token:result.token};}

test('IoT is a virtual optional screen protected by the existing RBAC policy',()=>{
  assert.equal(PRESENTATION_ACCESS.screens.iot.read,'iot:read');
  assert.ok(SECURITY_POLICY.manager.includes('iot:read'));
  assert.ok(SECURITY_POLICY['field-operator'].includes('iot:read'));
  assert.ok(SECURITY_POLICY.warehouse.includes('iot:read'));
  assert.equal(SECURITY_POLICY.viewer.includes('iot:read'),false);
});

test('desktop host exposes persisted IoT devices telemetry and sanitized integration state',async()=>withHost(async host=>{
  await host.backend.bootstrap({username:'admin',password:adminPassword});
  const auth=await login(host,'admin',adminPassword);
  const db=new DatabaseSync(host.dbPath);
  try{
    db.exec(`
      INSERT INTO iot_devices(id,name,type,protocol,status,battery_level,signal_strength,metadata_json)
      VALUES('soil-1','Sensor Solo 1','soil-sensor','mqtt','online',88,-61,'{}');
      INSERT INTO iot_field_bindings(device_id,field_id,installed_at,notes)
      VALUES('soil-1','field-1','2026-09-20T12:00:00.000Z','Talhão monitorado');
      INSERT INTO iot_telemetry(id,device_id,metric,value,unit,observed_at,received_at,quality,sequence)
      VALUES('reading-1','soil-1','soil.moisture',31.5,'%','2026-09-20T12:10:00.000Z','2026-09-20T12:10:01.000Z','good','1');
      INSERT INTO iot_adapter_configs(id,protocol,enabled,config_json,secret_ref,updated_at)
      VALUES('mqtt-local','mqtt',1,'{"host":"broker.local"}','secret://mqtt','2026-09-20T12:00:00.000Z');
    `);
  }finally{db.close();}
  const meta=await host.backend.describe(auth);
  assert.ok(meta.navigation.some(item=>item.id==='iot'));
  const snapshot=await host.backend.load({screenId:'iot',auth});
  assert.equal(snapshot.available,true);
  assert.equal(snapshot.devices[0].name,'Sensor Solo 1');
  assert.equal(snapshot.devices[0].fieldId,'field-1');
  assert.equal(snapshot.telemetry[0].metric,'soil.moisture');
  assert.equal(snapshot.integrations[0].protocol,'mqtt');
  assert.equal('secretRef' in snapshot.integrations[0],false);
  assert.equal('config' in snapshot.integrations[0],false);
}));

test('IoT stays visible as optional capability without a desktop provider and returns an honest empty state',async()=>withHost(async host=>{
  await host.backend.bootstrap({username:'admin',password:adminPassword});
  const auth=await login(host,'admin',adminPassword);
  const backend=createRpcBackend({presentation:host.presentation});
  const meta=await backend.describe(auth);
  assert.ok(meta.navigation.some(item=>item.id==='iot'));
  const snapshot=await backend.load({screenId:'iot',auth});
  assert.equal(snapshot.available,false);
  assert.deepEqual(snapshot.devices,[]);
  assert.deepEqual(snapshot.telemetry,[]);
  assert.deepEqual(snapshot.integrations,[]);
}));

test('IoT UI is wired into the main runtime with a dedicated icon and no raw configuration editor',()=>{
  const runtime=read('web/ui/runtime.jsx');
  assert.match(runtime,/IoTWorkspace/);
  assert.match(runtime,/iot:IoTWorkspace/);
  const workspace=read('web/iot/IoTWorkspace.jsx');
  assert.match(workspace,/data/);
  assert.match(workspace,/Integrações opcionais/);
  assert.match(workspace,/desktop/i);
  assert.doesNotMatch(workspace,/secretRef|config_json|JSON de entrada|action-json/);
  const icons=read('web/ui/icons.jsx');
  assert.match(icons,/radio:/);
});
