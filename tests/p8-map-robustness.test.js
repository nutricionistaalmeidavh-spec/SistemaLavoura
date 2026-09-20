import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createMapPackageManager,MapPackageError,normalizeMapPackageError} from '../runtime/map-package-manager.mjs';

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
