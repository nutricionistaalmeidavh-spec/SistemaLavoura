const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const clone=value=>value==null?value:structuredClone(value);

export function createProductSettings(persistence,{namespace,defaults={}}={}){
  if(!persistence?.putRecord||!persistence?.getRecord)throw new TypeError('Persistence adapter is required.');
  const ns=text(namespace,'Settings namespace');
  const collection=`settings:${ns}`;
  const recordId='state';
  const base=Object.freeze(clone(defaults??{}));
  async function current(){return await persistence.getRecord(collection,recordId,{includeDeleted:true})??{payload:{values:{}},version:0};}
  async function save(values,version){const saved=await persistence.putRecord(collection,recordId,{values:clone(values)},{expectedVersion:version});return saved.payload.values;}
  return Object.freeze({
    namespace:ns,
    async get(key){const name=text(key,'Setting key'),record=await current();return Object.prototype.hasOwnProperty.call(record.payload.values??{},name)?clone(record.payload.values[name]):clone(base[name]);},
    async set(key,value){const name=text(key,'Setting key'),record=await current(),values={...(record.payload.values??{}),[name]:clone(value)};await save(values,record.version);return clone(value);},
    async delete(key){const name=text(key,'Setting key'),record=await current(),values={...(record.payload.values??{})};const existed=Object.prototype.hasOwnProperty.call(values,name);delete values[name];if(existed)await save(values,record.version);return existed;},
    async merge(input={}){if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('Settings values must be an object.');const record=await current(),values={...(record.payload.values??{}),...clone(input)};await save(values,record.version);return Object.freeze({...base,...clone(values)});},
    async snapshot(){const record=await current();return Object.freeze({...base,...clone(record.payload.values??{})});}
  });
}
