import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStandaloneHost} from '../runtime/host.mjs';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createProductEventBus} from '../shared/packages/product-eventbus/src/index.js';
import {createProductSettings} from '../shared/packages/product-settings/src/index.js';

const password='Qa-P1-Platform-2026!';

async function withHost(work){
  const root=await mkdtemp(join(tmpdir(),'agro-lavoura-p1-platform-'));
  const host=await createStandaloneHost({dataDir:root});
  try{return await work(host,root);}finally{await host.close().catch(()=>{});await rm(root,{recursive:true,force:true}).catch(()=>{});}
}

async function adminSession(host){
  await host.backend.bootstrap({username:'p1-admin',password});
  const logged=await host.backend.login({username:'p1-admin',password});
  return {sessionId:logged.session.id,token:logged.token};
}

test('durable eventbus keeps failed deliveries retryable',async()=>{
  const root=await mkdtemp(join(tmpdir(),'agro-lavoura-eventbus-'));
  const dbPath=join(root,'events.sqlite');
  const persistence=await openProductPersistence({dbPath,productId:'eventbus-test'});
  try{
    const bus=createProductEventBus(persistence,{namespace:'test'});
    let attempts=0;
    bus.subscribe('crop.changed',()=>{attempts+=1;if(attempts===1)throw new Error('temporary subscriber failure');});
    const event=await bus.publish('crop.changed',{id:'field-1'},{eventId:'evt-1'});
    const first=await bus.flush(event.id);
    assert.equal(first.failed,1);
    assert.equal((await bus.list({status:'failed'})).length,1);
    const second=await bus.flush(event.id);
    assert.equal(second.delivered,1);
    const stored=(await bus.list()).find(item=>item.id===event.id);
    assert.equal(stored.status,'delivered');
    assert.equal(stored.attempts,2);
  }finally{await persistence.close();await rm(root,{recursive:true,force:true});}
});

test('settings persist and merge with defaults across reopen',async()=>{
  const root=await mkdtemp(join(tmpdir(),'agro-lavoura-settings-'));
  const dbPath=join(root,'settings.sqlite');
  let persistence=await openProductPersistence({dbPath,productId:'settings-test'});
  try{
    let settings=createProductSettings(persistence,{namespace:'test',defaults:{'inventory.lowStockThreshold':10,'alerts.enabled':true}});
    assert.equal(await settings.get('inventory.lowStockThreshold'),10);
    await settings.set('inventory.lowStockThreshold',7);
    await settings.merge({'planning.lookAheadDays':45,'alerts.enabled':false});
    await persistence.close();
    persistence=await openProductPersistence({dbPath,productId:'settings-test'});
    settings=createProductSettings(persistence,{namespace:'test',defaults:{'inventory.lowStockThreshold':10,'alerts.enabled':true}});
    assert.deepEqual(await settings.snapshot(),{'inventory.lowStockThreshold':7,'alerts.enabled':false,'planning.lookAheadDays':45});
  }finally{await persistence.close().catch(()=>{});await rm(root,{recursive:true,force:true});}
});

test('successful backend command persists and delivers a domain event',async()=>withHost(async host=>{
  const auth=await adminSession(host);
  const seen=[];
  assert.ok(host.presentation.services.eventBus);
  host.presentation.services.eventBus.subscribe('agro.fields.save.completed',event=>seen.push(event));
  await host.backend.action({screenId:'fields',action:'save',auth,input:{id:'field-event',code:'EVT-01',name:'Talhão Evento',farmUnitId:'farm-1',areaHa:9}});
  assert.equal(seen.length,1);
  assert.equal(seen[0].payload.entityId,'field-event');
  assert.equal(seen[0].metadata.screenId,'fields');
  assert.equal(seen[0].metadata.action,'save');
  const events=await host.presentation.services.eventBus.list();
  const event=events.find(item=>item.type==='agro.fields.save.completed');
  assert.ok(event);
  assert.equal(event.status,'delivered');
  assert.equal(event.metadata.commandId.length>0,true);
}));

test('failed backend command does not leave a completed domain event',async()=>withHost(async host=>{
  const auth=await adminSession(host);
  await assert.rejects(host.backend.action({screenId:'fields',action:'save',auth,input:{id:'bad-field'}}),/Field code is required/);
  const events=await host.presentation.services.eventBus.list();
  assert.equal(events.some(event=>event.type==='agro.fields.save.completed'),false);
}));
