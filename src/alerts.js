import {createAlert,acknowledgeAlert,snoozeAlert,dismissAlert,listDueAlerts} from '../shared/vendor/release-modules/artisys-alerts/src/index.mjs';

const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};

export function createCropAlertService(persistence,{namespace='agro-lavoura'}={}){
  if(!persistence?.putRecord)throw new TypeError('Persistence adapter is required.');
  const collection=`alerts:${text(namespace,'Alerts namespace')}`;
  async function load(id){const record=await persistence.getRecord(collection,text(id,'Alert id'));if(!record)throw new Error('Alert not found.');return record;}
  async function save(alert,record=null){const expectedVersion=record?.version??0;const saved=await persistence.putRecord(collection,alert.id,alert,{expectedVersion});return saved.payload;}
  return Object.freeze({
    async upsert(input){const current=await persistence.getRecord(collection,text(input?.id,'Alert id'));const alert=createAlert(input);return save(alert,current);},
    async get(id){const record=await persistence.getRecord(collection,text(id,'Alert id'));return record?.payload??null;},
    async list({status=null}={}){const records=await persistence.listRecords(collection);return records.map(record=>record.payload).filter(alert=>!status||alert.status===status).sort((a,b)=>a.dueAt.localeCompare(b.dueAt)||a.id.localeCompare(b.id));},
    async due({now=new Date().toISOString()}={}){return listDueAlerts((await persistence.listRecords(collection)).map(record=>record.payload),{now});},
    async acknowledge(id,options){const record=await load(id);return save(acknowledgeAlert(record.payload,options),record);},
    async snooze(id,options){const record=await load(id);return save(snoozeAlert(record.payload,options),record);},
    async dismiss(id,options){const record=await load(id);return save(dismissAlert(record.payload,options),record);}
  });
}
