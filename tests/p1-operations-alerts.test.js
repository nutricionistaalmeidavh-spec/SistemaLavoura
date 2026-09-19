import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';
import {FIELD_OPERATION_WORKFLOW,startFieldOperation,completeFieldOperation} from '../src/operations.js';
import {createCropAlertService} from '../src/alerts.js';

const password='Qa-P1-Alerts-2026!';
async function withHost(work){const root=await mkdtemp(join(tmpdir(),'agro-lavoura-p1-alerts-'));const host=await createStandaloneHost({dataDir:root});try{return await work(host);}finally{await host.close().catch(()=>{});await rm(root,{recursive:true,force:true}).catch(()=>{});}}
async function admin(host){await host.backend.bootstrap({username:'alerts-admin',password});const login=await host.backend.login({username:'alerts-admin',password});return{sessionId:login.session.id,token:login.token};}

test('field operation workflow exposes agricultural state machine and preserves invalid transition errors',()=>{
  assert.deepEqual(FIELD_OPERATION_WORKFLOW.states,['planned','in-progress','completed','cancelled']);
  assert.throws(()=>startFieldOperation({id:'op',status:'completed'}),/Only planned operation can start/);
  assert.throws(()=>completeFieldOperation({id:'op',status:'planned'}),/Only in-progress operation can complete/);
});

test('alert service persists lifecycle state',async()=>withHost(async host=>{
  const alerts=createCropAlertService(host.persistence,{namespace:'agro-lavoura'});
  const created=await alerts.upsert({id:'manual-alert',entityRef:{kind:'field',id:'field-1'},title:'Inspeção',dueAt:'2026-09-20T12:00:00.000Z',severity:'warning'});
  assert.equal(created.status,'active');
  assert.equal((await alerts.list()).length,1);
  assert.equal((await alerts.acknowledge('manual-alert',{actorId:'u1',at:'2026-09-19T12:00:00.000Z'})).status,'acknowledged');
  assert.equal((await alerts.snooze('manual-alert',{until:'2026-09-21T12:00:00.000Z'})).status,'active');
  assert.equal((await alerts.dismiss('manual-alert',{actorId:'u1',reason:'feito',at:'2026-09-19T13:00:00.000Z'})).status,'dismissed');
}));

test('scheduling an operation creates a durable operational alert and overview exposes it',async()=>withHost(async host=>{
  const auth=await admin(host);
  await host.backend.action({screenId:'operations',action:'schedule',auth,input:{id:'op-alert',seasonId:'season-1',fieldId:'field-1',typeId:'planting',scheduledAt:'2026-09-22T10:00:00.000Z',inputItems:[]}});
  const alerts=await host.presentation.services.alerts.list();
  const alert=alerts.find(item=>item.entityRef?.id==='op-alert');
  assert.ok(alert);
  assert.equal(alert.dueAt,'2026-09-22T10:00:00.000Z');
  const overview=await host.backend.load({screenId:'overview',auth});
  assert.equal(overview.alerts.some(item=>item.id===alert.id),true);
}));

test('inventory movement below configured threshold creates low-stock alert',async()=>withHost(async host=>{
  const auth=await admin(host);
  await host.presentation.services.settings.set('inventory.lowStockThreshold',10);
  await host.backend.action({screenId:'inventory',action:'receive',auth,input:{id:'stock-in',sku:'fert-1',quantity:20,occurredAt:'2026-09-19T10:00:00.000Z'}});
  await host.backend.action({screenId:'inventory',action:'consume',auth,input:{id:'stock-out',sku:'fert-1',quantity:15,occurredAt:'2026-09-19T11:00:00.000Z'}});
  assert.equal(await host.presentation.services.inventory.available('fert-1'),5);
  const alerts=await host.presentation.services.alerts.list();
  const alert=alerts.find(item=>item.id==='inventory:fert-1:low-stock');
  assert.ok(alert);
  assert.equal(alert.metadata.available,5);
  assert.equal(alert.metadata.threshold,10);
}));

test('overview alert actions use authenticated actor context',async()=>withHost(async host=>{
  const auth=await admin(host);
  await host.presentation.services.alerts.upsert({id:'lifecycle-alert',entityRef:{kind:'field',id:'field-2'},title:'Revisar',dueAt:'2026-09-20T10:00:00.000Z',severity:'info'});
  const acknowledged=await host.backend.action({screenId:'overview',action:'acknowledgeAlert',auth,input:{id:'lifecycle-alert'}});
  assert.equal(acknowledged.status,'acknowledged');
  assert.ok(acknowledged.acknowledgedBy);
  const snoozed=await host.backend.action({screenId:'overview',action:'snoozeAlert',auth,input:{id:'lifecycle-alert',until:'2026-09-21T10:00:00.000Z'}});
  assert.equal(snoozed.status,'active');
  const dismissed=await host.backend.action({screenId:'overview',action:'dismissAlert',auth,input:{id:'lifecycle-alert',reason:'resolvido'}});
  assert.equal(dismissed.status,'dismissed');
  assert.ok(dismissed.dismissedBy);
}));
