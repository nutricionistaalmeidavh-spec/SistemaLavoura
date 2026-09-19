import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIoTOverviewModel,buildDeviceRows,buildIntegrationRows} from '../web/iot/model.js';

test('IoT overview summarizes device health and latest agricultural metrics',()=>{
  const model=buildIoTOverviewModel({
    devices:[{id:'d1',name:'Solo Norte',status:'online',batteryLevel:18,fieldId:'f1'},{id:'d2',name:'Reservatório',status:'offline',batteryLevel:null,fieldId:null}],
    telemetry:[{deviceId:'d1',metric:'soil.moisture',value:21,unit:'%',observedAt:'2026-09-19T20:00:00Z'}],
    alerts:[{id:'a1',severity:'warning',read:false}]
  });
  assert.deepEqual(model.cards,{devices:2,online:1,offline:1,unreadAlerts:1});
  assert.equal(model.latestMetrics[0].label,'Umidade do solo');
});

test('device rows expose operational state without raw secrets',()=>{
  const rows=buildDeviceRows([{id:'d1',name:'Sensor 1',type:'soil-sensor',protocol:'mqtt',status:'online',fieldName:'Norte',batteryLevel:72,signalStrength:-82,lastSeenAt:'2026-09-19T20:00:00Z',metadata:{password:'secret'}}]);
  assert.deepEqual(Object.keys(rows[0]),['id','name','type','protocol','status','field','battery','signal','lastSeenAt']);
  assert.equal(JSON.stringify(rows).includes('secret'),false);
});

test('integration rows make optional and disabled state explicit',()=>{
  const rows=buildIntegrationRows([{id:'mqtt-main',protocol:'mqtt',enabled:false,health:{status:'stopped'}},{id:'modbus-1',protocol:'modbus-tcp',enabled:true,health:{status:'online'}}]);
  assert.equal(rows[0].optional,true);
  assert.equal(rows[0].enabled,false);
  assert.equal(rows[1].status,'online');
});
