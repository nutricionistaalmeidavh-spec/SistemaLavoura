import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createStandaloneHost} from '../runtime/host.mjs';
import {createIoTRepository} from '../src/iot/repository.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

async function withHost(work){const dir=await mkdtemp(path.join(tmpdir(),'lavoura-iot-manage-'));const host=await createStandaloneHost({dataDir:dir});try{return await work(host);}finally{await host.close();await rm(dir,{recursive:true,force:true});}}
async function adminSession(host){const username='admin-iot',password='Senha-IoT-123!';await host.backend.bootstrap({username,password});const login=await host.backend.login({username,password});return {sessionId:login.session.id,token:login.token};}

test('IoT setup persists device, binding, adapter and rule',async()=>withHost(async host=>{
  const auth=await adminSession(host);
  const device=await host.backend.action({screenId:'iot',action:'saveDevice',auth,input:{name:'Sensor Solo 1',type:'sensor',protocol:'mqtt',status:'online',batteryLevel:88}});
  assert.ok(device.id);
  await host.backend.action({screenId:'iot',action:'bindField',auth,input:{deviceId:device.id,fieldId:'field-1',notes:'Talhão norte'}});
  await host.backend.action({screenId:'iot',action:'saveAdapterConfig',auth,input:{protocol:'mqtt',enabled:true,host:'192.168.1.20',port:1883,topic:'fazenda/solo',secretRef:'env:MQTT_PASSWORD'}});
  const rule=await host.backend.action({screenId:'iot',action:'saveRule',auth,input:{type:'battery',name:'Bateria crítica',threshold:20,hysteresis:5,minOccurrences:1,severity:'warning',deviceId:device.id,enabled:true}});
  assert.ok(rule.id);
  const snapshot=await host.backend.load({screenId:'iot',auth});
  assert.equal(snapshot.capabilities.configure,true);
  assert.equal(snapshot.devices.length,1);
  assert.equal(snapshot.devices[0].fieldId,'field-1');
  assert.equal(snapshot.integrations.length,1);
  assert.equal('secretRef' in snapshot.integrations[0],false);
  assert.equal(snapshot.rules.length,1);
}));

test('IoT rules create normal alerts without duplicate reopening',async()=>withHost(async host=>{
  const auth=await adminSession(host);
  const device=await host.backend.action({screenId:'iot',action:'saveDevice',auth,input:{name:'Estação 1',type:'weather',protocol:'modbus',status:'offline',batteryLevel:10}});
  await host.backend.action({screenId:'iot',action:'saveRule',auth,input:{type:'battery',name:'Bateria baixa',threshold:20,hysteresis:5,minOccurrences:1,severity:'warning',deviceId:device.id,enabled:true}});
  await host.backend.action({screenId:'iot',action:'saveRule',auth,input:{type:'offline',name:'Estação offline',minOccurrences:1,severity:'critical',deviceId:device.id,enabled:true}});
  const first=await host.backend.load({screenId:'iot',auth});
  assert.equal(first.alerts.length,2);
  const ids=first.alerts.map(item=>item.id).sort();
  await host.backend.load({screenId:'iot',auth});
  assert.deepEqual((await host.presentation.services.alerts.list()).filter(item=>item.metadata?.source==='iot').map(item=>item.id).sort(),ids);
  await host.backend.action({screenId:'overview',action:'dismissAlert',auth,input:{id:ids[0],reason:'ciente'}});
  await host.backend.load({screenId:'iot',auth});
  assert.equal((await host.presentation.services.alerts.get(ids[0])).status,'dismissed');
}));

test('threshold rule honors occurrences and hysteresis for new telemetry',async()=>withHost(async host=>{
  const auth=await adminSession(host);
  const device=await host.backend.action({screenId:'iot',action:'saveDevice',auth,input:{name:'Umidade T1',type:'soil',protocol:'mqtt',status:'online'}});
  await host.backend.action({screenId:'iot',action:'saveRule',auth,input:{type:'threshold',name:'Solo seco',metric:'soil.moisture',operator:'below',threshold:20,hysteresis:3,minOccurrences:2,severity:'warning',deviceId:device.id,enabled:true}});
  const db=new DatabaseSync(host.dbPath);const repo=createIoTRepository(db);
  const add=(id,value)=>repo.appendTelemetry({id,deviceId:device.id,metric:'soil.moisture',value,unit:'%',observedAt:`2026-09-20T12:0${id.slice(-1)}:00.000Z`,receivedAt:`2026-09-20T12:0${id.slice(-1)}:01.000Z`,quality:'good',sequence:id});
  add('r1',19);await host.backend.load({screenId:'iot',auth});assert.equal((await host.presentation.services.alerts.list()).filter(item=>item.metadata?.source==='iot').length,0);
  add('r2',18);await host.backend.load({screenId:'iot',auth});let alerts=(await host.presentation.services.alerts.list()).filter(item=>item.metadata?.source==='iot');assert.equal(alerts.length,1);assert.equal(alerts[0].status,'active');
  add('r3',22);await host.backend.load({screenId:'iot',auth});assert.equal((await host.presentation.services.alerts.get(alerts[0].id)).status,'active');
  add('r4',24);await host.backend.load({screenId:'iot',auth});assert.equal((await host.presentation.services.alerts.get(alerts[0].id)).status,'dismissed');db.close();
}));

test('IoT UI exposes human setup, rules and alerts without command controls or JSON editor',()=>{
  const source=read('web/iot/IoTWorkspace.jsx');
  for(const action of ['saveDevice','bindField','saveAdapterConfig','setAdapterEnabled','saveRule','removeRule'])assert.match(source,new RegExp(action));
  assert.match(source,/Configura[cç][aã]o/i);assert.match(source,/Regras de alerta/i);assert.match(source,/Alertas ativos/i);
  assert.doesNotMatch(source,/requestCommand|iot:command|JSON\.stringify\(.*config/);
});
