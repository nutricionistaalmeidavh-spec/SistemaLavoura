import {assertIoTAdapter} from '../adapter.js';

export const ISOBUS_FUNCTIONALITIES=Object.freeze(['UT','AUX','TECU','ISB','TIM','FS','TC-BAS','TC-GEO','TC-SC']);
const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const finite=(value,label)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${label} must be finite.`);return value;};

export function createIsobusIoTAdapter({id='isobus',sourceFactory,ddiMappings=[],clock=()=>new Date()}={}){
  if(typeof sourceFactory!=='function')throw new TypeError('ISOBUS sourceFactory is required.');
  if(!Array.isArray(ddiMappings))throw new TypeError('ISOBUS ddiMappings must be an array.');
  const adapterId=text(id,'ISOBUS adapter id');
  const mappings=new Map(ddiMappings.map((mapping,index)=>{
    if(!mapping||typeof mapping!=='object')throw new TypeError(`ISOBUS DDI mapping ${index} is invalid.`);
    if(!Number.isInteger(mapping.ddi)||mapping.ddi<0||mapping.ddi>65535)throw new TypeError('ISOBUS DDI must be a 16-bit non-negative integer.');
    return [mapping.ddi,Object.freeze({...mapping,metric:text(mapping.metric,'Metric'),unit:text(mapping.unit,'Unit')})];
  }));
  const handlers=new Set();let source=null,unsubscribe=null,started=false,lastError=null,records=0,ignored=0;
  async function onRecord(record){
    records+=1;
    try{
      const mapping=mappings.get(record?.ddi);if(!mapping){ignored+=1;return;}
      const now=clock().toISOString(),observedAt=new Date(record.observedAt??now).toISOString();
      const value=typeof mapping.value==='function'?await mapping.value(record):record.value;
      const reading=Object.freeze({id:record.id??`${adapterId}:${record.deviceId}:${record.ddi}:${observedAt}:${records}`,deviceId:text(record.deviceId,'Device id'),metric:mapping.metric,value:finite(value,'ISOBUS value'),unit:mapping.unit,observedAt,receivedAt:now,quality:record.quality??'good',sequence:record.sequence??null,metadata:Object.freeze({ddi:record.ddi,deviceElement:record.deviceElement??null})});
      for(const handler of [...handlers])await handler(reading);
      lastError=null;
    }catch(error){lastError=error instanceof Error?error.message:String(error);throw error;}
  }
  const adapter={id:adapterId,protocol:'isobus',async start(){if(started)return adapter.health();source=await sourceFactory();if(!source||typeof source.start!=='function'||typeof source.stop!=='function'||typeof source.onFrame!=='function')throw new TypeError('ISOBUS decoded source must expose start(), stop() and onFrame().');unsubscribe=source.onFrame(onRecord);await source.start();started=true;return adapter.health();},async stop(){if(unsubscribe)unsubscribe();unsubscribe=null;const current=source;source=null;started=false;if(current)await current.stop();return adapter.health();},async health(){return Object.freeze({id:adapterId,protocol:'isobus',status:started?'online':'stopped',records,ignored,lastError,ddiMappings:mappings.size,functionalities:ISOBUS_FUNCTIONALITIES});},onReading(handler){if(typeof handler!=='function')throw new TypeError('Reading handler must be a function.');handlers.add(handler);return()=>handlers.delete(handler);}};
  return Object.freeze(assertIoTAdapter(adapter));
}
