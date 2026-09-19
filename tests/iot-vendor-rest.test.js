import test from 'node:test';
import assert from 'node:assert/strict';
import {createJohnDeereOperationsCenterAdapter,createCnhFieldOpsAdapter} from '../src/iot/adapters/rest.js';

const response=(body)=>({ok:true,async json(){return body;}});

test('vendor REST adapters can derive device identity per returned machine record',async()=>{
  const readings=[];
  const deere=createJohnDeereOperationsCenterAdapter({
    config:{resourceUrl:'https://example.invalid/deere'},
    fetchImpl:async()=>response({values:[{machineId:'jd-1',speed:8,time:'2026-09-19T20:00:00Z'}]}),
    mappings:[{deviceId:r=>r.machineId,metric:'machine.speed',unit:'km/h',value:r=>r.speed,observedAt:r=>r.time}]
  });
  deere.onReading(r=>readings.push(r));await deere.start();await deere.pollOnce();
  assert.equal(readings[0].deviceId,'jd-1');

  const cnh=createCnhFieldOpsAdapter({
    config:{resourceUrl:'https://example.invalid/cnh'},
    fetchImpl:async()=>response({values:[{vin:'cnh-1',hours:120,time:'2026-09-19T20:00:00Z'}]}),
    mappings:[{deviceId:r=>r.vin,metric:'engine.hours',unit:'h',value:r=>r.hours,observedAt:r=>r.time}]
  });
  const cnhReadings=[];cnh.onReading(r=>cnhReadings.push(r));await cnh.start();await cnh.pollOnce();
  assert.equal(cnhReadings[0].deviceId,'cnh-1');
});
