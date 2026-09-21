import {validatePolygonRingTopology} from './gis-import.js';

const MAP_POINT_KINDS=Object.freeze(['sensor','machine','storage','sampling']);
const FIELD_COLORS=Object.freeze(['#2F855A','#3182CE','#D69E2E','#805AD5','#DD6B20','#319795','#B83280','#4A5568']);
const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const optional=value=>typeof value==='string'&&value.trim()?value.trim():null;
const idFor=(prefix,value)=>optional(value)??(globalThis.crypto?.randomUUID?.()??`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const unwrap=value=>value?.payload??value;
const rows=values=>(values??[]).map(unwrap).filter(Boolean);
const number=(value,label,{min=-Infinity,max=Infinity}={})=>{const parsed=Number(value);if(!Number.isFinite(parsed)||parsed<min||parsed>max)throw new TypeError(`${label} is invalid.`);return parsed;};
const maybeCoordinate=(latitude,longitude)=>{if(latitude==null||longitude==null)return null;const lat=Number(latitude),lon=Number(longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180)return null;return Object.freeze({latitude:lat,longitude:lon});};
const dateValue=value=>{const time=new Date(value??0).getTime();return Number.isFinite(time)?time:null;};
const hash=value=>{let output=0;for(const char of String(value??''))output=((output<<5)-output+char.charCodeAt(0))|0;return Math.abs(output);};
const colorFor=value=>FIELD_COLORS[hash(value)%FIELD_COLORS.length];

function strictStoredRing(raw){
  if(!Array.isArray(raw)||raw.length<3)return null;
  const ring=[];
  for(const point of raw){
    if(!Array.isArray(point)||point.length<2)return null;
    const longitude=Number(point[0]),latitude=Number(point[1]);
    if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||longitude<-180||longitude>180||latitude<-90||latitude>90)return null;
    ring.push([longitude,latitude]);
  }
  if(ring[0][0]!==ring.at(-1)[0]||ring[0][1]!==ring.at(-1)[1])ring.push([...ring[0]]);
  try{
    validatePolygonRingTopology(ring,'stored field boundary');
    return Object.freeze(ring.map(point=>Object.freeze(point)));
  }catch{return null;}
}
function fieldGeometry(record){
  const source=record?.geometry??record;
  if(!source)return null;
  const type=String(source.type??'Polygon'),coordinates=source.coordinates;
  const rings=[];
  if(type==='MultiPolygon'){
    if(!Array.isArray(coordinates)||!coordinates.length)return null;
    for(const polygon of coordinates){
      if(!Array.isArray(polygon)||!polygon.length)return null;
      const ring=strictStoredRing(polygon[0]);
      if(!ring)return null;
      rings.push(ring);
    }
  }else if(type==='Polygon'){
    const raw=Array.isArray(coordinates?.[0]?.[0])?coordinates[0]:coordinates;
    const ring=strictStoredRing(raw);
    if(!ring)return null;
    rings.push(ring);
  }else return null;
  return Object.freeze({type,rings:Object.freeze(rings),coordinates:structuredClone(coordinates)});
}
function polygonCentroid(ring){
  if(!ring?.length)return null;let twiceArea=0,x=0,y=0;
  for(let index=0;index<ring.length-1;index+=1){const[x1,y1]=ring[index],[x2,y2]=ring[index+1];const crossValue=x1*y2-x2*y1;twiceArea+=crossValue;x+=(x1+x2)*crossValue;y+=(y1+y2)*crossValue;}
  if(Math.abs(twiceArea)<1e-12){const unique=ring.slice(0,-1);const longitude=unique.reduce((sum,point)=>sum+point[0],0)/unique.length,latitude=unique.reduce((sum,point)=>sum+point[1],0)/unique.length;return Object.freeze({latitude,longitude});}
  return Object.freeze({longitude:x/(3*twiceArea),latitude:y/(3*twiceArea)});
}
function pointsBounds(points){if(!points?.length)return null;let minLongitude=Infinity,minLatitude=Infinity,maxLongitude=-Infinity,maxLatitude=-Infinity;for(const point of points){minLongitude=Math.min(minLongitude,point[0]);minLatitude=Math.min(minLatitude,point[1]);maxLongitude=Math.max(maxLongitude,point[0]);maxLatitude=Math.max(maxLatitude,point[1]);}return Object.freeze({minLongitude,minLatitude,maxLongitude,maxLatitude});}
function groupBy(records,keyOf){
  const index=new Map();
  for(const record of records){
    const id=String(keyOf(record)??'');
    if(!id)continue;
    const current=index.get(id);
    if(current)current.push(record);else index.set(id,[record]);
  }
  return index;
}
function seasonsByField(seasons){
  const index=new Map();
  for(const season of seasons){
    const ids=new Set([...(season.fieldId==null?[]:[String(season.fieldId)]),...(Array.isArray(season.fieldIds)?season.fieldIds.map(String):[])]);
    for(const id of ids){const current=index.get(id);if(current)current.push(season);else index.set(id,[season]);}
  }
  return index;
}
function seasonForField(fieldId,index,now){
  const related=index.get(String(fieldId))??[];
  if(!related.length)return null;
  const active=related.filter(item=>{const start=dateValue(item.plantingWindowStart??item.startsAt),end=dateValue(item.plantingWindowEnd??item.endsAt);if(start!=null&&now<start)return false;if(end!=null&&now>end)return false;return start!=null||end!=null;});
  const candidates=active.length?active:related;
  return [...candidates].sort((a,b)=>(dateValue(b.plantingWindowStart??b.startsAt)??0)-(dateValue(a.plantingWindowStart??a.startsAt)??0))[0]??null;
}
function seasonCard(season){return season?Object.freeze({id:season.id,crop:season.crop??null,varietyName:season.varietyName??null,periodName:season.periodName??season.productionPeriodId??null}):null;}
function coordinateFor(item,fieldById){const explicit=maybeCoordinate(item?.latitude,item?.longitude);if(explicit)return Object.freeze({...explicit,coordinateSource:'explicit'});const field=fieldById.get(String(item?.fieldId??''));if(!field?.centroid)return null;return Object.freeze({...field.centroid,coordinateSource:'field-centroid'});}
function marker(item,kind,fieldById,extra={}){const coordinate=coordinateFor(item,fieldById);if(!coordinate)return null;return Object.freeze({id:String(item.id??`${kind}-${coordinate.latitude}-${coordinate.longitude}`),kind,fieldId:item.fieldId??null,seasonId:item.seasonId??null,name:item.name??item.title??item.target??kind,latitude:coordinate.latitude,longitude:coordinate.longitude,coordinateSource:coordinate.coordinateSource,...extra});}
function imageFile(file){return String(file?.mimeType??'').startsWith('image/')||/\.(png|jpe?g|webp|gif)$/i.test(String(file?.name??''));}

export function createAgriculturalMapPoint(input={}){
  const kind=String(input.kind??'').trim().toLowerCase();if(!MAP_POINT_KINDS.includes(kind))throw new TypeError(`Map point kind must be one of: ${MAP_POINT_KINDS.join(', ')}.`);
  const latitude=number(input.latitude,'Latitude',{min:-90,max:90}),longitude=number(input.longitude,'Longitude',{min:-180,max:180});
  return Object.freeze({id:idFor('map-point',input.id),kind,name:text(input.name,'Map point name'),latitude,longitude,fieldId:optional(input.fieldId),seasonId:optional(input.seasonId),status:optional(input.status)??'active',notes:optional(input.notes),observedAt:input.observedAt?new Date(input.observedAt).toISOString():null,metadata:Object.freeze({...((input.metadata&&typeof input.metadata==='object')?input.metadata:{})}),updatedAt:new Date(input.updatedAt??Date.now()).toISOString()});
}

export function buildAgriculturalMapSnapshot(input={}){
  const fields=rows(input.fields),geometries=rows(input.geometries),seasons=rows(input.seasons),operations=rows(input.operations),applications=rows(input.applications),scouting=rows(input.scouting),files=rows(input.files),rainfall=rows(input.rainfall),mapPoints=rows(input.mapPoints);
  const now=dateValue(input.now??Date.now())??Date.now(),recentRainAfter=now-7*24*60*60*1000;
  const geometryByField=new Map();for(const item of geometries)geometryByField.set(String(item.fieldId??item.id),item);
  const seasonIndex=seasonsByField(seasons),scoutingIndex=groupBy(scouting,item=>item.fieldId),imageFiles=files.filter(imageFile),fileIndex=groupBy(imageFiles,item=>item.entityId??item.fieldId),rainIndex=groupBy(rainfall,item=>item.fieldId),operationIndex=groupBy(operations,item=>item.fieldId),applicationIndex=groupBy(applications,item=>item.fieldId);
  const mappedFields=[],invalidGeometryIds=new Set();
  for(const field of fields){
    const fieldId=String(field.id),geometryRecord=geometryByField.get(fieldId);
    if(!geometryRecord)continue;
    const geometry=fieldGeometry(geometryRecord);
    if(!geometry){invalidGeometryIds.add(fieldId);continue;}
    const allPoints=geometry.rings.flat(),season=seasonForField(fieldId,seasonIndex,now),centroid=polygonCentroid(geometry.rings[0]),bounds=pointsBounds(allPoints);
    const fieldScouting=scoutingIndex.get(fieldId)??[],fieldFiles=fileIndex.get(fieldId)??[],fieldRain=rainIndex.get(fieldId)??[],fieldOperations=operationIndex.get(fieldId)??[],fieldApplications=applicationIndex.get(fieldId)??[];
    mappedFields.push(Object.freeze({fieldId,code:field.code??null,name:field.name??fieldId,farmUnitId:field.farmUnitId??null,areaHa:Number(field.areaHa??0),geometry,centroid,bounds,season:seasonCard(season),color:season?.crop?colorFor(season.crop):'#718096',summary:Object.freeze({openScouting:fieldScouting.filter(item=>!['closed','resolved','dismissed'].includes(String(item.status??'open').toLowerCase())).length,photoCount:fieldFiles.length,recentRainMm:fieldRain.filter(item=>(dateValue(item.measuredAt??item.recordedAt)??0)>=recentRainAfter).reduce((sum,item)=>sum+(Number(item.mm)||0),0),plannedOperations:fieldOperations.filter(item=>['planned','in-progress'].includes(String(item.status))).length,recentApplications:fieldApplications.filter(item=>(dateValue(item.appliedAt)??0)>=recentRainAfter).length})}));
  }
  const fieldById=new Map(mappedFields.map(item=>[String(item.fieldId),item])),compact=values=>Object.freeze(values.filter(Boolean));
  const layers={applications:compact(applications.map(item=>marker(item,'application',fieldById,{name:item.target??'Aplicação',appliedAt:item.appliedAt??null,products:Object.freeze([...(item.products??[])])}))),scouting:compact(scouting.map(item=>marker(item,'scouting',fieldById,{name:item.name??item.kind??'Monitoramento',severity:Number(item.severity??0),status:item.status??'open',observedAt:item.observedAt??null}))),operations:compact(operations.map(item=>marker(item,'operation',fieldById,{name:item.typeName??item.typeId??'Operação',status:item.status??null,scheduledAt:item.scheduledAt??null,machineName:item.machineName??null}))),photos:compact(imageFiles.map(item=>marker({...item,fieldId:item.fieldId??item.entityId},'photo',fieldById,{name:item.name??'Foto',mimeType:item.mimeType??null}))),rainfall:compact(rainfall.map(item=>marker(item,'rainfall',fieldById,{name:'Chuva',mm:Number(item.mm??0),measuredAt:item.measuredAt??item.recordedAt??null}))),sensors:compact(mapPoints.filter(item=>item.kind==='sensor').map(item=>marker(item,'sensor',fieldById,{status:item.status??'active'}))),machines:compact(mapPoints.filter(item=>item.kind==='machine').map(item=>marker(item,'machine',fieldById,{status:item.status??'active'}))),storage:compact(mapPoints.filter(item=>item.kind==='storage').map(item=>marker(item,'storage',fieldById,{status:item.status??'active'}))),sampling:compact(mapPoints.filter(item=>item.kind==='sampling').map(item=>marker(item,'sampling',fieldById,{status:item.status??'active'})))};
  let minLongitude=Infinity,minLatitude=Infinity,maxLongitude=-Infinity,maxLatitude=-Infinity,hasCoordinates=false;
  const include=(longitude,latitude)=>{hasCoordinates=true;minLongitude=Math.min(minLongitude,longitude);minLatitude=Math.min(minLatitude,latitude);maxLongitude=Math.max(maxLongitude,longitude);maxLatitude=Math.max(maxLatitude,latitude);};
  for(const field of mappedFields)for(const [longitude,latitude] of field.geometry.rings.flat())include(longitude,latitude);
  for(const items of Object.values(layers))for(const item of items)include(item.longitude,item.latitude);
  const bounds=hasCoordinates?Object.freeze({minLongitude,minLatitude,maxLongitude,maxLatitude}):null;
  const legend=Object.freeze([...new Map(mappedFields.filter(field=>field.season?.crop).map(field=>[field.season.crop,Object.freeze({crop:field.season.crop,color:field.color})])).values()]);
  const unmappedFields=fields.filter(field=>!fieldById.has(String(field.id))).map(field=>{const invalidGeometry=invalidGeometryIds.has(String(field.id));return Object.freeze({id:field.id,name:field.name??field.id,areaHa:Number(field.areaHa??0),...(invalidGeometry?{invalidGeometry:true,reason:'invalid-geometry'}:{})});});
  return Object.freeze({fields:Object.freeze(mappedFields),unmappedFields:Object.freeze(unmappedFields),layers:Object.freeze(layers),legend,bounds,generatedAt:new Date(now).toISOString()});
}