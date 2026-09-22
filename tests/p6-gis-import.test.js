import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeGisFeatureCollection,normalizeGisGeometry,createGisLayer,geometryForField} from '../src/gis-import.js';
import {buildAgriculturalMapSnapshot} from '../src/agricultural-map.js';

test('P6 normalizes GeoJSON and preserves MultiPolygon',()=>{
  const input={type:'FeatureCollection',features:[
    {type:'Feature',properties:{name:'Talhão A'},geometry:{type:'Polygon',coordinates:[[[-47.9,-21.2],[-47.8,-21.2],[-47.8,-21.1],[-47.9,-21.1],[-47.9,-21.2]]]}},
    {type:'Feature',properties:{name:'Talhão B'},geometry:{type:'MultiPolygon',coordinates:[[[[-48,-21],[-47.95,-21],[-47.95,-20.95],[-48,-20.95],[-48,-21]]]]}}
  ]};
  const result=normalizeGisFeatureCollection(input);
  assert.equal(result.type,'FeatureCollection');
  assert.equal(result.features.length,2);
  assert.equal(result.features[1].geometry.type,'MultiPolygon');
  assert.deepEqual(result.summary.geometryTypes,{Polygon:1,MultiPolygon:1});
});

test('P6 rejects coordinates outside WGS84',()=>{
  assert.throws(()=>normalizeGisFeatureCollection({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Point',coordinates:[250,-21]}}]}),/WGS84|longitude|coordinate/i);
});

test('P6 creates persistent GIS layer metadata without changing features',()=>{
  const fc=normalizeGisFeatureCollection({type:'FeatureCollection',features:[{type:'Feature',properties:{name:'A'},geometry:{type:'Point',coordinates:[-47.8,-21.1]}}]});
  const layer=createGisLayer({id:'gis-1',name:'Levantamento',format:'gpx',sourceFile:'campo.gpx',featureCollection:fc,importedAt:'2026-09-20T12:00:00.000Z'});
  assert.equal(layer.id,'gis-1');
  assert.equal(layer.format,'gpx');
  assert.equal(layer.featureCollection.features[0].properties.name,'A');
  assert.equal(layer.summary.featureCount,1);
});

test('P6 only applies Polygon or MultiPolygon as field boundary',()=>{
  const polygon={type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[-47.9,-21.2],[-47.8,-21.2],[-47.8,-21.1],[-47.9,-21.1],[-47.9,-21.2]]]}};
  const boundary=geometryForField(polygon,{fieldId:'field-1',sourceLayerId:'gis-1'});
  assert.equal(boundary.fieldId,'field-1');
  assert.equal(boundary.geometry.type,'Polygon');
  assert.equal(boundary.sourceLayerId,'gis-1');
  assert.throws(()=>geometryForField({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:[[-47,-21],[-47.1,-21.1]]}},{fieldId:'field-1'}),/Polygon/i);
});

test('P6 map snapshot and renderer preserve all MultiPolygon parts',()=>{
  const multi={fieldId:'field-1',type:'MultiPolygon',coordinates:[
    [[[-48,-21],[-47.95,-21],[-47.95,-20.95],[-48,-20.95],[-48,-21]]],
    [[[-47.9,-21],[-47.85,-21],[-47.85,-20.95],[-47.9,-20.95],[-47.9,-21]]]
  ]};
  const snapshot=buildAgriculturalMapSnapshot({fields:[{id:'field-1',name:'Talhão multipartes',areaHa:20}],geometries:[multi]});
  assert.equal(snapshot.fields[0].geometry.type,'MultiPolygon');
  assert.equal(snapshot.fields[0].geometry.rings.length,2);
  const renderer=fs.readFileSync(new URL('../web/ui/agricultural-map.jsx',import.meta.url),'utf8');
  assert.match(renderer,/geometry\?\.rings/);
  assert.match(renderer,/\.map\(\(ring/);
});

test('P6 file picker uses the native input event and a stable test id',()=>{
  const ui=fs.readFileSync(new URL('../web/ui/gis-import.jsx',import.meta.url),'utf8');
  assert.match(ui,/data-testid="gis-file-input"/);
  assert.match(ui,/onInput=\{event=>analyze\(event\.currentTarget\.files\?\.\[0\]\)\}/);
});

test('P8 rejects self-intersecting and zero-area GIS polygons',()=>{
  assert.throws(()=>normalizeGisGeometry({type:'Polygon',coordinates:[[[0,0],[2,2],[0,2],[2,0],[0,0]]]}),/self-intersect/i);
  assert.throws(()=>normalizeGisGeometry({type:'Polygon',coordinates:[[[0,0],[1,0],[2,0],[0,0]]]}),/degenerate|area/i);
});

test('P8 accepts a valid ring with a redundant collinear vertex',()=>{
  const geometry=normalizeGisGeometry({type:'Polygon',coordinates:[[[0,0],[1,0],[2,0],[2,1],[0,1],[0,0]]]});
  assert.equal(geometry.type,'Polygon');
});