import test from 'node:test';
import assert from 'node:assert/strict';
import {IOT_PERMISSIONS,IOT_ROLE_PERMISSIONS,canIoT,createIoTSecurityService} from '../src/iot/security.js';

test('IoT role defaults do not expose configuration to viewer',()=>{
  assert.equal(canIoT({roles:['viewer'],permission:IOT_PERMISSIONS.READ}),false);
  assert.equal(canIoT({roles:['viewer'],permission:IOT_PERMISSIONS.CONFIGURE}),false);
  assert.equal(canIoT({roles:['manager'],permission:IOT_PERMISSIONS.READ}),true);
  assert.equal(canIoT({roles:['manager'],permission:IOT_PERMISSIONS.CONFIGURE}),true);
});

test('iot:manage never grants iot:command implicitly',()=>{
  assert.ok(IOT_ROLE_PERMISSIONS.manager.includes('iot:manage'));
  assert.equal(IOT_ROLE_PERMISSIONS.manager.includes('iot:command'),false);
  assert.equal(canIoT({permissions:['iot:manage'],permission:'iot:command'}),false);
  assert.equal(canIoT({permissions:['iot:command'],permission:'iot:command'}),true);
});

test('admin wildcard can authorize IoT permissions',()=>{
  assert.equal(canIoT({roles:['admin'],permission:'iot:command'}),true);
});

test('security service authorizes before mutation and appends audit after success',async()=>{
  const order=[],audits=[];
  const service=createIoTSecurityService({
    authorize:async ({permission})=>{order.push(`authorize:${permission}`);return {id:'user-1'};},
    audit:async entry=>{order.push(`audit:${entry.action}`);audits.push(entry);}
  });
  const result=await service.runAudited({permission:'iot:configure',action:'iot.adapter.configure',actorId:'user-1',entityType:'iot_adapter',entityId:'mqtt-1',metadata:{protocol:'mqtt'}},async()=>{order.push('work');return {saved:true};});
  assert.deepEqual(result,{saved:true});
  assert.deepEqual(order,['authorize:iot:configure','work','audit:iot.adapter.configure']);
  assert.equal(audits[0].actorId,'user-1');
});

test('failed authorization prevents work and audit',async()=>{
  let worked=false,audited=false;
  const service=createIoTSecurityService({authorize:async()=>{throw new Error('forbidden');},audit:async()=>{audited=true;}});
  await assert.rejects(()=>service.runAudited({permission:'iot:command',action:'iot.command.request',actorId:'u',entityType:'iot_device',entityId:'pump'},async()=>{worked=true;}),/forbidden/);
  assert.equal(worked,false);assert.equal(audited,false);
});
