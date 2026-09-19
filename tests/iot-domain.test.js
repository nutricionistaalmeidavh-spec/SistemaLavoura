import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDevice,
  createDeviceCapability,
  createTelemetryReading,
  createFieldDeviceBinding,
  createDeviceCommand,
  normalizeMetric
} from '../src/iot/index.js';

test('normalizeMetric accepts known and custom dotted metrics',()=>{
  assert.equal(normalizeMetric(' soil.moisture '),'soil.moisture');
  assert.equal(normalizeMetric('canopy.ndvi'),'canopy.ndvi');
  assert.throws(()=>normalizeMetric('Bad Metric'),/metric/i);
});

test('createDevice validates required identifiers and returns immutable device',()=>{
  const device=createDevice({id:'soil-01',name:'Solo Norte',type:'soil-sensor',protocol:'mock',status:'online',batteryLevel:82,signalStrength:-77,metadata:{zone:'A'}});
  assert.equal(device.id,'soil-01');
  assert.equal(device.protocol,'mock');
  assert.equal(Object.isFrozen(device),true);
  assert.equal(Object.isFrozen(device.metadata),true);
  assert.throws(()=>createDevice({id:'',name:'x',type:'sensor',protocol:'mock'}),/id/i);
  assert.throws(()=>createDevice({id:'x',name:'',type:'sensor',protocol:'mock'}),/name/i);
  assert.throws(()=>createDevice({id:'x',name:'x',type:'',protocol:'mock'}),/type/i);
  assert.throws(()=>createDevice({id:'x',name:'x',type:'sensor',protocol:''}),/protocol/i);
});

test('createTelemetryReading rejects malformed value unit and timestamps',()=>{
  const reading=createTelemetryReading({id:'r-1',deviceId:'soil-01',metric:'soil.moisture',value:23.4,unit:'%',observedAt:'2026-09-19T20:00:00.000Z',receivedAt:'2026-09-19T20:00:01.000Z',quality:'good',sequence:10,rawPayloadHash:'sha256:abc'});
  assert.equal(reading.metric,'soil.moisture');
  assert.equal(reading.value,23.4);
  assert.equal(Object.isFrozen(reading),true);
  assert.throws(()=>createTelemetryReading({id:'r',deviceId:'d',metric:'soil.moisture',value:NaN,unit:'%',observedAt:'2026-09-19T20:00:00Z',receivedAt:'2026-09-19T20:00:00Z'}),/value/i);
  assert.throws(()=>createTelemetryReading({id:'r',deviceId:'d',metric:'soil.moisture',value:1,unit:'',observedAt:'2026-09-19T20:00:00Z',receivedAt:'2026-09-19T20:00:00Z'}),/unit/i);
  assert.throws(()=>createTelemetryReading({id:'r',deviceId:'d',metric:'soil.moisture',value:1,unit:'%',observedAt:'not-a-date',receivedAt:'2026-09-19T20:00:00Z'}),/observed/i);
});

test('capability binding and command contracts stay protocol neutral',()=>{
  const capability=createDeviceCapability({deviceId:'soil-01',kind:'metric',key:'soil.moisture',unit:'%'});
  assert.equal(capability.key,'soil.moisture');
  const binding=createFieldDeviceBinding({deviceId:'soil-01',fieldId:'field-1',installedAt:'2026-09-19T20:00:00Z',position:{lat:-21.1,lng:-47.8},notes:'20 cm'});
  assert.equal(binding.fieldId,'field-1');
  const command=createDeviceCommand({id:'c-1',deviceId:'pump-1',command:'start',payload:{},requestedBy:'user-1',requestedAt:'2026-09-19T20:00:00Z',expiresAt:'2026-09-19T20:05:00Z'});
  assert.equal(command.status,'pending');
  assert.equal(Object.isFrozen(command.payload),true);
});
