const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
export const P2_FEATURE_DEFAULTS=Object.freeze({'capture.enabled':true,'files.enabled':true,'pdf.enabled':true,'checklists.enabled':true,'catalog.enabled':true,'checklists.enforceBeforeOperationComplete':false});
export function createFeatureFlags(persistence,{namespace='agro-lavoura',defaults=P2_FEATURE_DEFAULTS}={}){
  const collection=`${namespace}.feature-flags`;
  return Object.freeze({
    defaults:Object.freeze({...defaults}),
    async get(key){const k=text(key,'Feature flag key'),record=await persistence.getRecord(collection,k);return record?record.payload.value:(k in defaults?defaults[k]:false);},
    async enabled(key){return (await this.get(key))===true;},
    async set(key,value){const k=text(key,'Feature flag key');if(typeof value!=='boolean')throw new TypeError('Feature flag value must be boolean.');const current=await persistence.getRecord(collection,k);return persistence.putRecord(collection,k,{key:k,value},{expectedVersion:current?.version??0});},
    async snapshot(){const records=await persistence.listRecords(collection);const result={...defaults};for(const record of records)result[record.id]=record.payload.value;return Object.freeze(result);}
  });
}
