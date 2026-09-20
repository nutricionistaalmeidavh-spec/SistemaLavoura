import test from 'node:test';
import assert from 'node:assert/strict';
import {parseGisFile,detectGisFormat} from '../web/ui/gis-file-parser.js';

const polygon='-47.9,-21.2,0 -47.8,-21.2,0 -47.8,-21.1,0 -47.9,-21.1,0 -47.9,-21.2,0';
const kml=`<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>Área A</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${polygon}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>`;
const gpx=`<?xml version="1.0"?><gpx version="1.1" creator="ArtiSys" xmlns="http://www.topografix.com/GPX/1/1"><wpt lat="-21.2" lon="-47.9"><name>Ponto A</name></wpt></gpx>`;
const kmzBase64='UEsDBBQAAAAIABCUNF1TrER/vQAAADYBAAAHAAAAZG9jLmttbG2PQYrCQBBFrxKyNl0mDMwoZYnDbAQX4g2aWMTGpEq6OxOz9GxzMeMgGtDl+3yq/sPluamTX/bBqSzS3EzTJeFxyIZcwiI9xHiaA3RdZ/TEUrlghCMMDShMkRL+aNk2LJFwW9uSG+uPhGIbpr+LZ5usEP4Jt1r3lQqhtpH9t7ayt75fB8KNE7Z+56QiLFX93omNHCj7+DSzSVbkpphMkxt9vaH8TrM3NDQRxicRxs/gZQo8VsJIB56SN3O6AlBLAQIUAxQAAAAIABCUNF1TrER/vQAAADYBAAAHAAAAAAAAAAAAAACAAQAAAABkb2Mua21sUEsFBgAAAAABAAEANQAAAOIAAAAAAA==';

test('P6 detects explicit GIS formats without network lookup',()=>{
  assert.equal(detectGisFormat('campo.geojson'),'geojson');
  assert.equal(detectGisFormat('campo.kml'),'kml');
  assert.equal(detectGisFormat('campo.kmz'),'kmz');
  assert.equal(detectGisFormat('campo.gpx'),'gpx');
  assert.equal(detectGisFormat('shape.shp'),'shapefile');
  assert.equal(detectGisFormat('TASKDATA.XML'),'isoxml');
});

test('P6 parses GeoJSON, KML, GPX and KMZ locally into normalized GeoJSON',async()=>{
  const geo=await parseGisFile({name:'a.geojson',text:JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{name:'A'},geometry:{type:'Point',coordinates:[-47.9,-21.2]}}]})});
  assert.equal(geo.featureCollection.features[0].geometry.type,'Point');
  const parsedKml=await parseGisFile({name:'a.kml',text:kml});
  assert.equal(parsedKml.featureCollection.features[0].geometry.type,'Polygon');
  const parsedGpx=await parseGisFile({name:'a.gpx',text:gpx});
  assert.equal(parsedGpx.featureCollection.features[0].geometry.type,'Point');
  const parsedKmz=await parseGisFile({name:'a.kmz',bytes:Uint8Array.from(Buffer.from(kmzBase64,'base64'))});
  assert.equal(parsedKmz.featureCollection.features[0].geometry.type,'Polygon');
});

test('P6 dispatches ZIP Shapefile and TaskData to their lawful local parsers',async()=>{
  const fakeZip=Uint8Array.from([80,75,3,4]);
  let shapeCalls=0,isoCalls=0;
  const shape=await parseGisFile({name:'shape.zip',bytes:fakeZip},{inspectZip:()=>['FIELD.SHP','FIELD.DBF'],parseShapefile:async()=>({type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Shape'},geometry:{type:'Point',coordinates:[-47,-21]}}]}),parseIsoxml:async()=>{isoCalls++;throw new Error('wrong parser');}});
  shapeCalls++;
  assert.equal(shapeCalls,1);assert.equal(isoCalls,0);assert.equal(shape.format,'shapefile');
  const iso=await parseGisFile({name:'task.zip',bytes:fakeZip},{inspectZip:()=>['TASKDATA.XML'],parseIsoxml:async()=>({type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Partfield'},geometry:{type:'Polygon',coordinates:[[[-47,-21],[-46.9,-21],[-46.9,-20.9],[-47,-20.9],[-47,-21]]]}}]})});
  assert.equal(iso.format,'isoxml');
});
