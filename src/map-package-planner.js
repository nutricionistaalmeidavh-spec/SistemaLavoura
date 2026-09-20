const RELEASE_RE=/^[0-9]{4}\.[0-9]{2}\.[0-9]+$/;
const SHA_RE=/^[a-f0-9]{64}$/;
const PROFILES=Object.freeze({basic:Object.freeze({maxZoom:10,label:'Básico'}),detailed:Object.freeze({maxZoom:12,label:'Detalhado'}),maximum:Object.freeze({maxZoom:14,label:'Máximo'})});
const safeId=value=>String(value??'farm').trim().toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'farm';
const validBounds=bounds=>Array.isArray(bounds)&&bounds.length===4&&bounds.every(Number.isFinite)&&bounds[0]<bounds[2]&&bounds[1]<bounds[3];
const intersects=(a,b)=>a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1];
const releaseBase=version=>`https://github.com/nutricionistaalmeidavh-spec/mapasbrasilrelease/releases/download/br-maps-v${version}`;
const sourceDateToBuild=value=>String(value??'').replaceAll('-','');

function ringOf(geometry){
  const coordinates=geometry?.coordinates;
  if(!Array.isArray(coordinates))return [];
  const ring=Array.isArray(coordinates?.[0]?.[0])?coordinates[0]:coordinates;
  return ring.filter(point=>Array.isArray(point)&&point.length>=2&&Number.isFinite(Number(point[0]))&&Number.isFinite(Number(point[1]))).map(point=>[Number(point[0]),Number(point[1])]);
}

export function validateMapManifest(input){
  if(!input||typeof input!=='object')throw new TypeError('Map manifest is required.');
  if(input.schemaVersion!==1)throw new TypeError('Unsupported map manifest schemaVersion.');
  if(!RELEASE_RE.test(String(input.releaseVersion??'')))throw new TypeError('Invalid map manifest releaseVersion.');
  if(!Array.isArray(input.maps)||input.maps.length===0)throw new TypeError('Map manifest maps are required.');
  const ids=new Set();
  for(const map of input.maps){
    if(!map?.id||ids.has(map.id))throw new TypeError(`Invalid or duplicate map id: ${String(map?.id)}`);
    ids.add(map.id);
    if(!validBounds(map.bounds))throw new TypeError(`Invalid bounds for ${map.id}.`);
    if(map.available===true){
      if(typeof map.asset!=='string'||!map.asset.endsWith('.pmtiles'))throw new TypeError(`Invalid asset for ${map.id}.`);
      if(!Number.isInteger(map.size)||map.size<=0)throw new TypeError(`Invalid size for ${map.id}.`);
      if(!SHA_RE.test(String(map.sha256??'')))throw new TypeError(`Invalid sha256 for ${map.id}.`);
      if(!map.sourceDate||!/^\d{4}-\d{2}-\d{2}$/.test(map.sourceDate))throw new TypeError(`Invalid sourceDate for ${map.id}.`);
    }
  }
  return input;
}

export function farmBoundsFromGeometries({farmUnitId,fields=[],geometries=[]}={}){
  const scopedIds=new Set(fields.filter(field=>String(field?.farmUnitId??'')===String(farmUnitId??'')).map(field=>String(field.id)));
  const points=[];
  for(const geometry of geometries){
    const fieldId=String(geometry?.fieldId??geometry?.id??'');
    if(scopedIds.size&& !scopedIds.has(fieldId))continue;
    for(const point of ringOf(geometry))points.push(point);
  }
  if(!points.length)throw new Error('Farm has no mapped field polygons.');
  const longitudes=points.map(point=>point[0]),latitudes=points.map(point=>point[1]);
  return [Math.min(...longitudes),Math.min(...latitudes),Math.max(...longitudes),Math.max(...latitudes)];
}

export function buildFarmMapDownloadPlan({farmUnitId,farmName=null,fields=[],geometries=[],manifest,profile='detailed'}={}){
  const checked=validateMapManifest(manifest);
  const definition=PROFILES[profile];
  if(!definition)throw new TypeError(`Unknown map profile: ${String(profile)}.`);
  const bounds=farmBoundsFromGeometries({farmUnitId,fields,geometries});
  const states=checked.maps.filter(map=>map.available===true&&map.kind!=='national'&&intersects(bounds,map.bounds));
  if(!states.length)throw new Error('No available map package covers this farm.');
  const base=releaseBase(checked.releaseVersion);
  const sources=states.map(map=>Object.freeze({id:map.id,name:map.name,asset:map.asset,size:map.size,sha256:map.sha256,minZoom:map.minZoom,maxZoom:map.maxZoom,url:`${base}/${map.asset}`}));
  const sourceDate=states.map(map=>map.sourceDate).filter(Boolean).sort().at(-1);
  if(!sourceDate)throw new Error('Map source date is unavailable.');
  const build=sourceDateToBuild(sourceDate);
  const bbox=bounds.join(',');
  const areaFraction=Math.max(0.0001,Math.min(1,((bounds[2]-bounds[0])*(bounds[3]-bounds[1]))/Math.max(0.0001,states.reduce((sum,map)=>sum+(map.bounds[2]-map.bounds[0])*(map.bounds[3]-map.bounds[1]),0))));
  const profileFactor=profile==='basic'?0.22:profile==='detailed'?0.52:1;
  const estimatedBytes=Math.max(2_000_000,Math.round(states.reduce((sum,map)=>sum+map.size,0)*areaFraction*profileFactor));
  return Object.freeze({
    farmUnitId:String(farmUnitId),
    farmName:farmName??null,
    profile,
    profileLabel:definition.label,
    minZoom:0,
    maxZoom:definition.maxZoom,
    bounds:Object.freeze([...bounds]),
    bbox,
    sourceDate,
    sourceBuild:build,
    extractSource:`https://build.protomaps.com/${build}.pmtiles`,
    sources:Object.freeze(sources),
    outputAsset:`farm-${safeId(farmUnitId)}-${profile}.pmtiles`,
    estimatedBytes,
    attribution:'Protomaps © OpenStreetMap contributors',
    requiresNetwork:true,
    localAfterInstall:true
  });
}

export const MAP_DOWNLOAD_PROFILES=PROFILES;
