import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoRaWanIoTAdapter} from '../src/iot/adapters/lorawan.js';

class FakeLoRaSource{
  constructor(){this.handler=null;this.started=false;this.stopped=false;}
  onUplink(handler){this.handler=handler;return()=>{this.handler=null;};}
  async start(){this.started=true;}
  async stop(){this.stopped=true;this.started=false;}
  async emit(payload){return this.handler?.(payload);}
}

test('LoRaWAN adapter is optional and consumes injected gateway/API source',async()=>{
  const source=new FakeLoRaSource(),configs=[];
  const adapter=createLoRaWanIoTAdapter({id:'lora-1',config:{provider:'chirpstack',endpoint:'http://gateway.local',token:'secret'},sourceFactory:async config=>{configs.push(config);return source;},uplinkMapper:payload=>({id:payload.id,deviceId:payload.devEui,metric:'soil.moisture',value:payload.moisture,unit:'%',observedAt:payload.time,sequence:payload.fCnt})});
  const rows=[];adapter.onReading(v=>rows.push(v));await adapter.start();
  await source.emit({id:'u1',devEui:'ABC',moisture:28,time:'2026-09-19T20:00:00Z',fCnt:9});
  assert.equal(rows[0].deviceId,'ABC');assert.equal(rows[0].value,28);
  assert.equal(JSON.stringify(await adapter.health()).includes('secret'),false);
  await adapter.stop();assert.equal(source.stopped,true);
});

test('LoRaWAN mapper can normalize The Things Stack style uplinks without vendor coupling',async()=>{
  const source=new FakeLoRaSource(),rows=[];
  const adapter=createLoRaWanIoTAdapter({id:'tts',config:{provider:'the-things-stack'},sourceFactory:async()=>source,uplinkMapper:payload=>({id:`${payload.end_device_ids.device_id}:${payload.uplink_message.f_cnt}`,deviceId:payload.end_device_ids.device_id,metric:'air.temperature',value:payload.uplink_message.decoded_payload.temperature,unit:'C',observedAt:payload.received_at,sequence:payload.uplink_message.f_cnt})});
  adapter.onReading(v=>rows.push(v));await adapter.start();
  await source.emit({end_device_ids:{device_id:'weather-1'},received_at:'2026-09-19T20:00:00Z',uplink_message:{f_cnt:3,decoded_payload:{temperature:31.2}}});
  assert.equal(rows[0].metric,'air.temperature');assert.equal(rows[0].sequence,3);
});

test('LoRaWAN mapping errors are isolated in health state',async()=>{
  const source=new FakeLoRaSource();
  const adapter=createLoRaWanIoTAdapter({id:'lora-bad',config:{provider:'custom'},sourceFactory:async()=>source,uplinkMapper:()=>{throw new Error('decode failed');}});
  await adapter.start();await source.emit({raw:'x'});
  const health=await adapter.health();assert.equal(health.decodeErrors,1);assert.equal(health.status,'online');
});
