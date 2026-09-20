import {fromArrayBuffer,fromUrl} from 'geotiff';
import {calculateNdviGrid,summarizeNdvi} from '../../src/satellite.js';

export async function readGeoTiffBand(buffer,{maxWidth=256,maxHeight=256,fromArrayBuffer:reader=fromArrayBuffer}={}){
  const input=buffer instanceof ArrayBuffer?buffer:ArrayBuffer.isView(buffer)?buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength):null;
  if(!input)throw new TypeError('GeoTIFF buffer inválido.');
  const tiff=await reader(input);const image=await tiff.getImage();const sourceWidth=image.getWidth(),sourceHeight=image.getHeight();
  const scale=Math.min(1,Math.max(1,Number(maxWidth)||256)/sourceWidth,Math.max(1,Number(maxHeight)||256)/sourceHeight);
  const width=Math.max(1,Math.round(sourceWidth*scale)),height=Math.max(1,Math.round(sourceHeight*scale));
  const rasters=await image.readRasters({width,height,samples:[0],interleave:true,resampleMethod:'bilinear'});
  return Object.freeze({width,height,values:Object.freeze(Array.from(rasters,Number)),bbox:image.getBoundingBox?.()??null});
}

export async function ndviFromGeoTiffBuffers({redBuffer,nirBuffer,maxWidth=256,maxHeight=256}={},options={}){
  const [red,nir]=await Promise.all([
    readGeoTiffBand(redBuffer,{maxWidth,maxHeight,fromArrayBuffer:options.redFromArrayBuffer??fromArrayBuffer}),
    readGeoTiffBand(nirBuffer,{maxWidth,maxHeight,fromArrayBuffer:options.nirFromArrayBuffer??fromArrayBuffer})
  ]);
  if(red.width!==nir.width||red.height!==nir.height)throw new TypeError('Bandas vermelha e NIR não possuem dimensões compatíveis.');
  const grid=calculateNdviGrid({red:red.values,nir:nir.values,width:red.width,height:red.height});
  return Object.freeze({...grid,summary:summarizeNdvi(grid.values),bbox:red.bbox??nir.bbox??null});
}

async function bufferFor(source){
  if(source instanceof ArrayBuffer)return source;
  if(ArrayBuffer.isView(source))return source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength);
  if(source instanceof Blob)return source.arrayBuffer();
  if(typeof source==='string'&&/^https?:\/\//i.test(source)){const tiff=await fromUrl(source);const image=await tiff.getImage();const width=Math.min(256,image.getWidth()),height=Math.min(256,image.getHeight());const values=await image.readRasters({width,height,samples:[0],interleave:true,resampleMethod:'bilinear'});return{remote:true,width,height,values:Array.from(values,Number),bbox:image.getBoundingBox?.()??null};}
  throw new TypeError('Fonte GeoTIFF inválida.');
}

export async function ndviFromGeoTiffs({redSource,nirSource,targetWidth=256,targetHeight=256}={}){
  const [redInput,nirInput]=await Promise.all([bufferFor(redSource),bufferFor(nirSource)]);
  if(redInput?.remote||nirInput?.remote){
    if(!redInput?.remote||!nirInput?.remote||redInput.width!==nirInput.width||redInput.height!==nirInput.height)throw new TypeError('Bandas remotas vermelha e NIR não possuem dimensões compatíveis.');
    const grid=calculateNdviGrid({red:redInput.values,nir:nirInput.values,width:redInput.width,height:redInput.height});
    return Object.freeze({...grid,summary:summarizeNdvi(grid.values),bbox:redInput.bbox??nirInput.bbox??null});
  }
  return ndviFromGeoTiffBuffers({redBuffer:redInput,nirBuffer:nirInput,maxWidth:targetWidth,maxHeight:targetHeight});
}

export function ndviToDataUrl(grid){
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=grid.width;canvas.height=grid.height;const ctx=canvas.getContext('2d');const image=ctx.createImageData(grid.width,grid.height);
  for(let index=0;index<grid.values.length;index+=1){const value=Math.max(-1,Math.min(1,Number(grid.values[index])||0));const normalized=(value+1)/2;const offset=index*4;image.data[offset]=Math.round((1-normalized)*190);image.data[offset+1]=Math.round(normalized*190+40);image.data[offset+2]=50;image.data[offset+3]=210;}
  ctx.putImageData(image,0,0);return canvas.toDataURL('image/png');
}
