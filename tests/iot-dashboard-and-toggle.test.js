import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createStandaloneHost} from '../runtime/host.mjs';
import {createIoTRepository} from '../src/iot/repository.js';

async function setup(){const dataDir=await mkdtemp(join(tmpdir(),'lavoura-iot-dashboard-'));const host=await createStandaloneHost({dataDir});const password='Admin-IoT-Dashboard-2026!';await host.backend.bootstrap({username:'admin',password});const login=await host.backend.login({username:'admin',password});return {dataDir,host,auth:{sessionId:login.session.id,token:login.token}};}

test('dashboard refresh evaluates pending IoT observations without requiring prior IoT screen visit',async()=>{
  const {dataDir,host,auth}=await setup();
  try{
    const device=await host.backend.action({screenId:'iot',action:'saveDevice',auth,input:{name:'Sensor Dashboard',type:'soil',protocol:'mqtt',status:'online'}});
    await host.backend.action({screenId:'iot',action:'saveRule',auth,input:{type:'threshold',name:'Solo seco no dashboard',metric:'soil.moisture',operator:'below',threshold:20,hysteresis:3,minOccurrences:1,severity:'warning',deviceId:device.id,enabled:true}});
    const db=new DatabaseSync(host.dbPath);const repo=createIoTRepository(db);repo.appendTelemetry({id:'dashboard-reading',deviceId:device.id,metric:'soil.moisture',value:15,unit:'%',observedAt:'2026-09-20T14:00:00.000Z',receivedAt:'2026-09-20T14:00:01.000Z',quality:'good',sequence:1});db.close();
    const overview=await host.backend.load({screenId:'overview',auth});
    assert.ok(overview.alerts.some(alert=>alert.metadata?.source==='iot'&&alert.title==='Solo seco no dashboard'));
  }finally{await host.close();await rm(dataDir,{recursive:true,force:true});}
});

test('adapter enable toggle preserves existing connection settings and credential reference',async()=>{
  const {dataDir,host,auth}=await setup();
  try{
    await host.backend.action({screenId:'iot',action:'saveAdapterConfig',auth,input:{id:'mqtt-fazenda',protocol:'mqtt',enabled:true,host:'192.168.50.10',port:1883,topic:'fazenda/telemetria',credentialRef:'env:MQTT_FAZENDA'}});
    await host.backend.action({screenId:'iot',action:'setAdapterEnabled',auth,input:{id:'mqtt-fazenda',enabled:false}});
    const db=new DatabaseSync(host.dbPath,{readOnly:true});const config=createIoTRepository(db).listAdapterConfigs().find(item=>item.id==='mqtt-fazenda');db.close();
    assert.equal(config.enabled,false);assert.equal(config.config.host,'192.168.50.10');assert.equal(config.config.topic,'fazenda/telemetria');assert.equal(config.secretRef,'env:MQTT_FAZENDA');
    const snapshot=await host.backend.load({screenId:'iot',auth});assert.equal(snapshot.integrations.find(item=>item.id==='mqtt-fazenda').enabled,false);
  }finally{await host.close();await rm(dataDir,{recursive:true,force:true});}
});
