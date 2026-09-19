import test from 'node:test';
import assert from 'node:assert/strict';
import {createIoTIngestionService} from '../src/iot/ingestion.js';
import {createMockIoTAdapter} from '../src/iot/adapters/mock.js';

const validRaw=(overrides={})=>({id:'r1',deviceId:'soil-1',metric:'soil.moisture',value:20,unit:'%',observedAt:'2026-09-19T20:00:00Z',sequence:1,...overrides});

function fakeRepository(){
  const rows=[];
  return {rows,appendTelemetry(reading){
    const duplicate=rows.some(r=>r.deviceId===reading.deviceId&&r.sequence!==null&&r.sequence===reading.sequence);
    if(!duplicate)rows.push(reading);
    return {inserted:!duplicate,reading};
  }};
}

test('ingestion persists a valid reading before publishing its event',async()=>{
  const repo=fakeRepository(),order=[],events=[];
  const wrapped={...repo,appendTelemetry(reading){order.push('persist');return repo.appendTelemetry(reading);}};
  const service=createIoTIngestionService({repository:wrapped,eventPublisher:async event=>{order.push('publish');events.push(event);},clock:()=>new Date('2026-09-19T20:00:01Z')});
  const adapter=createMockIoTAdapter({id:'mock-1'});service.attach(adapter);await service.startAll();
  await adapter.emit(validRaw());
  assert.deepEqual(order,['persist','publish']);
  assert.equal(repo.rows.length,1);
  assert.equal(events[0].type,'iot.telemetry.recorded');
});

test('duplicate readings are persisted idempotently and not republished',async()=>{
  const repo=fakeRepository(),events=[];
  const service=createIoTIngestionService({repository:repo,eventPublisher:event=>events.push(event),clock:()=>new Date('2026-09-19T20:00:01Z')});
  const adapter=createMockIoTAdapter({id:'mock-2'});service.attach(adapter);await service.startAll();
  await adapter.emit(validRaw());
  await adapter.emit(validRaw({id:'r2',value:99}));
  assert.equal(repo.rows.length,1);assert.equal(events.length,1);
});

test('invalid telemetry is rejected without corrupting previously accepted state',async()=>{
  const repo=fakeRepository();
  const service=createIoTIngestionService({repository:repo,clock:()=>new Date('2026-09-19T20:00:01Z')});
  const adapter=createMockIoTAdapter({id:'mock-3'});service.attach(adapter);await service.startAll();
  await adapter.emit(validRaw());
  await assert.rejects(()=>adapter.emit(validRaw({id:'bad',value:NaN,sequence:2})),/value/i);
  assert.equal(repo.rows.length,1);
});

test('publisher failure does not roll back a reading already accepted',async()=>{
  const repo=fakeRepository();
  const service=createIoTIngestionService({repository:repo,eventPublisher:async()=>{throw new Error('subscriber down');},clock:()=>new Date('2026-09-19T20:00:01Z')});
  const adapter=createMockIoTAdapter({id:'mock-4'});service.attach(adapter);await service.startAll();
  await adapter.emit(validRaw());
  assert.equal(repo.rows.length,1);
  assert.equal(service.status().adapters['mock-4'].publishErrors,1);
});

test('one adapter failing to start does not stop healthy adapters',async()=>{
  const service=createIoTIngestionService({repository:fakeRepository(),clock:()=>new Date('2026-09-19T20:00:01Z')});
  service.attach(createMockIoTAdapter({id:'broken',startError:new Error('offline')}));
  service.attach(createMockIoTAdapter({id:'healthy'}));
  const result=await service.startAll();
  assert.equal(result.broken.started,false);
  assert.equal(result.healthy.started,true);
  assert.equal(service.status().adapters.broken.lastError,'offline');
});
