import {mkdir,readdir,copyFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSqlMigrations,openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createAgroLavouraPresentation} from '../src/presentation.js';
import {createRpcBackend} from './backend.mjs';

const PRODUCT_ID='agro-lavoura';
const DATABASE_FILE='artisys-safras-talhoes.sqlite';
const migrationDir=fileURLToPath(new URL('../migrations/',import.meta.url));
const safeId=(value)=>String(value??new Date().toISOString()).replace(/[^a-zA-Z0-9._-]/g,'-');

export async function createStandaloneHost({dataDir,backupDir=join(dataDir,'backups')}={}){
  if(typeof dataDir!=='string'||!dataDir.trim())throw new TypeError('dataDir is required.');
  await mkdir(dataDir,{recursive:true});await mkdir(backupDir,{recursive:true});
  const dbPath=join(dataDir,DATABASE_FILE);
  const migrations=await loadSqlMigrations([{namespace:PRODUCT_ID,dir:migrationDir}]);
  const open=()=>openProductPersistence({dbPath,productId:PRODUCT_ID,migrations});
  let current=await open();
  const call=(name,args)=>{if(!current)throw new Error('Persistence is quiesced.');const fn=current[name];if(typeof fn!=='function')throw new TypeError(`Persistence method ${name} is unavailable.`);return fn.apply(current,args);};
  const persistence=Object.freeze({
    productId:PRODUCT_ID,
    applySeed:(...a)=>call('applySeed',a),putRecord:(...a)=>call('putRecord',a),getRecord:(...a)=>call('getRecord',a),listRecords:(...a)=>call('listRecords',a),listCollections:(...a)=>call('listCollections',a),softDeleteRecord:(...a)=>call('softDeleteRecord',a),recordHistory:(...a)=>call('recordHistory',a),schemaState:(...a)=>call('schemaState',a),health:(...a)=>call('health',a)
  });
  async function quiesced(work){const old=current;current=null;await old?.close?.();try{return await work();}finally{current=await open();}}
  const recovery=Object.freeze({
    async createBackup({id=`backup-${Date.now()}`}={}){const backupId=safeId(id),path=join(backupDir,`${backupId}.sqlite`);await quiesced(()=>copyFile(dbPath,path));const info=await stat(path);return {id:backupId,createdAt:info.mtime.toISOString(),path};},
    async listBackups(){const names=(await readdir(backupDir)).filter(name=>name.endsWith('.sqlite')).sort().reverse();return Promise.all(names.map(async name=>{const path=join(backupDir,name),info=await stat(path);return{id:name.slice(0,-7),createdAt:info.mtime.toISOString(),path};}));},
    async restoreBackup(id){const backupId=safeId(id),source=join(backupDir,`${backupId}.sqlite`),safety=join(backupDir,`safety-${Date.now()}.sqlite`);await quiesced(async()=>{await copyFile(dbPath,safety);await copyFile(source,dbPath);});return{restored:true,backupId,safetyBackupId:safety.split(/[\\/]/).at(-1).replace(/\.sqlite$/,'')};}
  });
  const presentation=createAgroLavouraPresentation({persistence,recovery});
  const backend=createRpcBackend({presentation});
  return Object.freeze({productId:PRODUCT_ID,dbPath,backupDir,persistence,recovery,presentation,backend,async close(){const old=current;current=null;await old?.close?.();}});
}
