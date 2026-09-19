import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createMqttIoTAdapter} from '../src/iot/adapters/mqtt.js';

class FakeMqttClient extends EventEmitter{
  constructor(){super();this.connected=true;this.subscriptions=[];this.ended=false;}
  subscribe(topic,options,cb){this.subscriptions.push({topic,options});cb?.(null,[{topic,qos:options?.qos??0}]);}
  end(force,options,cb){this.ended=true;this.connected=false;cb?.();}
}

test('MQTT adapter is optional and uses injected transport without package dependency',async()=>{
  const client=new FakeMqttClient(),calls=[];
  const adapter=createMqttIoTAdapter({id:'mqtt-main',config:{url:'mqtt://farm.local',topics:['farm/+/telemetry'],username:'farmer',password:'secret'},clientFactory:async config=>{calls.push(config);return client;}});
  await adapter.start();
  assert.equal(calls.length,1);
  assert.equal(client.subscriptions[0].topic,'farm/+/telemetry');
  const health=await adapter.health();
  assert.equal(health.status,'online');
  assert.equal(JSON.stringify(health).includes('secret'),false);
  await adapter.stop();
  assert.equal(client.ended,true);
});

test('MQTT adapter maps JSON messages into protocol-neutral raw readings',async()=>{
  const client=new FakeMqttClient(),received=[];
  const adapter=createMqttIoTAdapter({id:'mqtt',config:{url:'mqtt://x',topics:['farm/+/telemetry']},clientFactory:async()=>client,messageMapper:({topic,payload})=>({...JSON.parse(payload),sourceTopic:topic})});
  adapter.onReading(v=>received.push(v));await adapter.start();
  client.emit('message','farm/soil-1/telemetry',Buffer.from(JSON.stringify({id:'r1',deviceId:'soil-1',metric:'soil.moisture',value:23,unit:'%',observedAt:'2026-09-19T20:00:00Z',sequence:1})));
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(received.length,1);assert.equal(received[0].deviceId,'soil-1');
});

test('malformed MQTT payload increments adapter error without crashing transport',async()=>{
  const client=new FakeMqttClient();
  const adapter=createMqttIoTAdapter({id:'mqtt',config:{url:'mqtt://x',topics:['#']},clientFactory:async()=>client});
  await adapter.start();client.emit('message','bad',Buffer.from('{nope'));
  await new Promise(resolve=>setImmediate(resolve));
  const health=await adapter.health();
  assert.equal(health.parseErrors,1);assert.equal(health.status,'online');
});
