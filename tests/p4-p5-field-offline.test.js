import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createFieldObservation,measureDistanceMeters,measureAreaHa,buildFieldModeSnapshot} from '../src/field-mode.js';
import {farmBoundsFromGeometries,buildFarmMapDownloadPlan,validateMapManifest} from '../src/map-package-planner.js';

const field={id:'f1',code:'T-01',name:'Talhão Norte',farmUnitId:'farm-1',areaHa:42.5};
const geometry={fieldId:'f1',type:'Polygon',coordinates:[[-47.91,-21.22],[-47.89,-21.22],[-47.89,-21.20],[-47.91,-21.20]]};

const manifest={
  schemaVersion:1,
  releaseVersion:'2026.09.1',
  generatedAt:'2026-09-20T16:23:00Z',
  source:{provider:'OpenStreetMap',license:'ODbL-1.0'},
  maps:[
    {id:'brasil-base',name:'Brasil',kind:'national',available:true,version:'2026.09.1',asset:'brasil-base.pmtiles',size:8221529,sha256:'a'.repeat(64),minZoom:0,maxZoom:7,bounds:[-74,-33.8,-34.7,5.3],sourceDate:'2026-09-20'},
    {id:'sp',name:'São Paulo',kind:'state',available:true,version:'2026.09.1',asset:'sp.pmtiles',size:454144673,sha256:'b'.repeat(64),minZoom:7,maxZoom:14,bounds:[-53.2,-25.4,-44.1,-19.7],sourceDate:'2026-09-20'},
    {id:'mg',name:'Minas Gerais',kind:'state',available:true,version:'2026.09.1',asset:'mg.pmtiles',size:760795560,sha256:'c'.repeat(64),minZoom:7,maxZoom:14,bounds:[-51.1,-23,-39.8,-14.2],sourceDate:'2026-09-20'}
  ]
};

test('P4 creates pending field observations with validated GPS coordinates',()=>{
  const observation=createFieldObservation({id:'obs-1',fieldId:'f1',kind:'observation',title:'Falha de plantio',notes:'Linha 8',latitude:-21.21,longitude:-47.90,observedAt:'2026-09-20T12:00:00Z'});
  assert.equal(observation.fieldId,'f1');
  assert.equal(observation.syncState,'pending');
  assert.equal(observation.latitude,-21.21);
  assert.equal(observation.longitude,-47.90);
  assert.throws(()=>createFieldObservation({fieldId:'f1',kind:'observation',title:'X',latitude:91,longitude:0}),/latitude/i);
});

test('P4 measures field distance and area locally without a network provider',()=>{
  const distance=measureDistanceMeters([[-47.90,-21.21],[-47.899,-21.21]]);
  assert.ok(distance>90&&distance<120,`distance=${distance}`);
  const area=measureAreaHa([[-47.91,-21.22],[-47.89,-21.22],[-47.89,-21.20],[-47.91,-21.20]]);
  assert.ok(area>400&&area<500,`area=${area}`);
});

test('P4 field snapshot exposes pending operations, observations and offline state',()=>{
  const snapshot=buildFieldModeSnapshot({
    fields:[field],geometries:[geometry],
    operations:[{id:'op1',fieldId:'f1',status:'planned',typeName:'Pulverização',scheduledAt:'2026-09-21T10:00:00Z'}],
    scouting:[{id:'sc1',fieldId:'f1',status:'open',name:'Ferrugem',severity:3}],
    observations:[createFieldObservation({id:'obs-1',fieldId:'f1',kind:'observation',title:'Ponto 1',latitude:-21.21,longitude:-47.90})]
  });
  assert.equal(snapshot.offlineReady,true);
  assert.equal(snapshot.fields.length,1);
  assert.equal(snapshot.fields[0].pendingOperations.length,1);
  assert.equal(snapshot.fields[0].openScouting.length,1);
  assert.equal(snapshot.pendingSync.length,1);
});

test('P5 derives farm bounds only from that farm local field polygons',()=>{
  assert.deepEqual(farmBoundsFromGeometries({farmUnitId:'farm-1',fields:[field],geometries:[geometry]}),[-47.91,-21.22,-47.89,-21.20]);
  assert.throws(()=>farmBoundsFromGeometries({farmUnitId:'farm-2',fields:[field],geometries:[geometry]}),/no mapped field polygons/i);
});

test('P5 validates manifest contract and builds farm-only extraction profiles',()=>{
  assert.equal(validateMapManifest(manifest).releaseVersion,'2026.09.1');
  const detailed=buildFarmMapDownloadPlan({farmUnitId:'farm-1',farmName:'Fazenda Norte',fields:[field],geometries:[geometry],manifest,profile:'detailed'});
  assert.equal(detailed.profile,'detailed');
  assert.equal(detailed.maxZoom,12);
  assert.deepEqual(detailed.bounds,[-47.91,-21.22,-47.89,-21.20]);
  assert.deepEqual(detailed.sources.map(source=>source.id),['sp','mg']);
  assert.ok(detailed.sources.every(source=>source.url.includes('/releases/download/br-maps-v2026.09.1/')));
  assert.equal(detailed.outputAsset,'farm-farm-1-detailed.pmtiles');
  const basic=buildFarmMapDownloadPlan({farmUnitId:'farm-1',fields:[field],geometries:[geometry],manifest,profile:'basic'});
  assert.equal(basic.maxZoom,10);
  const maximum=buildFarmMapDownloadPlan({farmUnitId:'farm-1',fields:[field],geometries:[geometry],manifest,profile:'maximum'});
  assert.equal(maximum.maxZoom,14);
});

test('P5 fails closed if no published map package covers the farm',()=>{
  const unavailable={...manifest,maps:manifest.maps.map(item=>item.id==='sp'||item.id==='mg'?{...item,available:false}:item)};
  assert.throws(()=>buildFarmMapDownloadPlan({farmUnitId:'farm-1',fields:[field],geometries:[geometry],manifest:unavailable,profile:'detailed'}),/cover/i);
});

test('P4/P5 UI wiring includes field mode, offline maps and PWA registration',()=>{
  const runtime=fs.readFileSync(new URL('../web/ui/runtime.jsx',import.meta.url),'utf8');
  const main=fs.readFileSync(new URL('../web/main.jsx',import.meta.url),'utf8');
  const index=fs.readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
  const presentation=fs.readFileSync(new URL('../src/presentation-p5.js',import.meta.url),'utf8');
  const fieldMode=fs.readFileSync(new URL('../web/ui/field-mode.jsx',import.meta.url),'utf8');
  assert.match(runtime,/LavouraFieldMode/);
  assert.match(runtime,/LavouraOfflineMaps/);
  assert.match(main,/registerPwa/);
  assert.match(index,/manifest\.webmanifest/);
  assert.match(presentation,/field-mode/);
  assert.match(presentation,/offline-maps/);
  assert.doesNotMatch(fieldMode,/seasonId:.*['"]field-mode['"]/);
});
