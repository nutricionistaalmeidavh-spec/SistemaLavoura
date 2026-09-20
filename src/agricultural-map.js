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

function normalizeRing(raw){
  if(!Array.isArray(raw))return null;const ring=[];
  for(const point of raw){if(!Array.isArray(point)||point.length<2)continue;const longitude=Number(point[0]),latitude=Number(point[1]);if(!Number.isFinite(longitude)||!Number.isFinite(latitude)||longitude<-180||longitude>180||latitude<-90||latitude>90)continue;ring.push(Object.freeze([longitude,latitude]));}
  return ring.length>=3?Object.freeze(ring):null;
}
function fieldGeometry(record){
  const source=record?.geometry??record;if(!source)return null;const type=String(source.type??'Polygon');const coordinates=source.coordinates;
  let rings=[];
  if(type==='MultiPolygon'&&Array.isArray(coordinates))rings=coordinates.map(polygon=>normalizeRing(polygon?.[0])).filter(Boolean);
  else if(type==='Polygon'){
    if(Array.isArray(coordinates?.[0]?.[0]))rings=[normalizeRing(coordinates[0])].filter(Boolean);
    else rings=[normalizeRing(coordinates)].filter(Boolean);
  }
  if(!rings.length)return null;
  return Object.freeze({type:type==='MultiPolygon'?'MultiPolygon':'Polygon',coordinates:structuredClone(coordinates),rings:Object.freeze(rings)});
}
function polygonCentroid(ring){
  if(!ring?.length)return null;let twiceArea=0,x=0,y=0;
  for(let index=0;index<ring.length;index+=1){const[x1,y1]=ring[index],[x2,y2]=ring[(index+1)%ring.length];const cross=x1*y2-x2*y1;twiceArea+=cross;x+=(x1+x2)*cross;y+=(y1+y2)*cross;}
  if(Math.abs(twiceArea)<1e-12){const longitude=ring.reduce((sum,point)=>sum+point[0],0)/ring.length,latitude=ring.reduce((sum,point)=>sum+point[1],0)/ring.length;return Object.freeze({latitude,longitude});}
  return Object.freeze({longitude:x/(3*twiceArea),latitude:y/(3*twiceArea)});
}
function pointsBounds(points){if(!points?.length)return null;const longitudes=points.map(p=>p[0]),latitudes=points.map(p=>p[1]);return Object.freeze({minLongitude:Math.min(...longitudes),minLatitude:Math.min(...latitudes),maxLongitude:Math.max(...longitudes),maxLatitude:Math.max(...latitudes)});}
function seasonForField(fieldId,seasons,now){
  const related=seasons.filter(item=>item.fieldId===fieldId||(item.fieldIds??[]).map(String).includes(String(fieldId)));if(!related.length)return null;
  const active=related.filter(item=>{const start=dateValue(item.plantingWindowStart??item.startsAt),end=dateValue(item.plantingWindowEnd??item.endsAt);if(start!=null&&now<start)return false;if(end!=null&&now>end)return false;return start!=null||end!=null;});
  const candidates=active.length?active:related;return [...candidates].sort((a,b)=>(dateValue(b.plantingWindowStart??b.startsAt)??0)-(dateValue(a.plantingWindowStart??a.startsAt)??0))[0]??null;
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
  const now=dateValue(input.now??Date.now())??Date.now(),recentRainAfter=now-7*24*60*60*1000;const geometryByField=new Map(geometries.map(item=>[String(item.fieldId??item.id),item]));const mappedFields=[];
  for(const field of fields){
    const geometry=fieldGeometry(geometryByField.get(String(field.id)));if(!geometry)continue;const allPoints=geometry.rings.flat();const season=seasonForField(field.id,seasons,now),centroid=polygonCentroid(geometry.rings[0]),bounds=pointsBounds(allPoints);
    const fieldScouting=scouting.filter(item=>String(item.fieldId)===String(field.id)),fieldFiles=files.filter(item=>String(item.entityId??item.fieldId)===String(field.id)&&imageFile(item)),fieldRain=rainfall.filter(item=>String(item.fieldId)===String(field.id)&&(dateValue(item.measuredAt??item.recordedAt)??0)>=recentRainAfter),fieldOperations=operations.filter(item=>String(item.fieldId)===String(field.id)),fieldApplications=applications.filter(item=>String(item.fieldId)===String(field.id));
    mappedFields.push(Object.freeze({fieldId:String(field.id),code:field.code??null,name:field.name??String(field.id),farmUnitId:field.farmUnitId??null,areaHa:Number(field.areaHa??0),geometry,centroid,bounds,season:seasonCard(season),color:season?.crop?colorFor(season.crop):'#718096',summary:Object.freeze({openScouting:fieldScouting.filter(item=>!['closed','resolved','dismissed'].includes(String(item.status??'open').toLowerCase())).length,photoCount:fieldFiles.length,recentRainMm:fieldRain.reduce((sum,item)=>sum+(Number(item.mm)||0),0),plannedOperations:fieldOperations.filter(item=>['planned','in-progress'].includes(String(item.status))).length,recentApplications:fieldApplications.filter(item=>(dateValue(item.appliedAt)??0)>=recentRainAfter).length})}));
  }
  const fieldById=new Map(mappedFields.map(item=>[String(item.fieldId),item]));const compact=values=>Object.freeze(values.filter(Boolean));
  const layers={applications:compact(applications.map(item=>marker(item,'application',fieldById,{name:item.target??'Aplicação',appliedAt:item.appliedAt??null,products:Object.freeze([...(item.products??[])])}))),scouting:compact(scouting.map(item=>marker(item,'scouting',fieldById,{name:item.name??item.kind??'Monitoramento',severity:Number(item.severity??0),status:item.status??'open',observedAt:item.observedAt??null}))),operations:compact(operations.map(item=>marker(item,'operation',fieldById,{name:item.typeName??item.typeId??'Operação',status:item.status??null,scheduledAt:item.scheduledAt??null,machineName:item.machineName??null}))),photos:compact(files.filter(imageFile).map(item=>marker({...item,fieldId:item.fieldId??item.entityId},'photo',fieldById,{name:item.name??'Foto',mimeType:item.mimeType??null}))),rainfall:compact(rainfall.map(item=>marker(item,'rainfall',fieldById,{name:'Chuva',mm:Number(item.mm??0),measuredAt:item.measuredAt??item.recordedAt??null}))),sensors:compact(mapPoints.filter(item=>item.kind==='sensor').map(item=>marker(item,'sensor',fieldById,{status:item.status??'active'}))),machines:compact(mapPoints.filter(item=>item.kind==='machine').map(item=>marker(item,'machine',fieldById,{status:item.status??'active'}))),storage:compact(mapPoints.filter(item=>item.kind==='storage').map(item=>marker(item,'storage',fieldById,{status:item.status??'active'}))),sampling:compact(mapPoints.filter(item=>item.kind==='sampling').map(item=>marker(item,'sampling',fieldById,{status:item.status??'active'})))};
  const allCoordinates=[...mappedFields.flatMap(field=>field.geometry.rings.flat().map(([longitude,latitude])=>({longitude,latitude}))),...Object.values(layers).flatMap(items=>items.map(({longitude,latitude})=>({longitude,latitude})))];
  const bounds=allCoordinates.length?Object.freeze({minLongitude:Math.min(...allCoordinates.map(p=>p.longitude)),minLatitude:Math.min(...allCoordinates.map(p=>p.latitude)),maxLongitude:Math.max(...allCoordinates.map(p=>p.longitude)),maxLatitude:Math.max(...allCoordinates.map(p=>p.latitude))}):null;
  const legend=Object.freeze([...new Map(mappedFields.filter(field=>field.season?.crop).map(field=>[field.season.crop,Object.freeze({crop:field.season.crop,color:field.color})])).values()]);
  return Object.freeze({fields:Object.freeze(mappedFields),unmappedFields:Object.freeze(fields.filter(field=>!fieldById.has(String(field.id))).map(field=>Object.freeze({id:field.id,name:field.name??field.id,areaHa:Number(field.areaHa??0)}))),layers:Object.freeze(layers),legend,bounds,generatedAt:new Date(now).toISOString()});
}
