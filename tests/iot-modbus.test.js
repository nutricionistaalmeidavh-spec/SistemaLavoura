import test from 'node:test';
import assert from 'node:assert/strict';
import {createModbusIoTAdapter,MODBUS_COMMANDS_ENABLED} from '../src/iot/adapters/modbus.js';

class FakeModbusClient{
  constructor(values={}){this.values=values;this.connected=false;this.closed=false;this.calls=[];}
  async connect(config){this.connected=true;this.config=config;}
  async readHoldingRegisters(address,length){this.calls.push({kind:'holding',address,length});if(this.values[address] instanceof Error)throw this.values[address];return [this.values[address]??0];}
  async readInputRegisters(address,length){this.calls.push({kind:'input',address,length});return [this.values[address]??0];}
  async close(){this.connected=false;this.closed=true;}
}

test('Modbus adapter is optional, injected and read-only by default',async()=>{
  const client=new FakeModbusClient({10:245});
  const adapter=createModbusIoTAdapter({id:'modbus-1',config:{transport:'tcp',host:'192.168.1.50',port:502},registers:[{deviceId:'soil-1',metric:'soil.moisture',address:10,registerType:'holding',unit:'%',scale:.1}],clientFactory:async()=>client});
  const readings=[];adapter.onReading(v=>readings.push(v));await adapter.start();await adapter.pollOnce();
  assert.equal(MODBUS_COMMANDS_ENABLED,false);
  assert.equal(readings[0].value,24.5);
  assert.equal(readings[0].metric,'soil.moisture');
  await assert.rejects(()=>adapter.executeCommand({command:'write'}),/disabled/i);
  await adapter.stop();assert.equal(client.closed,true);
});

test('Modbus supports input register mapping and endian/value decoder injection',async()=>{
  const client=new FakeModbusClient({20:100});
  const adapter=createModbusIoTAdapter({id:'modbus-2',config:{transport:'rtu',path:'COM3',baudRate:9600},registers:[{deviceId:'pressure-1',metric:'irrigation.pressure',address:20,registerType:'input',unit:'bar',decoder:values=>values[0]/20}],clientFactory:async()=>client});
  const rows=[];adapter.onReading(v=>rows.push(v));await adapter.start();await adapter.pollOnce();
  assert.equal(rows[0].value,5);assert.equal(client.calls[0].kind,'input');
});

test('register read failure is isolated and reflected in health',async()=>{
  const client=new FakeModbusClient({10:new Error('timeout'),11:30});
  const adapter=createModbusIoTAdapter({id:'modbus-3',config:{transport:'tcp',host:'x'},registers:[{deviceId:'d1',metric:'soil.moisture',address:10,unit:'%'},{deviceId:'d2',metric:'air.temperature',address:11,unit:'C'}],clientFactory:async()=>client});
  const rows=[];adapter.onReading(v=>rows.push(v));await adapter.start();const result=await adapter.pollOnce();
  assert.equal(result.errors,1);assert.equal(rows.length,1);assert.equal((await adapter.health()).readErrors,1);
});
