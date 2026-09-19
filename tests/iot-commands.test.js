import test from 'node:test';
import assert from 'node:assert/strict';
import {createIoTCommandService,transitionDeviceCommand} from '../src/iot/commands.js';

function memoryStore(){
  const data=new Map();
  return {data,saveCommand(command){data.set(command.id,command);return command;},getCommand(id){return data.get(id)??null;}};
}

const request={id:'cmd-1',deviceId:'pump-1',command:'start',payload:{zone:'A'},requestedBy:'user-1',requestedAt:'2026-09-19T20:00:00Z',expiresAt:'2026-09-19T20:05:00Z'};

test('commands are disabled by default even when an adapter exists',async()=>{
  const store=memoryStore();
  const service=createIoTCommandService({repository:store,authorize:async()=>true,capabilityResolver:async()=>true,adapterResolver:async()=>({executeCommand:async()=>({acknowledged:true})}),clock:()=>new Date('2026-09-19T20:01:00Z')});
  await assert.rejects(()=>service.request(request),/disabled/i);
  assert.equal(store.data.size,0);
});

test('command requires explicit iot:command authorization and capability',async()=>{
  const store=memoryStore();
  const denied=createIoTCommandService({commandsEnabled:true,repository:store,authorize:async()=>{throw new Error('forbidden');},capabilityResolver:async()=>true,adapterResolver:async()=>null,clock:()=>new Date('2026-09-19T20:01:00Z')});
  await assert.rejects(()=>denied.request(request),/forbidden/);
  const unsupported=createIoTCommandService({commandsEnabled:true,repository:store,authorize:async()=>true,capabilityResolver:async()=>false,adapterResolver:async()=>null,clock:()=>new Date('2026-09-19T20:01:00Z')});
  await assert.rejects(()=>unsupported.request(request),/capability/i);
});

test('command lifecycle persists pending sent and acknowledged states',async()=>{
  const store=memoryStore(),sent=[];
  const service=createIoTCommandService({commandsEnabled:true,repository:store,authorize:async ({permission})=>assert.equal(permission,'iot:command'),capabilityResolver:async()=>true,adapterResolver:async()=>({executeCommand:async command=>{sent.push(command);return {acknowledged:true};}}),clock:()=>new Date('2026-09-19T20:01:00Z')});
  const pending=await service.request(request);assert.equal(pending.status,'pending');
  const final=await service.dispatch('cmd-1');assert.equal(final.status,'acknowledged');assert.equal(sent.length,1);assert.ok(final.acknowledgedAt);
});

test('expired command never reaches physical adapter',async()=>{
  const store=memoryStore();let called=false;
  const service=createIoTCommandService({commandsEnabled:true,repository:store,authorize:async()=>true,capabilityResolver:async()=>true,adapterResolver:async()=>({executeCommand:async()=>{called=true;}}),clock:()=>new Date('2026-09-19T20:10:00Z')});
  await service.request({...request,requestedAt:'2026-09-19T19:59:00Z',expiresAt:'2026-09-19T20:05:00Z'});
  const result=await service.dispatch('cmd-1');assert.equal(result.status,'expired');assert.equal(called,false);
});

test('state machine rejects unsafe command transitions',()=>{
  const pending={...request,status:'pending',acknowledgedAt:null,failureReason:null};
  assert.equal(transitionDeviceCommand(pending,'sent').status,'sent');
  assert.throws(()=>transitionDeviceCommand(pending,'acknowledged'),/transition/i);
  assert.throws(()=>transitionDeviceCommand({...pending,status:'expired'},'sent'),/transition/i);
});
