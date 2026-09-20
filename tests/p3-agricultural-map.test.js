import test from 'node:test';
import assert from 'node:assert/strict';
import {createAgriculturalMapPoint,buildAgriculturalMapSnapshot} from '../src/agricultural-map.js';
import {createApplicationRecord,createScoutingRecord} from '../src/commercial-p0.js';
import fs from 'node:fs';

const geometry={fieldId:'f1',type:'Polygon',coordinates:[[-47.91,-21.22],[-47.89,-21.22],[-47.89,-21.20],[-47.91,-21.20]]};
const season={id:'s1',crop:'Soja',varietyName:'BRS 1003',periodName:'2026/27',fieldIds:['f1'],plantingWindowStart:'2026-09-01T00:00:00.000Z',plantingWindowEnd:'2026-12-31T23:59:59.000Z'};

function fixture(){
  return {
    fields:[{id:'f1',code:'T-01',name:'Talhão Norte',farmUnitId:'farm-1',areaHa:42.5}],
    geometries:[geometry],
    seasons:[season],
    operations:[{id:'op1',fieldId:'f1',seasonId:'s1',typeName:'Pulverização',status:'planned',scheduledAt:'2026-09-21T10:00:00.000Z',machineName:'Pulverizador 01'}],
    applications:[{id:'app1',fieldId:'f1',seasonId:'s1',appliedAt:'2026-09-19T10:00:00.000Z',target:'Ferrugem',latitude:-21.21,longitude:-47.90,products:[{name:'Produto A',dosePerHa:1.2,unit:'L'}]}],
    scouting:[{id:'sc1',fieldId:'f1',seasonId:'s1',kind:'doença',name:'Ferrugem',severity:3,status:'open',latitude:-21.205,longitude:-47.895}],
    files:[{id:'photo1',entityId:'f1',name:'folha.jpg',mimeType:'image/jpeg'}],
    rainfall:[{id:'rain1',fieldId:'f1',mm:18,measuredAt:'2026-09-20T08:00:00.000Z'}],
    mapPoints:[
      createAgriculturalMapPoint({id:'sensor1',kind:'sensor',name:'Estação Talhão Norte',latitude:-21.207,longitude:-47.902,fieldId:'f1'}),
      createAgriculturalMapPoint({id:'machine1',kind:'machine',name:'Trator 07',latitude:-21.208,longitude:-47.903}),
      createAgriculturalMapPoint({id:'storage1',kind:'storage',name:'Silo 01',latitude:-21.215,longitude:-47.92}),
      createAgriculturalMapPoint({id:'sample1',kind:'sampling',name:'Amostra A1',latitude:-21.203,longitude:-47.897,fieldId:'f1'})
    ]
  };
}

test('P3 validates persistent agricultural map points',()=>{
  const point=createAgriculturalMapPoint({kind:'sensor',name:'Pluviômetro 01',latitude:-21.2,longitude:-47.9,fieldId:'f1'});
  assert.equal(point.kind,'sensor');
  assert.equal(point.fieldId,'f1');
  assert.throws(()=>createAgriculturalMapPoint({kind:'unknown',name:'X',latitude:0,longitude:0}),/kind/i);
  assert.throws(()=>createAgriculturalMapPoint({kind:'sensor',name:'X',latitude:95,longitude:0}),/latitude/i);
});

test('P3 agricultural events preserve valid explicit coordinates',()=>{
  const application=createApplicationRecord({id:'app',seasonId:'s1',fieldId:'f1',areaHa:10,appliedAt:'2026-09-20T10:00:00Z',latitude:-21.21,longitude:-47.9,products:[{inputId:'i1',name:'Produto',unit:'L',dosePerHa:1}]});
  const scouting=createScoutingRecord({id:'sc',seasonId:'s1',fieldId:'f1',kind:'praga',name:'Percevejo',latitude:-21.205,longitude:-47.895});
  assert.equal(application.latitude,-21.21);
  assert.equal(application.longitude,-47.9);
  assert.equal(scouting.latitude,-21.205);
  assert.equal(scouting.longitude,-47.895);
  assert.throws(()=>createApplicationRecord({seasonId:'s1',fieldId:'f1',areaHa:10,latitude:91,longitude:0,products:[{inputId:'i1',dosePerHa:1}]}),/Latitude/);
});

test('P3 builds colored field polygons with active season and click-card data',()=>{
  const snapshot=buildAgriculturalMapSnapshot({...fixture(),now:'2026-09-20T12:00:00.000Z'});
  assert.equal(snapshot.fields.length,1);
  assert.equal(snapshot.fields[0].fieldId,'f1');
  assert.equal(snapshot.fields[0].season.id,'s1');
  assert.equal(snapshot.fields[0].season.crop,'Soja');
  assert.equal(snapshot.fields[0].season.varietyName,'BRS 1003');
  assert.match(snapshot.fields[0].color,/^#[0-9A-F]{6}$/i);
  assert.equal(snapshot.fields[0].summary.openScouting,1);
  assert.equal(snapshot.fields[0].summary.photoCount,1);
  assert.equal(snapshot.fields[0].summary.recentRainMm,18);
  assert.ok(Number.isFinite(snapshot.fields[0].centroid.latitude));
  assert.ok(Number.isFinite(snapshot.fields[0].centroid.longitude));
});

test('P3 exposes all roadmap agricultural layers without inventing coordinates',()=>{
  const snapshot=buildAgriculturalMapSnapshot({...fixture(),now:'2026-09-20T12:00:00.000Z'});
  assert.deepEqual(Object.keys(snapshot.layers).sort(),['applications','machines','operations','photos','rainfall','sampling','scouting','sensors','storage'].sort());
  assert.equal(snapshot.layers.applications.length,1);
  assert.equal(snapshot.layers.scouting.length,1);
  assert.equal(snapshot.layers.sensors.length,1);
  assert.equal(snapshot.layers.machines.length,1);
  assert.equal(snapshot.layers.storage.length,1);
  assert.equal(snapshot.layers.sampling.length,1);
  assert.equal(snapshot.layers.photos[0].coordinateSource,'field-centroid');
  assert.equal(snapshot.layers.rainfall[0].coordinateSource,'field-centroid');
  assert.equal(snapshot.layers.operations[0].coordinateSource,'field-centroid');
  const orphan=buildAgriculturalMapSnapshot({fields:[{id:'without-geometry',name:'Sem mapa'}],applications:[{id:'a',fieldId:'without-geometry',name:'Sem coordenada'}]});
  assert.equal(orphan.layers.applications.length,0);
  assert.equal(orphan.unmappedFields.length,1);
});

test('P3 UI remains wired when P5 decorates the P3 presentation',()=>{
  const fields=fs.readFileSync(new URL('../web/ui/fields.jsx',import.meta.url),'utf8');
  const map=fs.readFileSync(new URL('../web/ui/agricultural-map.jsx',import.meta.url),'utf8');
  const presentation=fs.readFileSync(new URL('../src/presentation-p3.js',import.meta.url),'utf8');
  const presentationP5=fs.readFileSync(new URL('../src/presentation-p5.js',import.meta.url),'utf8');
  const browser=fs.readFileSync(new URL('../web/main.jsx',import.meta.url),'utf8');
  const desktop=fs.readFileSync(new URL('../runtime/host.mjs',import.meta.url),'utf8');
  assert.match(fields,/AgriculturalMapPanel/);
  assert.match(fields,/data\.map/);
  assert.match(fields,/saveMapPoint/);
  assert.match(map,/data-testid="agricultural-map"/);
  assert.match(map,/Camadas/);
  assert.match(map,/Safra ativa/);
  assert.match(map,/onClick/);
  assert.match(presentation,/buildAgriculturalMapSnapshot/);
  assert.match(presentation,/mapPoints/);
  assert.match(presentationP5,/presentation-p3\.js/);
  assert.match(browser,/presentation-p5\.js/);
  assert.match(desktop,/presentation-p5\.js/);
});

test('CI serializes browser certification to avoid Windows socket exhaustion',()=>{
  const config=fs.readFileSync(new URL('../playwright.config.mjs',import.meta.url),'utf8');
  assert.match(config,/workers:process\.env\.CI\?1:undefined/);
});
