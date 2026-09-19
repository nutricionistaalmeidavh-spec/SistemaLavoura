import {assertIoTAdapter} from '../adapter.js';

export const AGRIROUTER_MESSAGE_TYPES=Object.freeze([
  'iso:11783:-10:taskdata:zip',
  'iso:11783:-10:device_description:protobuf',
  'iso:11783:-10:time_log:protobuf'
]);
const supported=new Set(AGRIROUTER_MESSAGE_TYPES);
const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const finite=(value,label)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${label} must be finite.`);return value;};

export function createAgrirouterIoTAdapter({id='agrirouter',config={},fetchImpl=globalThis.fetch,tokenProvider=null,payloadDecoder,clock=()=>new Date()}={}){
  if(typeof fetchImpl!=='function')throw new TypeError('agrirouter fetch implementation is required.');
  if(typeof payloadDecoder!=='function')throw new TypeError('agrirouter payloadDecoder is required.');
  if(tokenProvider!==null&&typeof tokenProvider!=='function')throw new TypeError('agrirouter tokenProvider must be a function.');
  const adapterId=text(id,'agrirouter adapter id'),eventsUrl=text(config.eventsUrl,'agrirouter eventsUrl');
  const handlers=new Set();let started=false,polls=0,messages=0,ignored=0,decodeErrors=0,lastError=null;
  async function headers(){const token=tokenProvider?await tokenProvider():null;return token?{Authorization:`Bearer ${token}`}:{ };}
  const adapter={
    id:adapterId,protocol:'agrirouter',
    async start(){started=true;return adapter.health();},
    async stop(){started=false;return adapter.health();},
    async health(){return Object.freeze({id:adapterId,protocol:'agrirouter',status:started?'ready':'stopped',polls,messages,ignored,decodeErrors,lastError,messageTypes:AGRIROUTER_MESSAGE_TYPES});},
    onReading(handler){if(typeof handler!=='function')throw new TypeError('Reading handler must be a function.');handlers.add(handler);return()=>handlers.delete(handler);},
    async pollOnce(){
      if(!started)throw new Error('agrirouter adapter is stopped.');polls+=1;
      const response=await fetchImpl(eventsUrl,{headers:await headers()});
      if(!response?.ok)throw new Error(`agrirouter events request failed: ${response?.status??'unknown'}`);
      const body=await response.json();const events=Array.isArray(body)?body:(body?.events??body?.values??[]);
      let emitted=0;
      for(const event of events){
        if(event?.event_type!=='MESSAGE_RECEIVED'||!supported.has(event?.message_type)){ignored+=1;continue;}
        const uri=text(event.payload_uri,'agrirouter payload_uri');
        const payloadResponse=await fetchImpl(uri,{headers:await headers()});
        if(!payloadResponse?.ok)throw new Error(`agrirouter payload request failed: ${payloadResponse?.status??'unknown'}`);
        const payload=new Uint8Array(await payloadResponse.arrayBuffer());
        try{
          const decoded=await payloadDecoder({event,payload,messageType:event.message_type,teamSetContextId:event.teamset_context_id??null});
          const records=Array.isArray(decoded)?decoded:[];const now=clock().toISOString();
          for(const record of records){
            const observedAt=new Date(record.observedAt??event.sent_at??now).toISOString();
            const reading=Object.freeze({id:record.id??`${adapterId}:${event.id}:${emitted+1}`,deviceId:text(record.deviceId,'Device id'),metric:text(record.metric,'Metric'),value:finite(record.value,'agrirouter value'),unit:text(record.unit,'Unit'),observedAt,receivedAt:now,quality:record.quality??'good',sequence:record.sequence??null,metadata:Object.freeze({messageId:event.id,messageType:event.message_type,teamSetContextId:event.teamset_context_id??null})});
            for(const handler of [...handlers])await handler(reading);emitted+=1;
          }
          messages+=1;lastError=null;
        }catch(error){decodeErrors+=1;lastError=error instanceof Error?error.message:String(error);}
      }
      return Object.freeze({events:events.length,emitted,ignored});
    }
  };
  return Object.freeze(assertIoTAdapter(adapter));
}
