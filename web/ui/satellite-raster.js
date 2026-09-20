import {fromArrayBuffer,fromUrl} from 'geotiff';
import {calculateNdviGrid} from '../../src/satellite.js';

async function openSource(source){
  if(source instanceof ArrayBuffer)return fromArrayBuffer(source);
  if(ArrayBuffer.isView(source))return fromArrayBuffer(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength));
  if(typeof source==='string'&&/^https?:\/\//i.test(source))return fromUrl(source);
  if(source instanceof Blob)return fromArrayBuffer(await source.arrayBuffer());
  throw new TypeError('Fonte GeoTIFF inválida.');
}

async function readBand(source,{targetWidth=256,targetHeight=256}={}){
  const tiff=await openSource(source);const image=await tiff.getImage();
  const width=Math.max(1,Math.min(Number(targetWidth)||256,image.getWidth()));
  const height=Math.max(1,Math.min(Number(targetHeight)||256,image.getHeight()));
  const rasters=await image.readRasters({width,height,samples:[0],interleave:true,resampleMethod:'bilinear'});
  return {width,height,values:Array.from(rasters,Number),bbox:image.getBoundingBox?.()??null};
}

export async function ndviFromGeoTiffs({redSource,nirSource,targetWidth=256,targetHeight=256}={}){
  const [red,nir]=await Promise.all([readBand(redSource,{targetWidth,targetHeight}),readBand(nirSource,{targetWidth,targetHeight})]);
  if(red.width!==nir.width||red.height!==nir.height)throw new TypeError('Bandas vermelha e NIR não possuem dimensões compatíveis.');
  return Object.freeze({...calculateNdviGrid({red:red.values,nir:nir.values,width:red.width,height:red.height}),bbox:red.bbox??nir.bbox??null});
}

export function ndviToDataUrl(grid,{scale=2}={}){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=grid.width;canvas.height=grid.height;const ctx=canvas.getContext('2d');const image=ctx.createImageData(grid.width,grid.height);
  for(let index=0;index<grid.values.length;index+=1){const value=Math.max(-1,Math.min(1,Number(grid.values[index])||0));const normalized=(value+1)/2;const offset=index*4;image.data[offset]=Math.round((1-normalized)*190);image.data[offset+1]=Math.round(normalized*190+40);image.data[offset+2]=50;image.data[offset+3]=210;}
  ctx.putImageData(image,0,0);return canvas.toDataURL('image/png');
}
