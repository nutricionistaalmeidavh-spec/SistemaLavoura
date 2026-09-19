import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeCanSignal,createCanIoTAdapter} from '../src/iot/adapters/can.js';
import {decodeJ1939Identifier,createJ1939IoTAdapter} from '../src/iot/adapters/j1939.js';
import {ISOBUS_FUNCTIONALITIES,createIsobusIoTAdapter} from '../src/iot/adapters/isobus.js';
import {ISOXML_MESSAGE_TYPE,createIsoXmlIoTAdapter} from '../src/iot/adapters/isoxml.js';
import {AGRIROUTER_MESSAGE_TYPES,createAgrirouterIoTAdapter} from '../src/iot/adapters/agrirouter.js';
import {createRestTelemetryAdapter} from '../src/iot/adapters/rest.js';
import {DEFAULT_MACHINE_PROFILES,createMachineProfileRegistry} from '../src/iot/machine-profiles.js';

function frameSource(){
  const handlers=new Set();
  return {async start(){},async stop(){},onFrame(handler){handlers.add(handler);return()=>handlers.delete(handler);},async emit(frame){for(const h of [...handlers])await h(frame);}};
}

test('CAN signal decoder supports explicit scale/offset without vendor constants',()=>{
  assert.equal(decodeCanSignal(Uint8Array.from([0x10,0x27]),{byteOffset:0,length:2,endian:'little',scale:0.1}),1000);
  assert.equal(decodeCanSignal(Uint8Array.from([0x01]),{byteOffset:0,length:1,scale:2,offset:-1}),1);
});

test('generic CAN adapter emits only mappings explicitly configured by the integrator',async()=>{
  const source=frameSource(),readings=[];
  const adapter=createCanIoTAdapter({sourceFactory:async()=>source,mappings:[{canId:0x123,deviceId:'tractor-1',metric:'machine.custom',unit:'u',signal:{byteOffset:0,length:1}}]});
  adapter.onReading(r=>readings.push(r));await adapter.start();
  await source.emit({id:0x999,data:Uint8Array.from([9]),timestamp:'2026-09-19T20:00:00Z'});
  await source.emit({id:0x123,data:Uint8Array.from([7]),timestamp:'2026-09-19T20:00:01Z'});
  assert.equal(readings.length,1);assert.equal(readings[0].value,7);assert.equal(readings[0].metric,'machine.custom');
});

test('J1939 identifier decoding derives PGN and source address from 29-bit CAN id',()=>{
  const decoded=decodeJ1939Identifier(0x0CF00401);
  assert.equal(decoded.pgn,0xF004);assert.equal(decoded.sourceAddress,0x01);assert.equal(decoded.priority,3);
});

test('J1939 adapter uses supplied PGN mappings instead of embedding proprietary SPNs',async()=>{
  const source=frameSource(),readings=[];
  const adapter=createJ1939IoTAdapter({sourceFactory:async()=>source,mappings:[{pgn:0xF004,deviceId:'tractor-1',metric:'engine.example',unit:'rpm',signal:{byteOffset:0,length:2,endian:'little'}}]});
  adapter.onReading(r=>readings.push(r));await adapter.start();
  await source.emit({id:0x0CF00401,extended:true,data:Uint8Array.from([0x34,0x12]),timestamp:'2026-09-19T20:00:00Z'});
  assert.equal(readings.length,1);assert.equal(readings[0].value,0x1234);assert.equal(readings[0].metadata.pgn,0xF004);
});

test('ISOBUS adapter accepts decoded DDI records and preserves AEF functionality vocabulary',async()=>{
  assert.ok(ISOBUS_FUNCTIONALITIES.includes('TC-GEO'));assert.ok(ISOBUS_FUNCTIONALITIES.includes('TIM'));
  const source=frameSource(),readings=[];
  const adapter=createIsobusIoTAdapter({sourceFactory:async()=>source,ddiMappings:[{ddi:42,metric:'implement.example',unit:'kg/ha'}]});
  adapter.onReading(r=>readings.push(r));await adapter.start();
  await source.emit({deviceId:'implement-1',ddi:42,value:80,observedAt:'2026-09-19T20:00:00Z',sequence:5});
  assert.equal(readings[0].metric,'implement.example');assert.equal(readings[0].metadata.ddi,42);
});

test('ISOXML adapter consumes TaskData records through an injected lawful reader',async()=>{
  assert.equal(ISOXML_MESSAGE_TYPE,'iso:11783:-10:taskdata:zip');
  const readings=[];
  const adapter=createIsoXmlIoTAdapter({taskDataReader:async()=>[{deviceId:'harvester-1',metric:'yield.example',value:55,unit:'kg/ha',observedAt:'2026-09-19T20:00:00Z'}]});
  adapter.onReading(r=>readings.push(r));await adapter.start();await adapter.importTaskData(new Uint8Array([1,2,3]));
  assert.equal(readings.length,1);assert.equal(readings[0].metric,'yield.example');
});

test('agrirouter adapter declares official TaskData and EFDI message types and decodes via injected decoder',async()=>{
  assert.ok(AGRIROUTER_MESSAGE_TYPES.includes('iso:11783:-10:taskdata:zip'));
  assert.ok(AGRIROUTER_MESSAGE_TYPES.includes('iso:11783:-10:time_log:protobuf'));
  const events=[{event_type:'MESSAGE_RECEIVED',id:'m1',message_type:'iso:11783:-10:time_log:protobuf',payload_uri:'https://example.invalid/p1'}];
  const fetchImpl=async url=>({ok:true,async json(){return url.endsWith('/events')?events:{};},async arrayBuffer(){return new Uint8Array([1]).buffer;}});
  const readings=[];
  const adapter=createAgrirouterIoTAdapter({config:{eventsUrl:'https://example.invalid/events'},fetchImpl,payloadDecoder:async()=>[{deviceId:'machine-1',metric:'speed.example',value:4,unit:'m/s',observedAt:'2026-09-19T20:00:00Z'}]});
  adapter.onReading(r=>readings.push(r));await adapter.start();await adapter.pollOnce();
  assert.equal(readings.length,1);
});

test('REST telemetry adapter supports official vendor APIs without coupling domain to a brand',async()=>{
  const fetchImpl=async()=>({ok:true,async json(){return {values:[{speed:12.5,time:'2026-09-19T20:00:00Z'}]};}});
  const readings=[];
  const adapter=createRestTelemetryAdapter({protocol:'official-vendor-api',config:{resourceUrl:'https://example.invalid/telemetry'},fetchImpl,recordSelector:body=>body.values,mappings:[{deviceId:'machine-1',metric:'machine.speed',unit:'km/h',value:record=>record.speed,observedAt:record=>record.time}]});
  adapter.onReading(r=>readings.push(r));await adapter.start();await adapter.pollOnce();
  assert.equal(readings[0].value,12.5);
});

test('machine profile registry includes generic standards and vendor ecosystems without asserting model compatibility',()=>{
  const registry=createMachineProfileRegistry(DEFAULT_MACHINE_PROFILES);
  assert.ok(registry.get('generic-j1939'));
  assert.ok(registry.get('generic-isobus-tractor'));
  assert.ok(registry.findByBrand('John Deere').some(p=>p.protocols.includes('john-deere-operations-center')));
  assert.ok(registry.findByBrand('Case IH').some(p=>p.protocols.includes('cnh-fieldops')));
  assert.ok(registry.findByBrand('Fendt').some(p=>p.protocols.includes('agrirouter')));
  assert.ok(registry.findByBrand('Stara').some(p=>p.protocols.includes('can')));
  assert.ok(registry.findByBrand('Jacto').some(p=>p.integrationStatus==='requires-partner-contract'));
  for(const profile of DEFAULT_MACHINE_PROFILES)assert.notEqual(profile.modelCompatibility,'universal');
});
