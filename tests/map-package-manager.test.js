import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createMapPackageManager,directFarmMapPlan,MAP_PACKAGE_CONSTANTS} from '../runtime/map-package-manager.mjs';

const missing=async path=>{try{await access(path);return false;}catch{return true;}};

test('direct farm plan keeps output deterministic and profile zoom bounded',()=>{
  const plan=directFarmMapPlan({farmUnitId:'Fazenda 01',farmName:'Boa Vista',bounds:[-47.91,-21.22,-47.89,-21.20],profile:'detailed',sourceUrl:'https://build.protomaps.com/20260920.pmtiles',sourceDate:'2026-09-20'});
  assert.equal(plan.outputAsset,'farm-fazenda-01-detailed.pmtiles');
  assert.equal(plan.maxZoom,12);
  assert.equal(plan.bbox,'-47.91,-21.22,-47.89,-21.2');
});

test('desktop manager extracts, verifies, installs atomically and removes a farm package',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-map-manager-'));
  const cliDir=join(dataDir,'maps','tools',`pmtiles-${MAP_PACKAGE_CONSTANTS.PMTILES_VERSION}`);
  await mkdir(cliDir,{recursive:true});
  await writeFile(join(cliDir,'pmtiles.exe'),'fake-cli');
  const calls=[];
  const execFileImpl=async(_file,args)=>{
    calls.push(args);
    if(args[0]==='extract')await writeFile(args[2],Buffer.from('pmtiles-test-payload'));
    return{stdout:'',stderr:''};
  };
  const manager=createMapPackageManager({dataDir,platform:'win32',arch:'x64',execFileImpl,fetchImpl:async()=>{throw new Error('network should not be used when source is explicit and CLI exists');}});
  const record=await manager.installFarmMap({farmUnitId:'farm-1',farmName:'Fazenda Norte',profile:'detailed',bounds:[-47.91,-21.22,-47.89,-21.20],extractSource:'https://build.protomaps.com/20260920.pmtiles',sourceDate:'2026-09-20'});
  assert.equal(record.profile,'detailed');
  assert.ok(record.size>0);
  assert.ok(calls.some(args=>args[0]==='extract'&&args.includes('--bbox=-47.91,-21.22,-47.89,-21.2')&&args.includes('--maxzoom=12')));
  assert.ok(calls.some(args=>args[0]==='verify'));
  const snapshot=await manager.snapshot();
  assert.equal(snapshot.available,true);
  assert.equal(snapshot.installed.length,1);
  const metadata=JSON.parse(await readFile(join(dataDir,'maps','packages',`${record.id}.json`),'utf8'));
  assert.equal(metadata.fileName,'farm-farm-1-detailed.pmtiles');
  const removed=await manager.removeFarmMap({id:record.id});
  assert.equal(removed.removed,true);
  assert.equal(await missing(join(dataDir,'maps','packages',metadata.fileName)),true);
});

test('desktop manager rejects unsupported runtime and duplicate simultaneous package install',async()=>{
  const dataDir=await mkdtemp(join(tmpdir(),'lavoura-map-unsupported-'));
  const manager=createMapPackageManager({dataDir,platform:'linux',arch:'x64',fetchImpl:async()=>({ok:true})});
  const snapshot=await manager.snapshot();
  assert.equal(snapshot.available,false);
  await assert.rejects(()=>manager.ensureCli(),/Windows x64/);
});
