import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createMapPoint,buildAgriculturalMapSnapshot,attachCoordinate} from '../src/agricultural-map.js';

const polygon=[[-47.93,-21.21],[-47.91,-21.21],[-47.91,-21.19],[-47.93,-21.19],[-47.93,-21.21]];

test('P3 validates persistent agricultural map points',()=>{
  const point=createMapPoint({id:'p1',kind:'sampling',fieldId:'f1',latitude:-21.2,longitude:-47.92,title:'Solo 01',recordedAt:'2026-09-19T12:00:00Z'});
  assert.equal(point.kind,'sampling');
  assert.equal(point.latitude,-21.2);
  assert.throws(()=>createMapPoint({...point,id:'bad',latitude:91}),/Latitude/);
  assert.throws(()=>createMapPoint({...point,id:'bad2',kind:'unsupported'}),/kind/);
});

test('P3 agricultural events preserve valid explicit coordinates',()=>{
  const attached=attachCoordinate({id:'a1',fieldId:'f1',latitude:-21.2,longitude:-47.92},{requireField:true});
  assert.equal(attached.coordinateSource,'explicit');
  assert.equal(attached.latitude,-21.2);
  assert.throws(()=>attachCoordinate({id:'bad',fieldId:'f1',latitude:-21.2}),/Longitude/);
});

test('P3 builds colored field polygons with active season and click-card data',()=>{
  const snapshot=buildAgriculturalMapSnapshot({
    fields:[{id:'f1',name:'Talhão Norte',code:'TN',farmUnitId:'farm1',areaHa:12}],
    fieldGeometries:[{id:'f1',fieldId:'f1',coordinates:[polygon]}],
    seasons:[{id:'s1',fieldId:'f1',crop:'Soja',variety:'Bônus',status:'active'}],
    applications:[{id:'app1',fieldId:'f1',name:'Herbicida',appliedAt:'2026-09-19T10:00:00Z'}],
    scouting:[{id:'sc1',fieldId:'f1',name:'Ferrugem',severity:'medium'}],
    mapPoints:[{id:'sample1',kind:'sampling',fieldId:'f1',latitude:-21.2,longitude:-47.92,title:'Solo 01'}]
  });
  assert.equal(snapshot.fields.length,1);
  assert.equal(snapshot.fields[0].crop,'Soja');
  assert.equal(snapshot.fields[0].variety,'Bônus');
  assert.equal(snapshot.fields[0].applicationCount,1);
  assert.equal(snapshot.fields[0].scoutingCount,1);
  assert.equal(snapshot.fields[0].pointCount,1);
  assert.ok(snapshot.fields[0].color);
  assert.equal(snapshot.layers.sampling.length,1);
});

test('P3 exposes all roadmap agricultural layers without inventing coordinates',()=>{
  const base={fields:[{id:'f1',name:'Talhão',areaHa:10}],fieldGeometries:[{id:'f1',fieldId:'f1',coordinates:[polygon]}]};
  const snapshot=buildAgriculturalMapSnapshot({...base,
    operations:[{id:'o1',fieldId:'f1',name:'Plantio'}],
    applications:[{id:'a1',fieldId:'f1',name:'Aplicação'}],
    scouting:[{id:'s1',fieldId:'f1',name:'Praga'}],
    files:[{id:'photo1',entityId:'f1',entityType:'field',name:'foto.jpg'}],
    rainfall:[{id:'r1',fieldId:'f1',millimeters:15}],
    mapPoints:[
      {id:'sensor1',kind:'sensor',fieldId:'f1',latitude:-21.2,longitude:-47.92,title:'Sensor'},
      {id:'machine1',kind:'machine',fieldId:'f1',latitude:-21.201,longitude:-47.921,title:'Trator'},
      {id:'warehouse1',kind:'warehouse',latitude:-21.25,longitude:-47.95,title:'Silo'},
      {id:'sample1',kind:'sampling',fieldId:'f1',latitude:-21.202,longitude:-47.922,title:'Solo'}
    ]
  });
  assert.equal(snapshot.layers.operations.length,1);
  assert.equal(snapshot.layers.applications.length,1);
  assert.equal(snapshot.layers.scouting.length,1);
  assert.equal(snapshot.layers.photos.length,1);
  assert.equal(snapshot.layers.rainfall.length,1);
  assert.equal(snapshot.layers.sensors.length,1);
  assert.equal(snapshot.layers.machines.length,1);
  assert.equal(snapshot.layers.warehouses.length,1);
  assert.equal(snapshot.layers.sampling.length,1);
  assert.equal(snapshot.layers.photos[0].coordinateSource,'field-centroid');
  assert.equal(snapshot.layers.rainfall[0].coordinateSource,'field-centroid');
  assert.equal(snapshot.layers.operations[0].coordinateSource,'field-centroid');
  const orphan=buildAgriculturalMapSnapshot({fields:[{id:'without-geometry',name:'Sem mapa'}],applications:[{id:'a',fieldId:'without-geometry',name:'Sem coordenada'}]});
  assert.equal(orphan.layers.applications.length,0);
  assert.equal(orphan.unmappedFields.length,1);
});

test('P3 UI remains wired through additive P5, P6 and P7 presentation decorators',()=>{
  const fields=fs.readFileSync(new URL('../web/ui/fields.jsx',import.meta.url),'utf8');
  const map=fs.readFileSync(new URL('../web/ui/agricultural-map.jsx',import.meta.url),'utf8');
  const presentation=fs.readFileSync(new URL('../src/presentation-p3.js',import.meta.url),'utf8');
  const presentationP5=fs.readFileSync(new URL('../src/presentation-p5.js',import.meta.url),'utf8');
  const presentationP6=fs.readFileSync(new URL('../src/presentation-p6.js',import.meta.url),'utf8');
  const presentationP7=fs.readFileSync(new URL('../src/presentation-p7.js',import.meta.url),'utf8');
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
  assert.match(presentationP6,/presentation-p5\.js/);
  assert.match(presentationP7,/presentation-p6\.js/);
  assert.match(browser,/presentation-p7\.js/);
  assert.match(desktop,/presentation-p7\.js/);
});

test('CI serializes browser certification to avoid Windows socket exhaustion',()=>{
  const config=fs.readFileSync(new URL('../playwright.config.mjs',import.meta.url),'utf8');
  assert.match(config,/workers:process\.env\.CI\?1:undefined/);
});
