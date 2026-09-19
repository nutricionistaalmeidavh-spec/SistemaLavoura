import { IndexedDbStorage, namespaceStorage } from '../../../vendor/release-modules/artisys-storage/src/browser.mjs';

const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const segment=(value)=>encodeURIComponent(text(value,'Storage key'));
const currentPath=(collection,id)=>`records/${segment(collection)}/${segment(id)}`;
const historyPrefix=(collection,id)=>`history/${segment(collection)}/${segment(id)}/`;
const historyPath=(record)=>`${historyPrefix(record.collection,record.id)}${String(record.version).padStart(12,'0')}`;
const nowIso=()=>new Date().toISOString();
const backupId=()=>globalThis.crypto?.randomUUID?.()??`backup-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const normalizeRecoveryCode=(value)=>text(value,'Recovery code').replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
const formatRecoveryCode=(value)=>normalizeRecoveryCode(value).match(/.{1,4}/g)?.join('-')??'';
const recoveryCodeFor=async(productId,backup)=>{if(!globalThis.crypto?.subtle)throw new Error('Web Crypto is required for local recovery codes.');const bytes=new TextEncoder().encode(`${productId}\0${backup.id}\0${JSON.stringify(backup.snapshot)}`),digest=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes));return formatRecoveryCode(Array.from(digest.slice(0,8),byte=>byte.toString(16).padStart(2,'0')).join(''));};
const isAuditCollection=(name)=>String(name).startsWith('security-audit:');

export function createBrowserPersistence({storage=null,indexedDB=globalThis.indexedDB,productId,dbName=null}={}){
  const pid=text(productId,'Product id');
  const ownsStorage=!storage;
  const raw=storage??new IndexedDbStorage({indexedDB,dbName:dbName??`artisys-${pid}`});
  const scoped=namespaceStorage(raw,`product:${pid}`);
  let closed=false;
  let transactionTail=Promise.resolve();
  const ensureOpen=()=>{if(closed)throw new Error('Browser persistence is closed.');};
  const saveExact=async(record)=>{await scoped.put(currentPath(record.collection,record.id),record);await scoped.put(historyPath(record),record);return record;};
  const api={
    productId:pid,
    storage:scoped,
    async putRecord(collection,id,payload,{expectedVersion}={}){ensureOpen();const c=text(collection,'Collection'),key=text(id,'Record id');const current=await api.getRecord(c,key,{includeDeleted:true});const version=current?.version??0;if(expectedVersion!==undefined&&expectedVersion!==version){const error=new Error('version conflict');error.code='VERSION_CONFLICT';throw error;}const next=Object.freeze({collection:c,id:key,payload:structuredClone(payload),version:version+1,deletedAt:null,updatedAt:nowIso()});return saveExact(next);},
    async getRecord(collection,id,{includeDeleted=false}={}){ensureOpen();const found=await scoped.get(currentPath(collection,id));const record=found?.value??null;if(!record||(!includeDeleted&&record.deletedAt))return null;return structuredClone(record);},
    async listRecords(collection,{includeDeleted=false}={}){ensureOpen();const prefix=`records/${segment(collection)}/`;const paths=await scoped.list(prefix);const out=[];for(const path of paths){const found=await scoped.get(path);const record=found?.value;if(record&&(includeDeleted||!record.deletedAt))out.push(structuredClone(record));}return out.sort((a,b)=>String(a.id).localeCompare(String(b.id)));},
    async listCollections({includeSystem=false}={}){ensureOpen();const paths=await scoped.list('records/');const names=new Set();for(const path of paths){const parts=path.split('/');if(parts.length<3)continue;const collection=decodeURIComponent(parts[1]);if(includeSystem||!collection.startsWith('__'))names.add(collection);}return [...names].sort((a,b)=>a.localeCompare(b));},
    async softDeleteRecord(collection,id,{expectedVersion,at=nowIso()}={}){ensureOpen();const current=await api.getRecord(collection,id,{includeDeleted:true});if(!current)throw new Error('not found');if(expectedVersion!==undefined&&expectedVersion!==current.version){const error=new Error('version conflict');error.code='VERSION_CONFLICT';throw error;}const next=Object.freeze({...current,version:current.version+1,deletedAt:new Date(at).toISOString(),updatedAt:new Date(at).toISOString()});return saveExact(next);},
    async recordHistory(collection,id){ensureOpen();const paths=await scoped.list(historyPrefix(collection,id));const out=[];for(const path of paths){const found=await scoped.get(path);if(found?.value)out.push(structuredClone(found.value));}return out.sort((a,b)=>a.version-b.version);},
    async exportSnapshot(){ensureOpen();const paths=[...(await scoped.list('records/')),...(await scoped.list('history/'))];const entries=[];for(const path of paths){const found=await scoped.get(path);if(found)entries.push(Object.freeze({path,value:structuredClone(found.value),metadata:structuredClone(found.metadata??{})}));}return Object.freeze({schemaVersion:1,productId:pid,createdAt:nowIso(),entries:Object.freeze(entries)});},
    async importSnapshot(snapshot,{clear=true}={}){ensureOpen();if(snapshot?.productId!==pid||!Array.isArray(snapshot?.entries))throw new TypeError('Invalid browser persistence snapshot.');if(clear){for(const prefix of ['records/','history/'])for(const path of await scoped.list(prefix))await scoped.delete(path);}for(const entry of snapshot.entries)await scoped.put(entry.path,entry.value,{metadata:entry.metadata??{}});return Object.freeze({restored:true,productId:pid,entries:snapshot.entries.length});},
    async runInTransaction(work){
      ensureOpen();
      if(typeof work!=='function')throw new TypeError('Transaction work must be a function.');
      let release;
      const gate=new Promise(resolve=>{release=resolve;});
      const previous=transactionTail;
      transactionTail=previous.then(()=>gate);
      await previous;
      try{
        const snapshot=await api.exportSnapshot();
        try{return await work(api);}catch(error){await api.importSnapshot(snapshot,{clear:true});throw error;}
      }finally{release();}
    },
    async schemaState(){return Object.freeze({driver:'browser-storage',productId:pid,migrations:Object.freeze([])});},
    async health(){ensureOpen();const state=await scoped.health?.();return Object.freeze({ok:state?.ok!==false,driver:state?.driver??'browser-storage',productId:pid});},
    async close({closeStorage=ownsStorage}={}){if(closed)return;closed=true;if(closeStorage)await scoped.close?.();}
  };
  return Object.freeze(api);
}

export function createBrowserRecovery(persistence,{productId,files=null}={}){
  const pid=text(productId??persistence?.productId,'Product id');
  if(!persistence?.exportSnapshot||!persistence?.importSnapshot)throw new TypeError('Browser persistence snapshot support is required.');
  if(files&&(typeof files.exportSnapshot!=='function'||typeof files.importSnapshot!=='function'))throw new TypeError('Browser files snapshot support is required.');
  const storage=persistence.storage;
  const pathFor=(id)=>`recovery/backups/${segment(id)}`;
  const validDataSnapshot=(snapshot)=>Boolean(snapshot&&snapshot.productId===pid&&Array.isArray(snapshot.entries));
  const validFilesSnapshot=(snapshot)=>Boolean(snapshot&&snapshot.schemaVersion===1&&Array.isArray(snapshot.entries));
  const loadBackup=async(id)=>{const found=await storage.get(pathFor(id));if(!found?.value)throw new Error('Backup not found.');return found.value;};
  const captureAuditRecords=async()=>{const out=[];for(const collection of (await persistence.listCollections({includeSystem:true})).filter(isAuditCollection)){for(const record of await persistence.listRecords(collection,{includeDeleted:true}))out.push(record);}return out;};
  const mergeAuditRecords=async(records)=>{for(const record of records){if(!await persistence.getRecord(record.collection,record.id,{includeDeleted:true}))await persistence.putRecord(record.collection,record.id,record.payload,{expectedVersion:0});}};
  const restorePayload=async(backup)=>{
    const database=await persistence.importSnapshot(backup.snapshot,{clear:true});
    let attachments=null;
    if(backup.filesSnapshot){
      if(!files)throw new Error('Backup contains attachments but no files workspace is available.');
      attachments=await files.importSnapshot(backup.filesSnapshot,{clear:true});
    }
    return Object.freeze({database,attachments});
  };
  return Object.freeze({
    async createBackup({id=backupId(),createdAt=nowIso()}={}){
      const snapshot=await persistence.exportSnapshot();
      const filesSnapshot=files?await files.exportSnapshot():null;
      const backup=Object.freeze({id,productId:pid,createdAt:new Date(createdAt).toISOString(),snapshot,...(filesSnapshot?{filesSnapshot}:{})});
      await storage.put(pathFor(id),backup);
      return backup;
    },
    async listBackups(){const out=[];for(const path of await storage.list('recovery/backups/')){const found=await storage.get(path);if(found?.value)out.push(found.value);}return out.sort((a,b)=>b.createdAt.localeCompare(a.createdAt));},
    async verifyBackup(id){
      const found=await storage.get(pathFor(id));const backup=found?.value;
      const databaseValid=Boolean(backup&&backup.productId===pid&&validDataSnapshot(backup.snapshot));
      const attachmentsValid=!backup?.filesSnapshot||validFilesSnapshot(backup.filesSnapshot);
      return Object.freeze({valid:databaseValid&&attachmentsValid,databaseValid,attachmentsValid,hasAttachments:Boolean(backup?.filesSnapshot),backupId:id,productId:pid});
    },
    async createRecoveryCode(id){const backup=await loadBackup(id),verification=await this.verifyBackup(id);if(!verification.valid)throw new Error('Backup is invalid.');return Object.freeze({code:await recoveryCodeFor(pid,backup),backupId:id,productId:pid,createdAt:backup.createdAt});},
    async resolveRecoveryCode(code){const wanted=normalizeRecoveryCode(code);for(const backup of await this.listBackups()){const candidate=await recoveryCodeFor(pid,backup);if(normalizeRecoveryCode(candidate)!==wanted)continue;const verification=await this.verifyBackup(backup.id);if(!verification.valid)throw new Error('Recovery backup is invalid.');return Object.freeze({code:candidate,backupId:backup.id,productId:pid,createdAt:backup.createdAt});}throw new Error('Recovery code not found for this product.');},
    async restoreBackup(id,{safetySnapshot=true}={}){
      const backup=await loadBackup(id);
      const verification=await this.verifyBackup(id);if(!verification.valid)throw new Error('Backup is invalid.');
      const auditRecords=await captureAuditRecords();
      let safetyBackupId=null;
      if(safetySnapshot){const safety=await this.createBackup({id:`safety-${backupId()}`});safetyBackupId=safety.id;}
      try{
        const restored=await restorePayload(backup);
        await mergeAuditRecords(auditRecords);
        return Object.freeze({restored:true,productId:pid,backupId:id,safetyBackupId,database:restored.database,attachments:restored.attachments});
      }catch(error){
        if(safetyBackupId){
          try{const safety=await storage.get(pathFor(safetyBackupId));if(safety?.value)await restorePayload(safety.value);error.restoreRolledBack=true;}catch(rollbackError){error.restoreRollbackError=rollbackError?.message??String(rollbackError);}
        }
        throw error;
      }
    },
    async restoreByRecoveryCode(code,options={}){const resolved=await this.resolveRecoveryCode(code);return Object.freeze({...await this.restoreBackup(resolved.backupId,options),recoveryCode:resolved.code});},
    health:async()=>({ok:true,driver:'browser-local-snapshot',productId:pid,attachments:Boolean(files),recoveryCodes:true})
  });
}
