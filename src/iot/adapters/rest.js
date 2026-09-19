import {assertIoTAdapter} from '../adapter.js';

const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const finite=(value,label)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${label} must be finite.`);return value;};
const getPath=(object,path)=>String(path).split('.').reduce((value,key)=>value?.[key],object);

export function createRestTelemetryAdapter({id='rest-machine-api',protocol='rest-machine-api',config={},fetchImpl=globalThis.fetch,tokenProvider=null,recordSelector=body=>body?.values??body?.data??body,mappings=[],clock=()=>new Date()}={}){
  if(typeof fetchImpl!=='function')throw new TypeError('REST telemetry fetch implementation is required.');
  if(tokenProvider!==null&&typeof tokenProvider!=='function')throw new TypeError('REST telemetry tokenProvider must be a function.');
  if(typeof recordSelector!=='function')throw new TypeError('REST telemetry recordSelector must be a function.');
  if(!Array.isArray(mappings)||!mappings.length)throw new TypeError('REST telemetry mappings are required.');
  const adapterId=text(id,'REST adapter id'),adapterProtocol=text(protocol,'REST adapter protocol'),resourceUrl=text(config.resourceUrl,'REST resourceUrl');
  const normalized=mappings.map((mapping,index)=>{
    if(!mapping||typeof mapping!=='object')throw new TypeError(`REST mapping ${index} is invalid.`);
    const deviceId=typeof mapping.deviceId==='function'?mapping.deviceId:text(mapping.deviceId,'Device id');
    return Object.freeze({...mapping,deviceId,metric:text(mapping.metric,'Metric'),unit:text(mapping.unit,'Unit')});
  });
  const handlers=new Set();let started=false,polls=0,records=0,lastError=null;
  const resolve=(definition,record)=>typeof definition==='function'?definition(record):getPath(record,definition);
  const adapter={
    id:adapterId,protocol:adapterProtocol,
    async start(){started=true;return adapter.health();},
    async stop(){started=false;return adapter.health();},
    async health(){return Object.freeze({id:adapterId,protocol:adapterProtocol,status:started?'ready':'stopped',polls,records,lastError,resourceUrl});},
    onReading(handler){if(typeof handler!=='function')throw new TypeError('Reading handler must be a function.');handlers.add(handler);return()=>handlers.delete(handler);},
    async pollOnce(){
      if(!started)throw new Error('REST telemetry adapter is stopped.');polls+=1;
      const token=tokenProvider?await tokenProvider():null;const headers={...(config.headers??{}),...(token?{Authorization:`Bearer ${token}`}:{})};
      const response=await fetchImpl(resourceUrl,{method:'GET',headers});if(!response?.ok)throw new Error(`REST telemetry request failed: ${response?.status??'unknown'}`);
      const body=await response.json();const selected=await recordSelector(body);const rows=Array.isArray(selected)?selected:[];const now=clock().toISOString();let emitted=0;
      try{
        for(const record of rows)for(const mapping of normalized){
          const raw=resolve(mapping.value,record);if(raw===undefined||raw===null)continue;
          const observedRaw=mapping.observedAt?resolve(mapping.observedAt,record):now;const observedAt=new Date(observedRaw??now).toISOString();
          const deviceId=typeof mapping.deviceId==='function'?mapping.deviceId(record):mapping.deviceId;
          const reading=Object.freeze({id:`${adapterId}:${deviceId}:${mapping.metric}:${observedAt}:${emitted+1}`,deviceId:text(deviceId,'Device id'),metric:mapping.metric,value:finite(Number(raw),'REST telemetry value'),unit:mapping.unit,observedAt,receivedAt:now,quality:'good',sequence:null,metadata:Object.freeze({source:adapterProtocol})});
          for(const handler of [...handlers])await handler(reading);emitted+=1;records+=1;
        }
        lastError=null;return Object.freeze({records:rows.length,emitted});
      }catch(error){lastError=error instanceof Error?error.message:String(error);throw error;}
    }
  };
  return Object.freeze(assertIoTAdapter(adapter));
}

export const createJohnDeereOperationsCenterAdapter=(options={})=>createRestTelemetryAdapter({...options,id:options.id??'john-deere-operations-center',protocol:'john-deere-operations-center'});
export const createCnhFieldOpsAdapter=(options={})=>createRestTelemetryAdapter({...options,id:options.id??'cnh-fieldops',protocol:'cnh-fieldops'});
export const createPartnerMachineApiAdapter=(options={})=>createRestTelemetryAdapter({...options,protocol:options.protocol??'partner-machine-api'});
