import test from 'node:test';
import assert from 'node:assert/strict';
import {createIoTEvent,createTelemetryRecordedEvent,createDeviceStatusChangedEvent} from '../src/iot/events.js';

test('createIoTEvent produces a stable immutable protocol-neutral envelope',()=>{
  const event=createIoTEvent({eventId:'evt-1',type:'iot.device.registered',aggregateId:'dev-1',occurredAt:'2026-09-19T20:00:00Z',actor:{id:'u1'},payload:{name:'Sensor'}});
  assert.equal(event.type,'iot.device.registered');
  assert.equal(event.occurredAt,'2026-09-19T20:00:00.000Z');
  assert.equal(Object.isFrozen(event),true);
  assert.equal(Object.isFrozen(event.payload),true);
  assert.throws(()=>createIoTEvent({eventId:'',type:'x',aggregateId:'d',occurredAt:'2026-09-19T20:00:00Z'}),/event id/i);
});

test('telemetry event publishes only normalized safe fields and omits raw payload material',()=>{
  const event=createTelemetryRecordedEvent({eventId:'evt-2',reading:{id:'r1',deviceId:'dev-1',metric:'soil.moisture',value:22,unit:'%',observedAt:'2026-09-19T20:00:00Z',receivedAt:'2026-09-19T20:00:01Z',quality:'good',sequence:8,rawPayloadHash:'sha256:abc',rawPayload:{password:'secret'}},adapterConfig:{password:'secret'} });
  assert.equal(event.type,'iot.telemetry.recorded');
  assert.deepEqual(Object.keys(event.payload).sort(),['deviceId','metric','observedAt','quality','readingId','sequence','unit','value'].sort());
  assert.equal(JSON.stringify(event).includes('secret'),false);
  assert.equal(JSON.stringify(event).includes('rawPayloadHash'),false);
});

test('device status event contains previous and next state without vendor config',()=>{
  const event=createDeviceStatusChangedEvent({eventId:'evt-3',deviceId:'dev-1',previousStatus:'online',status:'offline',occurredAt:'2026-09-19T20:00:00Z',reason:'timeout',metadata:{token:'do-not-copy'}});
  assert.equal(event.type,'iot.device.status_changed');
  assert.deepEqual(event.payload,{previousStatus:'online',status:'offline',reason:'timeout'});
  assert.equal(JSON.stringify(event).includes('do-not-copy'),false);
});
