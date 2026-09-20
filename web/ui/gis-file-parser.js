import {DOMParser} from '@xmldom/xmldom';
import {kml,gpx} from '@tmcw/togeojson';
import {unzipSync,strFromU8} from 'fflate';
import shp from 'shpjs';
import {ISOXMLManager} from 'isoxml';
import {normalizeGisFeatureCollection} from '../../src/gis-import.js';

const bytesOf=value=>value instanceof Uint8Array?value:new Uint8Array(value instanceof ArrayBuffer?value:value?.buffer??[]);
const asFeatureCollection=value=>Array.isArray(value)?{type:'FeatureCollection',features:value.flatMap(item=>item?.features??[])}:value;
const lower=value=>String(value??'').toLowerCase();

function parseXml(textValue,kind){
  const doc=new DOMParser().parseFromString(String(textValue??''),'text/xml');
  const errors=doc.getElementsByTagName('parsererror');
  if(errors?.length)throw new TypeError(`Arquivo ${kind.toUpperCase()} contém XML inválido.`);
  return kind==='kml'?kml(doc):gpx(doc);
}

async function parseIsoXml({bytes,text,name}){
  const manager=new ISOXMLManager();
  const data=text!=null?String(text):bytesOf(bytes);
  const mime=text!=null||/taskdata\.xml$/i.test(name)?'text/xml':'application/zip';
  await manager.parseISOXMLFile(data,mime);
  const partfields=manager.rootElement?.attributes?.Partfield??[];
  const features=[];
  for(const [index,partfield] of partfields.entries()){
    const geometry=typeof partfield.toGeoJSON==='function'?partfield.toGeoJSON():null;
    if(!geometry)continue;
    features.push({type:'Feature',properties:{name:partfield.attributes?.PartfieldDesignator??`Partfield ${index+1}`,source:'ISOXML'},geometry});
  }
  if(!features.length)throw new TypeError('ISOXML não contém limites Partfield importáveis.');
  return {type:'FeatureCollection',features,warnings:manager.getWarnings?.()??[]};
}

export async function parseGisFile({name='',type='',bytes=null,text=null}={}){
  const filename=lower(name),mime=lower(type);
  let format='';let raw=null;let warnings=[];
  if(filename.endsWith('.geojson')||filename.endsWith('.json')||mime.includes('geo+json')||mime==='application/json'){
    format='geojson';raw=JSON.parse(text??new TextDecoder().decode(bytesOf(bytes)));
  }else if(filename.endsWith('.kml')||mime.includes('kml')){
    format='kml';raw=parseXml(text??new TextDecoder().decode(bytesOf(bytes)),'kml');
  }else if(filename.endsWith('.gpx')||mime.includes('gpx')){
    format='gpx';raw=parseXml(text??new TextDecoder().decode(bytesOf(bytes)),'gpx');
  }else if(filename.endsWith('.kmz')){
    format='kmz';const files=unzipSync(bytesOf(bytes));const entry=Object.entries(files).find(([path])=>/\.kml$/i.test(path));if(!entry)throw new TypeError('KMZ não contém arquivo KML.');raw=parseXml(strFromU8(entry[1]),'kml');
  }else if(filename.endsWith('.zip')){
    const files=unzipSync(bytesOf(bytes));const names=Object.keys(files);
    if(names.some(path=>/taskdata\.xml$/i.test(path))){format='isoxml';const parsed=await parseIsoXml({bytes,name});raw=parsed;warnings=parsed.warnings??[];}
    else if(names.some(path=>/\.shp$/i.test(path))){format='shapefile';raw=await shp(bytesOf(bytes));}
    else throw new TypeError('ZIP não reconhecido como Shapefile ou ISOXML/TaskData.');
  }else if(filename.endsWith('.shp')){
    throw new TypeError('Arquivo .shp isolado não preserva atributos/projeção. Compacte .shp, .dbf e .prj em ZIP para importar com segurança.');
  }else if(/taskdata\.xml$/i.test(filename)||mime.includes('xml')){
    format='isoxml';const parsed=await parseIsoXml({text:text??new TextDecoder().decode(bytesOf(bytes)),name});raw=parsed;warnings=parsed.warnings??[];
  }else throw new TypeError('Formato GIS não suportado. Use GeoJSON, KML, KMZ, GPX, Shapefile ZIP ou ISOXML/TaskData.');
  const normalized=normalizeGisFeatureCollection(asFeatureCollection(raw));
  return Object.freeze({format,sourceFile:name||null,featureCollection:normalized,warnings:Object.freeze(warnings.map(String))});
}
