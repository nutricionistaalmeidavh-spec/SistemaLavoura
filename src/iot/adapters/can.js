import {assertIoTAdapter} from '../adapter.js';

const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const finite=(value,label)=>{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError(`${label} must be finite.`);return value;};
const timestamp=(value,fallback)=>{const source=value??fallback;const ms=Date.parse(source);if(!Number.isFinite(ms))throw new TypeError('CAN frame timestamp must be valid.');return new Date(ms).toISOString();};

export function decodeCanSignal(data,{byteOffset=0,length=1,endian='little',signed=false,scale=1,offset=0}={}){
  const bytes=data instanceof Uint8Array?data:Uint8Array.from(data??[]);
  if(!Number.isInteger(byteOffset)||byteOffset<0)throw new TypeError('CAN signal byteOffset must be a non-negative integer.');
  if(!Number.isInteger(length)||length<1||length>6)throw new TypeError('CAN signal length must be between 1 and 6 bytes.');
  if(byteOffset+length>bytes.length)throw new RangeError('CAN signal exceeds frame payload.');
  if(endian!=='little'&&endian!=='big')throw new TypeError('CAN signal endian must be little or big.');
  let raw=0n;
  if(endian==='little')for(let i=0;i<length;i++)raw|=BigInt(bytes[byteOffset+i])<<(8n*BigInt(i));
  else for(let i=0;i<length;i++)raw=(raw<<8n)|BigInt(bytes[byteOffset+i]);
  if(signed){const bits=BigInt(length*8),sign=1n<<(bits-1n);if(raw&sign)raw-=1n<<bits;}
  return finite(Number(raw)*finite(scale,'CAN signal scale')+finite(offset,'CAN signal offset'),'Decoded CAN signal');
}

export function createCanIoTAdapter({id='can',sourceFactory,mappings=[],clock=()=>new Date()}={}){
  if(typeof sourceFactory!=='function')throw new TypeError('CAN sourceFactory is required.');
  if(!Array.isArray(mappings))throw new TypeError('CAN mappings must be an array.');
  const adapterId=text(id,'CAN adapter id');
  const normalized=mappings.map((mapping,index)=>{
    if(!mapping||typeof mapping!=='object')throw new TypeError(`CAN mapping ${index} is invalid.`);
    if(!Number.isInteger(mapping.canId)||mapping.canId<0||mapping.canId>0x1fffffff)throw new TypeError('CAN mapping canId must be a valid CAN identifier.');
    return Object.freeze({...mapping,deviceId:text(mapping.deviceId,'Device id'),metric:text(mapping.metric,'Metric'),unit:text(mapping.unit,'Unit')});
  });
  const handlers=new Set();let source=null,unsubscribe=null,started=false,lastError=null,frames=0,decodeErrors=0;
  async function emit(frame){
    frames+=1;
    const now=clock().toISOString();
    for(const mapping of normalized){
      if(frame?.id!==mapping.canId)continue;
      try{
        const decoder=typeof mapping.decoder==='function'?mapping.decoder:(payload)=>decodeCanSignal(payload,mapping.signal);
        const value=finite(await decoder(frame.data,frame,mapping),'Decoded CAN value');
        const observedAt=timestamp(frame.timestamp,now);
        const reading=Object.freeze({id:`${adapterId}:${mapping.deviceId}:${mapping.metric}:${observedAt}:${frames}`,deviceId:mapping.deviceId,metric:mapping.metric,value,unit:mapping.unit,observedAt,receivedAt:now,quality:'good',sequence:frame.sequence??null,metadata:Object.freeze({canId:frame.id,extended:Boolean(frame.extended)})});
        for(const handler of [...handlers])await handler(reading);
        lastError=null;
      }catch(error){decodeErrors+=1;lastError=error instanceof Error?error.message:String(error);}
    }
  }
  const adapter={id:adapterId,protocol:'can',async start(){if(started)return adapter.health();source=await sourceFactory();if(!source||typeof source.start!=='function'||typeof source.stop!=='function'||typeof source.onFrame!=='function')throw new TypeError('CAN source must expose start(), stop() and onFrame().');unsubscribe=source.onFrame(emit);await source.start();started=true;return adapter.health();},async stop(){if(unsubscribe)unsubscribe();unsubscribe=null;const current=source;source=null;started=false;if(current)await current.stop();return adapter.health();},async health(){return Object.freeze({id:adapterId,protocol:'can',status:started?'online':'stopped',frames,decodeErrors,lastError,mappings:normalized.length});},onReading(handler){if(typeof handler!=='function')throw new TypeError('Reading handler must be a function.');handlers.add(handler);return()=>handlers.delete(handler);}};
  return Object.freeze(assertIoTAdapter(adapter));
}
