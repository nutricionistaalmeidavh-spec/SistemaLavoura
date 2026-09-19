import {assertIoTAdapter} from '../adapter.js';

const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const defaultMapper=payload=>payload;

export function createLoRaWanIoTAdapter({id='lorawan',config={},sourceFactory,uplinkMapper=defaultMapper}={}){
  if(typeof sourceFactory!=='function')throw new TypeError('LoRaWAN sourceFactory is required and must be provided by the optional gateway/API integration.');
  if(typeof uplinkMapper!=='function')throw new TypeError('LoRaWAN uplinkMapper must be a function.');
  const adapterId=text(id,'LoRaWAN adapter id');
  const provider=text(config.provider??'custom','LoRaWAN provider').toLowerCase();
  const handlers=new Set();
  let source=null,unsubscribe=null,started=false,decodeErrors=0,sourceErrors=0,lastError=null,uplinks=0;

  async function handleUplink(payload){
    let reading;
    try{reading=await uplinkMapper(payload);}
    catch(error){decodeErrors+=1;lastError=error instanceof Error?error.message:String(error);return;}
    uplinks+=1;lastError=null;
    for(const handler of [...handlers])await handler(reading);
  }

  const adapter={
    id:adapterId,
    protocol:'lorawan',
    async start(){
      if(started)return adapter.health();
      source=await sourceFactory({...config});
      if(!source||typeof source.onUplink!=='function')throw new TypeError('LoRaWAN source must expose onUplink().');
      unsubscribe=source.onUplink(handleUplink);
      try{if(typeof source.start==='function')await source.start();}
      catch(error){sourceErrors+=1;lastError=error instanceof Error?error.message:String(error);unsubscribe?.();unsubscribe=null;source=null;throw error;}
      started=true;lastError=null;
      return adapter.health();
    },
    async stop(){
      const current=source;source=null;started=false;unsubscribe?.();unsubscribe=null;
      if(current&&typeof current.stop==='function')await current.stop();
      return adapter.health();
    },
    async health(){return Object.freeze({id:adapterId,protocol:'lorawan',provider,status:started?'online':'stopped',decodeErrors,sourceErrors,uplinks,lastError});},
    onReading(handler){if(typeof handler!=='function')throw new TypeError('Reading handler must be a function.');handlers.add(handler);return()=>handlers.delete(handler);}
  };
  return Object.freeze(assertIoTAdapter(adapter));
}
