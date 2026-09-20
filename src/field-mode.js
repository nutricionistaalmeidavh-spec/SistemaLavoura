const EARTH_RADIUS_M=6371008.8;
const VALID_KINDS=new Set(['observation','photo','point','measurement']);
const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const optional=value=>typeof value==='string'&&value.trim()?value.trim():null;
const idFor=(prefix,value)=>optional(value)??(globalThis.crypto?.randomUUID?.()??`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const coordinate=(value,label,min,max)=>{const parsed=Number(value);if(!Number.isFinite(parsed)||parsed<min||parsed>max)throw new TypeError(`${label} is invalid.`);return parsed;};
const rad=value=>value*Math.PI/180;
const unwrap=value=>value?.payload??value;
const rows=values=>(values??[]).map(unwrap).filter(Boolean);

export function createFieldObservation(input={}){
  const kind=String(input.kind??'observation').trim().toLowerCase();
  if(!VALID_KINDS.has(kind))throw new TypeError(`Observation kind must be one of: ${[...VALID_KINDS].join(', ')}.`);
  const latitude=coordinate(input.latitude,'Latitude',-90,90);
  const longitude=coordinate(input.longitude,'Longitude',-180,180);
  const syncState=input.syncState??'pending';
  if(!['pending','synced','conflict'].includes(syncState))throw new TypeError('syncState is invalid.');
  return Object.freeze({
    id:idFor('field-observation',input.id),
    fieldId:text(input.fieldId,'Field id'),
    kind,
    title:text(input.title??input.name,'Observation title'),
    notes:optional(input.notes),
    latitude,
    longitude,
    accuracyM:input.accuracyM==null?null:Math.max(0,Number(input.accuracyM)),
    photoFileId:optional(input.photoFileId),
    observedAt:new Date(input.observedAt??Date.now()).toISOString(),
    syncState,
    syncedAt:input.syncedAt?new Date(input.syncedAt).toISOString():null,
    metadata:Object.freeze({...((input.metadata&&typeof input.metadata==='object')?input.metadata:{})})
  });
}

function normalizePoints(points){
  if(!Array.isArray(points))throw new TypeError('Measurement points must be an array.');
  return points.map((point,index)=>{
    if(!Array.isArray(point)||point.length<2)throw new TypeError(`Measurement point ${index+1} is invalid.`);
    const longitude=coordinate(point[0],`Longitude ${index+1}`,-180,180);
    const latitude=coordinate(point[1],`Latitude ${index+1}`,-90,90);
    return [longitude,latitude];
  });
}

export function measureDistanceMeters(points=[]){
  const normalized=normalizePoints(points);
  if(normalized.length<2)return 0;
  let total=0;
  for(let index=1;index<normalized.length;index+=1){
    const [lon1,lat1]=normalized[index-1],[lon2,lat2]=normalized[index];
    const dLat=rad(lat2-lat1),dLon=rad(lon2-lon1);
    const a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;
    total+=EARTH_RADIUS_M*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  return total;
}

export function measureAreaHa(points=[]){
  const normalized=normalizePoints(points);
  if(normalized.length<3)return 0;
  const meanLat=rad(normalized.reduce((sum,point)=>sum+point[1],0)/normalized.length);
  const projected=normalized.map(([lon,lat])=>[EARTH_RADIUS_M*rad(lon)*Math.cos(meanLat),EARTH_RADIUS_M*rad(lat)]);
  let twiceArea=0;
  for(let index=0;index<projected.length;index+=1){
    const [x1,y1]=projected[index],[x2,y2]=projected[(index+1)%projected.length];
    twiceArea+=x1*y2-x2*y1;
  }
  return Math.abs(twiceArea)/2/10000;
}

export function buildFieldModeSnapshot(input={}){
  const fields=rows(input.fields),geometries=rows(input.geometries),operations=rows(input.operations),scouting=rows(input.scouting),rainfall=rows(input.rainfall),observations=rows(input.observations),files=rows(input.files);
  const geometryIds=new Set(geometries.map(item=>String(item.fieldId??item.id)));
  const fieldCards=fields.map(field=>Object.freeze({
    id:String(field.id),
    code:field.code??null,
    name:field.name??String(field.id),
    farmUnitId:field.farmUnitId??null,
    areaHa:Number(field.areaHa??0),
    mapped:geometryIds.has(String(field.id)),
    pendingOperations:Object.freeze(operations.filter(item=>String(item.fieldId)===String(field.id)&&['planned','in-progress'].includes(String(item.status)))),
    openScouting:Object.freeze(scouting.filter(item=>String(item.fieldId)===String(field.id)&&!['closed','resolved','dismissed'].includes(String(item.status??'open').toLowerCase()))),
    recentRainfall:Object.freeze(rainfall.filter(item=>String(item.fieldId)===String(field.id)).slice(-7)),
    observations:Object.freeze(observations.filter(item=>String(item.fieldId)===String(field.id))),
    photoCount:files.filter(item=>String(item.entityId??item.fieldId)===String(field.id)&&String(item.mimeType??'').startsWith('image/')).length
  }));
  return Object.freeze({
    offlineReady:true,
    gpsReady:true,
    fields:Object.freeze(fieldCards),
    observations:Object.freeze(observations),
    pendingSync:Object.freeze(observations.filter(item=>String(item.syncState??'pending')!=='synced')),
    generatedAt:new Date(input.now??Date.now()).toISOString()
  });
}
