import test from 'node:test';
import assert from 'node:assert/strict';
import {createIoTRuleEngine,createThresholdRule,createOfflineRule,createLowBatteryRule} from '../src/iot/rules.js';

test('threshold rule supports debounce, hysteresis and no duplicate alert while active',()=>{
  const engine=createIoTRuleEngine({rules:[createThresholdRule({id:'soil-low',metric:'soil.moisture',operator:'below',threshold:20,hysteresis:3,minOccurrences:2,severity:'warning'})]});
  assert.deepEqual(engine.evaluateTelemetry({deviceId:'d1',metric:'soil.moisture',value:19,unit:'%'}),[]);
  const alerts=engine.evaluateTelemetry({deviceId:'d1',metric:'soil.moisture',value:18,unit:'%'});
  assert.equal(alerts.length,1);assert.equal(alerts[0].ruleId,'soil-low');
  assert.deepEqual(engine.evaluateTelemetry({deviceId:'d1',metric:'soil.moisture',value:17,unit:'%'}),[]);
  assert.equal(engine.evaluateTelemetry({deviceId:'d1',metric:'soil.moisture',value:24,unit:'%'})[0].state,'cleared');
  assert.deepEqual(engine.evaluateTelemetry({deviceId:'d1',metric:'soil.moisture',value:19,unit:'%'}),[]);
  assert.equal(engine.evaluateTelemetry({deviceId:'d1',metric:'soil.moisture',value:18,unit:'%'})[0].state,'active');
});

test('offline and low battery rules produce alert-only outcomes',()=>{
  const engine=createIoTRuleEngine({rules:[createOfflineRule({id:'offline',severity:'critical'}),createLowBatteryRule({id:'battery',threshold:20,severity:'warning'})]});
  const offline=engine.evaluateDevice({id:'d1',status:'offline',batteryLevel:15});
  assert.equal(offline.length,2);
  assert.equal(offline.some(a=>a.kind==='device.offline'),true);
  assert.equal(offline.some(a=>a.kind==='battery.low'),true);
  assert.equal(JSON.stringify(offline).includes('command'),false);
});

test('range thresholds cover irrigation pressure without issuing commands',()=>{
  const low=createThresholdRule({id:'pressure-low',metric:'irrigation.pressure',operator:'below',threshold:2,hysteresis:.2});
  const high=createThresholdRule({id:'pressure-high',metric:'irrigation.pressure',operator:'above',threshold:5,hysteresis:.2});
  const engine=createIoTRuleEngine({rules:[low,high]});
  assert.equal(engine.evaluateTelemetry({deviceId:'pump',metric:'irrigation.pressure',value:1.5,unit:'bar'})[0].ruleId,'pressure-low');
  engine.evaluateTelemetry({deviceId:'pump',metric:'irrigation.pressure',value:3,unit:'bar'});
  assert.equal(engine.evaluateTelemetry({deviceId:'pump',metric:'irrigation.pressure',value:5.5,unit:'bar'})[0].ruleId,'pressure-high');
});
