const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const safeName=value=>{const name=text(value,'Filename');if(name.includes('..')||/[\\/\0]/.test(name))throw new TypeError('Unsafe filename.');return name;};
const decodeBase64=value=>{const source=text(value,'File content');let raw;try{raw=atob(source);}catch{throw new TypeError('File content must be valid base64.');}const bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes;};
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function sha256(bytes){if(!globalThis.crypto?.subtle)throw new Error('Web Crypto is required for file integrity.');return hex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes)));}
export function createFileService(persistence,{namespace='agro-lavoura',maxBytes=10*1024*1024,flags=null}={}){
  const collection=`${namespace}.files`;
  const requireEnabled=async()=>{if(flags&&await flags.enabled('files.enabled')===false)throw new Error('Files feature is disabled.');};
  return Object.freeze({
    async upload(input={}){await requireEnabled();const id=text(input.id,'File id'),name=safeName(input.name),mimeType=text(input.mimeType,'MIME type'),bytes=decodeBase64(input.bytesBase64);if(bytes.byteLength===0)throw new TypeError('File cannot be empty.');if(bytes.byteLength>maxBytes)throw new RangeError(`File exceeds maximum size of ${maxBytes} bytes.`);const current=await persistence.getRecord(collection,id);if(current)throw new Error(`File already exists: ${id}.`);const payload=Object.freeze({id,name,mimeType,size:bytes.byteLength,sha256:await sha256(bytes),bytesBase64:input.bytesBase64,entityType:input.entityType?text(input.entityType,'Entity type'):null,entityId:input.entityId?text(input.entityId,'Entity id'):null,createdAt:new Date().toISOString()});return persistence.putRecord(collection,id,payload,{expectedVersion:0});},
    async get(id){return persistence.getRecord(collection,text(id,'File id'));},
    async download(id){await requireEnabled();const record=await persistence.getRecord(collection,text(id,'File id'));if(!record)throw new Error('File not found.');return Object.freeze({...record.payload});},
    async list({entityType=null,entityId=null}={}){const records=await persistence.listRecords(collection);return records.filter(record=>(!entityType||record.payload.entityType===entityType)&&(!entityId||record.payload.entityId===entityId));},
    async remove(id){await requireEnabled();const record=await persistence.getRecord(collection,text(id,'File id'));if(!record)throw new Error('File not found.');return persistence.softDeleteRecord(collection,record.id,{expectedVersion:record.version});}
  });
}
