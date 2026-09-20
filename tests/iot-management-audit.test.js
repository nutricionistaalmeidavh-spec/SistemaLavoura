import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';

test('IoT setup mutations are audited without credential material',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-iot-audit-'));
  const host=await createStandaloneHost({dataDir});
  try{
    const password='Admin-IoT-Audit-2026!';
    await host.backend.bootstrap({username:'admin',password});
    const login=await host.backend.login({username:'admin',password});
    const auth={sessionId:login.session.id,token:login.token};
    await host.backend.action({screenId:'iot',action:'saveDevice',auth,input:{name:'Sensor Auditado',type:'sensor',protocol:'mqtt'}});
    await host.backend.action({screenId:'iot',action:'saveAdapterConfig',auth,input:{protocol:'mqtt',enabled:true,host:'192.168.10.20',port:1883,credentialRef:'env:CREDENCIAL_TESTE'}});
    const audit=await host.presentation.services.security.listAudit(auth);
    for(const action of ['iot.saveDevice:attempt','iot.saveDevice:success','iot.saveAdapterConfig:attempt','iot.saveAdapterConfig:success'])assert.ok(audit.some(entry=>entry.action===action),`missing audit action ${action}`);
    const serialized=JSON.stringify(audit.filter(entry=>entry.action.startsWith('iot.')));
    assert.doesNotMatch(serialized,/192\.168\.10\.20|CREDENCIAL_TESTE|credentialRef/i);
  }finally{await host.close();await rm(dataDir,{recursive:true,force:true});}
});
