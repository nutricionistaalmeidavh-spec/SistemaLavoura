import {createInventory,availableQuantity,createInventoryMovement,applyTrackedMovement,reserveStock,releaseStock,traceInventory} from '../../../vendor/release-modules/artisys-inventory/src/index.mjs';
const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim();};
const collection=(ns)=>`inventory:${ns}`;
const empty=()=>({state:createInventory(),events:[]});
export function createProductInventoryService(persistence,{namespace}={}){
  if(!persistence||typeof persistence.putRecord!=='function')throw new TypeError('Persistence adapter is required.');
  const ns=text(namespace,'Inventory namespace');
  async function load(){const record=await persistence.getRecord(collection(ns),'ledger',{includeDeleted:true});return record??{payload:empty(),version:0};}
  async function save(payload,version){return persistence.putRecord(collection(ns),'ledger',payload,{expectedVersion:version});}
  return Object.freeze({
    async snapshot(){const r=await load();return {state:r.payload.state,events:r.payload.events,version:r.version};},
    async apply(input,{adjustmentDelta=null}={}){const r=await load();const movement=input?.delta!==undefined?input:createInventoryMovement(input);const state=applyTrackedMovement(r.payload.state,movement,{adjustmentDelta});const event=Object.freeze({...movement,type:'movement'});const saved=await save({state,events:[...r.payload.events,event]},r.version);return {record:saved,movement,event};},
    async reserve(sku,amount,{id,reference=null,occurredAt=new Date().toISOString()}={}){const r=await load();const state=reserveStock(r.payload.state,sku,amount);const event=Object.freeze({id:text(id,'Reservation event id'),type:'reserve',sku:String(sku),quantity:Number(amount),reference,occurredAt:new Date(occurredAt).toISOString()});const saved=await save({state,events:[...r.payload.events,event]},r.version);return {record:saved,event};},
    async release(sku,amount,{id,reference=null,occurredAt=new Date().toISOString()}={}){const r=await load();const state=releaseStock(r.payload.state,sku,amount);const event=Object.freeze({id:text(id,'Release event id'),type:'release',sku:String(sku),quantity:Number(amount),reference,occurredAt:new Date(occurredAt).toISOString()});const saved=await save({state,events:[...r.payload.events,event]},r.version);return {record:saved,event};},
    async available(sku){const r=await load();return availableQuantity(r.payload.state[String(sku)]);},
    async trace(sku){const r=await load();return {...traceInventory(r.payload.state,sku),events:r.payload.events.filter(e=>String(e.sku)===String(sku))};}
  });
}