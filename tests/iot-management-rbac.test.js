import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';

const password=label=>`${label}-IoT-2026!`;
async function login(host,username,pass){const result=await host.backend.login({username,password:pass});return {sessionId:result.session.id,token:result.token};}

test('manager can configure IoT while field operator remains read-only',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-iot-rbac-'));
  const host=await createStandaloneHost({dataDir});
  try{
    await host.backend.bootstrap({username:'admin',password:password('Admin')});
    const admin=await login(host,'admin',password('Admin'));
    await host.backend.action({screenId:'admin',action:'createUser',auth:admin,input:{username:'gestor-iot',password:password('Gestor'),roles:['manager'],active:true}});
    await host.backend.action({screenId:'admin',action:'createUser',auth:admin,input:{username:'campo-iot',password:password('Campo'),roles:['field-operator'],active:true}});
    const manager=await login(host,'gestor-iot',password('Gestor'));
    const fieldOperator=await login(host,'campo-iot',password('Campo'));
    const managerSnapshot=await host.backend.load({screenId:'iot',auth:manager});
    const fieldSnapshot=await host.backend.load({screenId:'iot',auth:fieldOperator});
    assert.equal(managerSnapshot.capabilities.configure,true);
    assert.equal(fieldSnapshot.capabilities.configure,false);
    const created=await host.backend.action({screenId:'iot',action:'saveDevice',auth:manager,input:{name:'Sensor Gestor',type:'sensor',protocol:'mqtt'}});
    assert.ok(created.id);
    await assert.rejects(()=>host.backend.action({screenId:'iot',action:'saveDevice',auth:fieldOperator,input:{name:'Sensor Negado',type:'sensor',protocol:'mqtt'}}),error=>error?.code==='FORBIDDEN');
  }finally{await host.close();await rm(dataDir,{recursive:true,force:true});}
});
