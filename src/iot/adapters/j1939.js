import {assertIoTAdapter} from '../adapter.js';
import {decodeCanSignal} from './can.js';

const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const finite=(value,label)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${label} must be finite.`);return value;};

export function decodeJ1939Identifier(canId){
  if(!Number.isInteger(canId)||canId<0||canId>0x1fffffff)throw new TypeError('J1939 CAN id must be a 29-bit integer.');
  const priority=(canId>>>26)&0x7,dataPage=(canId>>>24)&0x1,pduFormat=(canId>>>16)&0xff,pduSpecific=(canId>>>8)&0xff,sourceAddress=canId&0xff;
  const pgn=(dataPage<<16)|(pduFormat<<8)|(pduFormat<240?0:pduSpecific);
  return Object.freeze({priority,dataPage,pduFormat,pduSpecific,sourceAddress,destinationAddress:pduFormat<240?pduSpecific:null,pgn});
}

export function createJ1939IoTAdapter({id='j1939',sourceFactory,mappings=[],clock=()=>new Date()}={}){
  if(typeof sourceFactory!=='function')throw new TypeError('J1939 sourceFactory is required.');
  if(!Array.isArray(mappings))throw new TypeError('J1939 mappings must be an array.');
  const adapterId=text(id,'J1939 adapter id');
  const normalized=mappings.map((mapping,index)=>{
    if(!mapping||typeof mapping!=='object')throw new TypeError(`J1939 mapping ${index} is invalid.`);
    if(!Number.isInteger(mapping.pgn)||mapping.pgn<0||mapping.pgn>0x3ffff)throw new TypeError('J1939 PGN must be a non-negative 18-bit integer.');
    return Object.freeze({...mapping,deviceId:text(mapping.deviceId,'Device id'),metric:text(mapping.metric,'Metric'),unit:text(mapping.unit,'Unit')});
  });
  const handlers=new Set();let source=null,unsubscribe=null,started=false,lastError=null,frames=0,decodeErrors=0;
  async function onFrame(frame){
    frames+=1;
    try{
      if(frame?.extended===false)return;
      const info=decodeJ1939Identifier(frame.id);
      const now=clock().toISOString();
      for(const mapping of normalized){
        if(mapping.pgn!==info.pgn)continue;
        if(mapping.sourceAddress!==undefined&&mapping.sourceAddress!==info.sourceAddress)continue;
        const decoder=typeof mapping.decoder==='function'?mapping.decoder:(payload)=>decodeCanSignal(payload,mapping.signal);
        const value=finite(await decoder(frame.data,frame,info,mapping),'Decoded J1939 value');
        const observedAt=new Date(frame.timestamp??now).toISOString();
        const reading=Object.freeze({id:`${adapterId}:${mapping.deviceId}:${mapping.metric}:${observedAt}:${frames}`,deviceId:mapping.deviceId,metric:mapping.metric,value,unit:mapping.unit,observedAt,receivedAt:now,quality:'good',sequence:frame.sequence??null,metadata:Object.freeze({...info})});
        for(const handler of [...handlers])await handler(reading);
      }
      lastError=null;
    }catch(error){decodeErrors+=1;lastError=error instanceof Error?error.message:String(error);}
  }
  const adapter={id:adapterId,protocol:'j1939',async start(){if(started)return adapter.health();source=await sourceFactory();if(!source||typeof source.start!=='function'||typeof source.stop!=='function'||typeof source.onFrame!=='function')throw new TypeError('J1939 source must expose start(), stop() and onFrame().');unsubscribe=source.onFrame(onFrame);await source.start();started=true;return adapter.health();},async stop(){if(unsubscribe)unsubscribe();unsubscribe=null;const current=source;source=null;started=false;if(current)await current.stop();return adapter.health();},async health(){return Object.freeze({id:adapterId,protocol:'j1939',status:started?'online':'stopped',frames,decodeErrors,lastError,mappings:normalized.length});},onReading(handler){if(typeof handler!=='function')throw new TypeError('Reading handler must be a function.');handlers.add(handler);return()=>handlers.delete(handler);}};
  return Object.freeze(assertIoTAdapter(adapter));
}
