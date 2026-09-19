import {assertIoTAdapter} from '../adapter.js';

export function createMockIoTAdapter({id='mock-iot',protocol='mock',startError=null}={}){
  const handlers=new Set();
  let started=false;
  let offline=false;
  let offlineReason=null;
  let context=null;

  const adapter={
    id:String(id).trim(),
    protocol:String(protocol).trim().toLowerCase(),
    async start(ctx={}){
      if(startError) throw (startError instanceof Error?startError:new Error(String(startError)));
      context=ctx;
      started=true;
      offline=false;
      offlineReason=null;
      return adapter.health();
    },
    async stop(){
      started=false;
      offline=false;
      offlineReason=null;
      context=null;
      return adapter.health();
    },
    async health(){
      return Object.freeze({
        id:adapter.id,
        protocol:adapter.protocol,
        status:started?(offline?'offline':'online'):'stopped',
        reason:offlineReason,
        context
      });
    },
    onReading(handler){
      if(typeof handler!=='function') throw new TypeError('Reading handler must be a function.');
      handlers.add(handler);
      return ()=>handlers.delete(handler);
    },
    async emit(reading){
      if(!started) throw new Error('Mock adapter is stopped.');
      if(offline) throw new Error('Mock adapter is offline.');
      for(const handler of [...handlers]) await handler(reading);
      return reading;
    },
    async emitInvalid(payload){return adapter.emit(payload);},
    disconnect(reason='disconnected'){
      if(started){offline=true;offlineReason=String(reason);}
    },
    reconnect(){
      if(started){offline=false;offlineReason=null;}
    }
  };

  return Object.freeze(assertIoTAdapter(adapter));
}
