import {createDeviceCommand} from './domain.js';

const TRANSITIONS=Object.freeze({
  pending:new Set(['sent','expired','cancelled']),
  sent:new Set(['acknowledged','failed','expired','cancelled']),
  acknowledged:new Set(),
  failed:new Set(),
  expired:new Set(),
  cancelled:new Set()
});

const iso=(value)=>new Date(value).toISOString();

export function transitionDeviceCommand(command,nextStatus,{at=new Date(),failureReason=null}={}){
  if(!command||typeof command!=='object') throw new TypeError('Command is required.');
  const current=String(command.status??'').toLowerCase();
  const next=String(nextStatus??'').toLowerCase();
  const allowed=TRANSITIONS[current];
  if(!allowed||!allowed.has(next)) throw new Error(`Unsafe command transition: ${current} -> ${next}.`);
  const patch={status:next};
  if(next==='acknowledged') patch.acknowledgedAt=iso(at);
  if(next==='failed') patch.failureReason=String(failureReason??'Command failed.');
  return Object.freeze({...command,...patch});
}

export function createIoTCommandService({
  commandsEnabled=false,
  repository,
  authorize=async()=>true,
  capabilityResolver=async()=>false,
  adapterResolver=async()=>null,
  clock=()=>new Date()
}={}){
  if(!repository||typeof repository.saveCommand!=='function'||typeof repository.getCommand!=='function'){
    throw new TypeError('Command repository with saveCommand/getCommand is required.');
  }

  async function request(input){
    if(!commandsEnabled) throw new Error('IoT commands are disabled by default.');
    await authorize({permission:'iot:command',deviceId:input?.deviceId,command:input?.command,requestedBy:input?.requestedBy});
    const supported=await capabilityResolver({deviceId:input?.deviceId,kind:'command',key:String(input?.command??'').toLowerCase()});
    if(!supported) throw new Error('Device command capability is not supported.');
    const command=createDeviceCommand({...input,status:'pending',acknowledgedAt:null,failureReason:null});
    return repository.saveCommand(command);
  }

  async function dispatch(id){
    const command=repository.getCommand(id);
    if(!command) throw new Error('Command not found.');
    if(Date.parse(command.expiresAt)<=clock().getTime()){
      if(command.status==='pending'||command.status==='sent') return repository.saveCommand(transitionDeviceCommand(command,'expired',{at:clock()}));
      return command;
    }
    if(command.status!=='pending') return command;
    const adapter=await adapterResolver({deviceId:command.deviceId,command:command.command});
    if(!adapter||typeof adapter.executeCommand!=='function'){
      return repository.saveCommand(transitionDeviceCommand(transitionDeviceCommand(command,'sent',{at:clock()}),'failed',{at:clock(),failureReason:'No command-capable adapter available.'}));
    }
    const sent=repository.saveCommand(transitionDeviceCommand(command,'sent',{at:clock()}));
    try{
      const result=await adapter.executeCommand(sent);
      if(result?.acknowledged){
        return repository.saveCommand(transitionDeviceCommand(sent,'acknowledged',{at:clock()}));
      }
      return repository.saveCommand(transitionDeviceCommand(sent,'failed',{at:clock(),failureReason:result?.failureReason??'Command was not acknowledged.'}));
    }catch(error){
      return repository.saveCommand(transitionDeviceCommand(sent,'failed',{at:clock(),failureReason:error?.message??'Command dispatch failed.'}));
    }
  }

  return Object.freeze({commandsEnabled,request,dispatch});
}
