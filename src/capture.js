const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const SOURCES=new Set(['camera','file','manual']);
export function createCaptureService({persistence,files,flags=null,namespace='agro-lavoura'}={}){
  const collection=`${namespace}.captures`;
  return Object.freeze({
    async capture(input={}){if(flags&&await flags.enabled('capture.enabled')===false)throw new Error('Capture feature is disabled.');const id=text(input.id,'Capture id'),source=input.source??'file';if(!SOURCES.has(source))throw new TypeError(`Unsupported capture source: ${source}.`);const file=await files.upload({id:text(input.fileId,'Capture file id'),name:input.name,mimeType:input.mimeType,bytesBase64:input.bytesBase64,entityType:input.entityType,entityId:input.entityId});const payload=Object.freeze({id,fileId:file.id,source,entityType:input.entityType??null,entityId:input.entityId??null,capturedAt:input.capturedAt?new Date(input.capturedAt).toISOString():new Date().toISOString(),metadata:Object.freeze({...input.metadata})});return persistence.putRecord(collection,id,payload,{expectedVersion:0});},
    async list({entityType=null,entityId=null}={}){const records=await persistence.listRecords(collection);return records.filter(record=>(!entityType||record.payload.entityType===entityType)&&(!entityId||record.payload.entityId===entityId));}
  });
}
