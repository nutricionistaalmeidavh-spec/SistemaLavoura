import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createMapPackageManager,MapPackageError,normalizeMapPackageError} from '../runtime/map-package-manager.mjs';

const exists=async path=>{try{await access(path);return true;}catch{return false;}};
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
