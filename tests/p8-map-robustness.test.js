import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createMapPackageManager,MapPackageError,normalizeMapPackageError,MAP_PACKAGE_CONSTANTS} from '../runtime/map-package-manager.mjs';

const exists=async path=>{try{await access(path);return true;}catch{return false;}};
const sha=value=>createHash('sha256').update(value).digest('hex');
const validManifest={
  schemaVersion:1,
  releaseVersion:'2026.09.1',
  generatedAt:'2026-09-20T12:00:00Z',
  source:{provider:'Protomaps Basemap daily build',license:'ODbL-1.0'},
  maps:[{
    id:'sp',name:'São Paulo',kind:'state',available:true,version:'2026.09.1',asset:'sp.pmtiles',size:1000,
    sha256:'a'.repeat(64),minZoom:7,maxZoom:14,bounds:[-53.2,-25.4,-44.1,-19.7],sourceDate:'2026-09-20'
  }]
};

async function prepareCli(dataDir){
  const dir=join(dataDir,'maps','tools',`pmtiles-${MAP_PACKAGE_CONSTANTS.PMTILES_VERSION}`);
  await mkdir(dir,{recursive:true});
  await writeFile(join(dir,'pmtiles.exe'),'fake-cli');
}

test('P8 normalizes ENOSPC into a stable retryable map error',()=>{
  const error=normalizeMapPackageError(Object.assign(new Error('no space'),{code:'ENOSPC'}),'MAP_EXTRACT_FAILED');
  assert.ok(error instanceof MapPackageError);
  assert.equal(error.code,'MAP_DISK_FULL');
  assert.equal(error.retryable,true);
});

test('P8 preserves last valid cached catalog when a refresh is invalid',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-p8-catalog-'));
  let mode='valid';
  const fetchImpl=async()=>({ok:true,status:200,async json(){return mode==='valid'?validManifest:{schemaVersion:99,maps:[]};}});
  const manager=createMapPackageManager({dataDir,platform:'win32',arch:'x64',fetchImpl});
  await manager.refreshCatalog('https://example.test/maps-manifest.json');
  mode='invalid';
  await assert.rejects(()=>manager.refreshCatalog('https://example.test/maps-manifest.json'),error=>error.code==='MAP_CATALOG_INVALID');
  const reopened=createMapPackageManager({dataDir,platform:'win32',arch:'x64',fetchImpl});
  const snapshot=await reopened.snapshot();
  assert.equal(snapshot.catalogVersion,'2026.09.1');
});

test('P8 restores known-good backup after interruption at backup-created',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-p8-recover-'));
  const packages=join(dataDir,'maps','packages');
  await mkdir(packages,{recursive:true});
  const id='farm-farm-1-detailed';
  const finalFile=`${id}.pmtiles`,backupFile=`${finalFile}.bak`,tempFile=`${finalFile}.part-1.pmtiles`;
  await writeFile(join(packages,backupFile),'known-good');
  await writeFile(join(packages,tempFile),'partial');
  await writeFile(join(packages,`${id}.json`),JSON.stringify({id,fileName:finalFile,size:10,profile:'detailed'}));
  await writeFile(join(packages,`${id}.transaction.json`),JSON.stringify({version:1,id,finalFile,backupFile,tempFile,metadataFile:`${id}.json`,stage:'backup-created',startedAt:'2026-09-20T12:00:00Z'}));
  const manager=createMapPackageManager({dataDir,platform:'linux',arch:'x64',fetchImpl:async()=>{throw new Error('offline');}});
  await manager.snapshot();
  assert.equal(await readFile(join(packages,finalFile),'utf8'),'known-good');
  assert.equal(await exists(join(packages,backupFile)),false);
  assert.equal(await exists(join(packages,tempFile)),false);
  assert.equal(await exists(join(packages,`${id}.transaction.json`)),false);
});

test('P8 preserves malformed recovery evidence instead of deleting a backup',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-p8-bad-journal-'));
  const packages=join(dataDir,'maps','packages');
  await mkdir(packages,{recursive:true});
  await writeFile(join(packages,'farm-farm-1-detailed.pmtiles.bak'),'known-good');
  await writeFile(join(packages,'farm-farm-1-detailed.transaction.json'),'{bad json');
  const manager=createMapPackageManager({dataDir,platform:'linux',arch:'x64',fetchImpl:async()=>{throw new Error('offline');}});
  const snapshot=await manager.snapshot();
  assert.equal(await exists(join(packages,'farm-farm-1-detailed.pmtiles.bak')),true);
  assert.equal(snapshot.recoveryIssues.length,1);
  assert.equal(snapshot.recoveryIssues[0].code,'MAP_RECOVERY_FAILED');
});

test('P8 removes orphan partial PMTiles not referenced by a transaction',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-p8-orphan-'));
  const packages=join(dataDir,'maps','packages');
  await mkdir(packages,{recursive:true});
  const partial=join(packages,'farm-x.part-orphan.pmtiles');
  await writeFile(partial,'partial');
  const manager=createMapPackageManager({dataDir,platform:'linux',arch:'x64',fetchImpl:async()=>{throw new Error('offline');}});
  await manager.snapshot();
  assert.equal(await exists(partial),false);
});

test('P8 reports legacy package unverified then upgrades metadata after explicit verification',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-p8-verify-'));
  const packages=join(dataDir,'maps','packages');
  await mkdir(packages,{recursive:true});
  await prepareCli(dataDir);
  const id='farm-farm-1-detailed',fileName=`${id}.pmtiles`,payload=Buffer.from('legacy-pmtiles');
  await writeFile(join(packages,fileName),payload);
  await writeFile(join(packages,`${id}.json`),JSON.stringify({id,fileName,size:payload.length,profile:'detailed',sourceDate:'2026-09-19'}));
  const calls=[];
  const manager=createMapPackageManager({dataDir,platform:'win32',arch:'x64',fetchImpl:async()=>{throw new Error('network should not be needed');},execFileImpl:async(_file,args)=>{calls.push(args);return{stdout:'',stderr:''};}});
  let snapshot=await manager.snapshot();
  assert.equal(snapshot.installed[0].health,'unverified');
  const verified=await manager.verifyFarmMap({id});
  assert.equal(verified.health,'healthy');
  assert.equal(verified.sha256,sha(payload));
  assert.ok(calls.some(args=>args[0]==='verify'));
  const metadata=JSON.parse(await readFile(join(packages,`${id}.json`),'utf8'));
  assert.equal(metadata.metadataVersion,1);
  assert.equal(metadata.sha256,sha(payload));
  snapshot=await manager.snapshot();
  assert.equal(snapshot.installed[0].health,'healthy');
});

test('P8 reports missing and corrupt packages without deleting metadata automatically',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-p8-health-'));
  const packages=join(dataDir,'maps','packages');
  await mkdir(packages,{recursive:true});
  const missingId='farm-missing-detailed',missingFile=`${missingId}.pmtiles`;
  await writeFile(join(packages,`${missingId}.json`),JSON.stringify({metadataVersion:1,id:missingId,fileName:missingFile,size:10,sha256:'a'.repeat(64),profile:'detailed'}));
  const corruptId='farm-corrupt-detailed',corruptFile=`${corruptId}.pmtiles`;
  await writeFile(join(packages,corruptFile),'short');
  await writeFile(join(packages,`${corruptId}.json`),JSON.stringify({metadataVersion:1,id:corruptId,fileName:corruptFile,size:999,sha256:'b'.repeat(64),profile:'detailed'}));
  const manager=createMapPackageManager({dataDir,platform:'linux',arch:'x64',fetchImpl:async()=>{throw new Error('offline');}});
  const snapshot=await manager.snapshot();
  const byId=new Map(snapshot.installed.map(item=>[item.id,item]));
  assert.equal(byId.get(missingId).health,'missing');
  assert.equal(byId.get(corruptId).health,'corrupt');
  assert.equal(await exists(join(packages,`${missingId}.json`)),true);
  assert.equal(await exists(join(packages,`${corruptId}.json`)),true);
});

test('P8 reports verified package outdated when cached catalog is newer without deleting it',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-p8-outdated-'));
  const root=join(dataDir,'maps'),packages=join(root,'packages');
  await mkdir(packages,{recursive:true});
  await writeFile(join(root,'catalog.json'),JSON.stringify(validManifest));
  const id='farm-old-detailed',fileName=`${id}.pmtiles`,payload=Buffer.from('verified-map');
  await writeFile(join(packages,fileName),payload);
  await writeFile(join(packages,`${id}.json`),JSON.stringify({metadataVersion:1,id,fileName,size:payload.length,sha256:sha(payload),profile:'detailed',catalogVersion:'2026.09.0'}));
  const manager=createMapPackageManager({dataDir,platform:'linux',arch:'x64',fetchImpl:async()=>{throw new Error('offline');}});
  const snapshot=await manager.snapshot();
  assert.equal(snapshot.installed[0].health,'outdated');
  assert.equal(await exists(join(packages,fileName)),true);
});

test('P8 keeps intact PMTiles when its metadata JSON is damaged',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-p8-metadata-damage-'));
  const packages=join(dataDir,'maps','packages');
  await mkdir(packages,{recursive:true});
  const file=join(packages,'farm-damaged-detailed.pmtiles');
  await writeFile(file,'known-good-bytes');
  await writeFile(join(packages,'farm-damaged-detailed.json'),'{broken');
  const manager=createMapPackageManager({dataDir,platform:'linux',arch:'x64',fetchImpl:async()=>{throw new Error('offline');}});
  const snapshot=await manager.snapshot();
  assert.equal(await exists(file),true);
  assert.ok(snapshot.recoveryIssues.some(issue=>issue.code==='MAP_PACKAGE_CORRUPT'));
});
