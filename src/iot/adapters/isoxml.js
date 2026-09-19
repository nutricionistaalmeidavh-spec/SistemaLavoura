import {assertIoTAdapter} from '../adapter.js';

export const ISOXML_MESSAGE_TYPE='iso:11783:-10:taskdata:zip';
const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const finite=(value,label)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${label} must be finite.`);return value;};

export function createIsoXmlIoTAdapter({id='isoxml',taskDataReader,clock=()=>new Date()}={}){
  if(typeof taskDataReader!=='function')throw new TypeError('ISOXML taskDataReader is required and must be supplied by the host integration.');
  const adapterId=text(id,'ISOXML adapter id');
  const handlers=new Set();let started=false,imports=0,records=0,lastError=null;
  const adapter={
    id:adapterId,protocol:'isoxml',
    async start(){started=true;return adapter.health();},
    async stop(){started=false;return adapter.health();},
    async health(){return Object.freeze({id:adapterId,protocol:'isoxml',status:started?'ready':'stopped',imports,records,lastError,messageType:ISOXML_MESSAGE_TYPE});},
    onReading(handler){if(typeof handler!=='function')throw new TypeError('Reading handler must be a function.');handlers.add(handler);return()=>handlers.delete(handler);},
    async importTaskData(payload,context={}){
      if(!started)throw new Error('ISOXML adapter is stopped.');
      imports+=1;
      try{
        const decoded=await taskDataReader(payload,context);
        if(!Array.isArray(decoded))throw new TypeError('ISOXML taskDataReader must return an array of normalized records.');
        const now=clock().toISOString();
        for(const record of decoded){
          const observedAt=new Date(record.observedAt??now).toISOString();
          const reading=Object.freeze({id:record.id??`${adapterId}:${record.deviceId}:${record.metric}:${observedAt}:${records+1}`,deviceId:text(record.deviceId,'Device id'),metric:text(record.metric,'Metric'),value:finite(record.value,'ISOXML value'),unit:text(record.unit,'Unit'),observedAt,receivedAt:now,quality:record.quality??'good',sequence:record.sequence??null,metadata:Object.freeze({taskId:record.taskId??context.taskId??null,sourceFile:context.sourceFile??null})});
          for(const handler of [...handlers])await handler(reading);
          records+=1;
        }
        lastError=null;return Object.freeze({records:decoded.length});
      }catch(error){lastError=error instanceof Error?error.message:String(error);throw error;}
    }
  };
  return Object.freeze(assertIoTAdapter(adapter));
}
