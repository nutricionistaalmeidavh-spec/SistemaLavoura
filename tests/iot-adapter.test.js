import test from 'node:test';
import assert from 'node:assert/strict';
import {assertIoTAdapter} from '../src/iot/adapter.js';
import {createMockIoTAdapter} from '../src/iot/adapters/mock.js';

test('assertIoTAdapter accepts the neutral adapter contract and rejects incomplete adapters',()=>{
  const adapter={id:'a',protocol:'mock',start(){},stop(){},health(){return{};},onReading(){return()=>{};}};
  assert.equal(assertIoTAdapter(adapter),adapter);
  assert.throws(()=>assertIoTAdapter({id:'broken',protocol:'mock'}),/start/i);
  assert.throws(()=>assertIoTAdapter(null),/adapter/i);
});

test('MockIoTAdapter start and stop are idempotent and expose health',async()=>{
  const adapter=createMockIoTAdapter({id:'mock-1'});
  await adapter.start({source:'test'});
  await adapter.start({source:'test'});
  assert.equal((await adapter.health()).status,'online');
  await adapter.stop();
  await adapter.stop();
  assert.equal((await adapter.health()).status,'stopped');
});

test('MockIoTAdapter emits readings to subscribers and isolates unsubscribe',async()=>{
  const adapter=createMockIoTAdapter({id:'mock-2'});
  const received=[];
  const unsubscribe=adapter.onReading(value=>received.push(value));
  await adapter.start();
  await adapter.emit({deviceId:'d1',metric:'soil.moisture',value:22,unit:'%'});
  unsubscribe();
  await adapter.emit({deviceId:'d1',metric:'soil.moisture',value:23,unit:'%'});
  assert.equal(received.length,1);
  assert.equal(received[0].value,22);
});

test('MockIoTAdapter can simulate disconnect, reconnect and malformed payloads',async()=>{
  const adapter=createMockIoTAdapter({id:'mock-3'});
  const received=[];
  adapter.onReading(value=>received.push(value));
  await adapter.start();
  adapter.disconnect('radio lost');
  assert.equal((await adapter.health()).status,'offline');
  await assert.rejects(()=>adapter.emit({ok:true}),/offline/i);
  adapter.reconnect();
  await adapter.emitInvalid({raw:'???'});
  assert.deepEqual(received,[{raw:'???'}]);
});
