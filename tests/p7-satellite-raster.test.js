import test from 'node:test';
import assert from 'node:assert/strict';
import {readGeoTiffBand,ndviFromGeoTiffBuffers} from '../web/ui/satellite-raster.js';

test('P7 reads a reduced raster band through the GeoTIFF adapter contract',async()=>{
  const fakeFromArrayBuffer=async()=>({getImage:async()=>({getWidth:()=>200,getHeight:()=>100,readRasters:async({width,height,interleave})=>{assert.equal(width,4);assert.equal(height,2);assert.equal(interleave,true);return Float32Array.from([1,2,3,4,5,6,7,8]);}})});
  const band=await readGeoTiffBand(new Uint8Array([1,2,3]).buffer,{maxWidth:4,maxHeight:4,fromArrayBuffer:fakeFromArrayBuffer});
  assert.equal(band.width,4);assert.equal(band.height,2);assert.deepEqual(band.values,[1,2,3,4,5,6,7,8]);
});

test('P7 builds NDVI from two local GeoTIFF buffers without uploading them',async()=>{
  const makeReader=values=>async()=>({getImage:async()=>({getWidth:()=>2,getHeight:()=>2,readRasters:async()=>Float32Array.from(values)})});
  const result=await ndviFromGeoTiffBuffers({redBuffer:new ArrayBuffer(1),nirBuffer:new ArrayBuffer(1),maxWidth:2,maxHeight:2},{redFromArrayBuffer:makeReader([1,1,0,2]),nirFromArrayBuffer:makeReader([3,1,0,6])});
  assert.equal(result.width,2);assert.equal(result.height,2);assert.deepEqual(result.values,[0.5,0,0,0.5]);assert.equal(result.summary.mean,0.25);
});
