const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const TYPES=new Set(['crop','input','operation-type','unit','category']);
export function createAgriculturalCatalog(persistence,{namespace='agro-lavoura',flags=null}={}){
  const collection=`${namespace}.catalog`;
  const enabled=async()=>{if(flags&&await flags.enabled('catalog.enabled')===false)throw new Error('Catalog feature is disabled.');};
  return Object.freeze({
    async upsert(input={}){await enabled();const id=text(input.id,'Catalog id'),type=text(input.type,'Catalog type');if(!TYPES.has(type))throw new TypeError(`Unsupported catalog type: ${type}.`);const current=await persistence.getRecord(collection,id);const payload=Object.freeze({id,type,name:text(input.name,'Catalog name'),unit:input.unit?text(input.unit,'Catalog unit'):null,category:input.category?text(input.category,'Catalog category'):null,active:input.active!==false,metadata:Object.freeze({...input.metadata})});return persistence.putRecord(collection,id,payload,{expectedVersion:current?.version??0});},
    async get(id){return persistence.getRecord(collection,text(id,'Catalog id'));},
    async list({type=null,activeOnly=false}={}){const records=await persistence.listRecords(collection);return records.filter(record=>(!type||record.payload.type===type)&&(!activeOnly||record.payload.active));},
    async search(query,{type=null,limit=20}={}){const q=text(query,'Catalog search').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();const rows=await this.list({type,activeOnly:true});return rows.filter(record=>`${record.payload.name} ${record.payload.category??''}`.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().includes(q)).slice(0,limit);}
  });
}
