import test from 'node:test';
import assert from 'node:assert/strict';
import {SATELLITE_PROVIDERS,buildStacSearchRequest,normalizeStacScene,calculateNdviGrid,summarizeNdvi} from '../src/satellite.js';

test('P7 exposes official Sentinel-2 and Landsat STAC providers',()=>{
  assert.equal(SATELLITE_PROVIDERS.sentinel2.collection,'sentinel-2-l2a');
  assert.match(SATELLITE_PROVIDERS.sentinel2.endpoint,/dataspace\.copernicus\.eu/);
  assert.equal(SATELLITE_PROVIDERS.landsat.collection,'landsat-c2l2-sr');
  assert.match(SATELLITE_PROVIDERS.landsat.endpoint,/landsatlook\.usgs\.gov/);
});

test('P7 builds bounded STAC search request',()=>{
  const request=buildStacSearchRequest({provider:'sentinel2',bounds:{minLongitude:-48,minLatitude:-22,maxLongitude:-47,maxLatitude:-21},from:'2026-08-01',to:'2026-09-20',maxCloud:20,limit:8});
  assert.equal(request.url,SATELLITE_PROVIDERS.sentinel2.endpoint);
  assert.deepEqual(request.body.collections,['sentinel-2-l2a']);
  assert.deepEqual(request.body.bbox,[-48,-22,-47,-21]);
  assert.equal(request.body.query['eo:cloud_cover'].lte,20);
  assert.equal(request.body.limit,8);
});

test('P7 normalizes Sentinel and Landsat asset aliases',()=>{
  const sentinel=normalizeStacScene('sentinel2',{id:'S2-X',bbox:[-48,-22,-47,-21],properties:{datetime:'2026-09-18T10:00:00Z','eo:cloud_cover':7},assets:{thumbnail:{href:'https://example.test/s2.jpg'},B04_10m:{href:'https://example.test/b04.jp2'},B08_10m:{href:'https://example.test/b08.jp2'}}});
  assert.equal(sentinel.assets.red,'https://example.test/b04.jp2');
  assert.equal(sentinel.assets.nir,'https://example.test/b08.jp2');
  assert.equal(sentinel.assets.preview,'https://example.test/s2.jpg');
  const landsat=normalizeStacScene('landsat',{id:'L9-X',bbox:[-48,-22,-47,-21],properties:{datetime:'2026-09-10T10:00:00Z','eo:cloud_cover':3},assets:{thumbnail:{href:'https://example.test/l9.jpg'},red:{href:'https://example.test/red.tif'},nir08:{href:'https://example.test/nir.tif'}}});
  assert.equal(landsat.assets.red,'https://example.test/red.tif');
  assert.equal(landsat.assets.nir,'https://example.test/nir.tif');
});

test('P7 calculates NDVI with zero-denominator and clamps values',()=>{
  const grid=calculateNdviGrid({red:[0.2,0,1,-2],nir:[0.6,0,3,2],width:2,height:2});
  assert.equal(grid.width,2);
  assert.equal(grid.height,2);
  assert.equal(grid.values[0],0.5);
  assert.equal(grid.values[1],0);
  assert.equal(grid.values[2],0.5);
  assert.equal(grid.values[3],1);
  const summary=summarizeNdvi(grid.values);
  assert.equal(summary.count,4);
  assert.equal(summary.min,0);
  assert.equal(summary.max,1);
  assert.equal(summary.mean,0.5);
});
