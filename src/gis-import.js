const ALLOWED_GEOMETRIES=new Set(['Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon']);
const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const optional=value=>typeof value==='string'&&value.trim()?value.trim():null;
const idFor=(prefix,value)=>optional(value)??(globalThis.crypto?.randomUUID?.()??`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const clone=value=>structuredClone(value);

function validatePosition(position,path='coordinate'){
  if(!Array.isArray(position)||position.length<2)throw new TypeError(`${path} must contain longitude and latitude.`);
  const longitude=Number(position[0]),latitude=Number(position[1]);
  if(!Number.isFinite(longitude)||longitude<-180||longitude>180)throw new TypeError(`${path} longitude is outside WGS84.`);
  if(!Number.isFinite(latitude)||latitude<-90||latitude>90)throw new TypeError(`${path} latitude is outside WGS84.`);
  const altitude=position.slice(2).map(Number);
  if(altitude.some(value=>!Number.isFinite(value)))throw new TypeError(`${path} contains an invalid extra coordinate.`);
  return Object.freeze(position.length>2?[longitude,latitude,...altitude]:[longitude,latitude]);
}
function mapCoordinates(value,depth,path){if(depth===0)return validatePosition(value,path);if(!Array.isArray(value)||value.length===0)throw new TypeError(`${path} coordinates are empty or invalid.`);return Object.freeze(value.map((item,index)=>mapCoordinates(item,depth-1,`${path}[${index}]`)));}
function coordinateDepth(type){switch(type){case'Point':return 0;case'MultiPoint':case'LineString':return 1;case'MultiLineString':case'Polygon':return 2;case'MultiPolygon':return 3;default:return null;}}
function samePosition(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length>=2&&b.length>=2&&a[0]===b[0]&&a[1]===b[1];}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const between=(value,a,b)=>value>=Math.min(a,b)-1e-12&&value<=Math.max(a,b)+1e-12;
const onSegment=(a,b,p)=>Math.abs(cross(a,b,p))<=1e-12&&between(p[0],a[0],b[0])&&between(p[1],a[1],b[1]);
function segmentsIntersect(a,b,c,d){
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  if(((abC>0&&abD<0)||(abC<0&&abD>0))&&((cdA>0&&cdB<0)||(cdA<0&&cdB>0)))return true;
  return onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
const ringArea=ring=>Math.abs(ring.slice(0,-1).reduce((sum,point,index)=>{const next=ring[index+1];return sum+point[0]*next[1]-next[0]*point[1];},0))/2;

export function validatePolygonRingTopology(ring,path='ring'){
  if(!Array.isArray(ring)||ring.length<4)throw new TypeError(`${path} Polygon ring requires at least four positions.`);
  if(!samePosition(ring[0],ring.at(-1)))throw new TypeError(`${path} Polygon ring must be closed.`);
  const unique=new Set(ring.slice(0,-1).map(point=>`${point[0]},${point[1]}`));
  if(unique.size<3||ringArea(ring)<=1e-14)throw new TypeError(`${path} Polygon ring is degenerate.`);
  const segmentCount=ring.length-1;
  for(let first=0;first<segmentCount;first+=1){
    for(let second=first+1;second<segmentCount;second+=1){
      const adjacent=second===first+1||(first===0&&second===segmentCount-1);
      if(adjacent)continue;
      if(segmentsIntersect(ring[first],ring[first+1],ring[second],ring[second+1]))throw new TypeError(`${path} Polygon ring is self-intersecting.`);
    }
  }
  return ring;
}

function validateRing(ring,path){validatePolygonRingTopology(ring,path);}
function validatePolygonStructure(type,coordinates,path){const polygons=type==='Polygon'?[coordinates]:coordinates;for(const[polygonIndex,polygon]of polygons.entries()){if(!Array.isArray(polygon)||polygon.length===0)throw new TypeError(`${path} Polygon is empty.`);for(const[ringIndex,ring]of polygon.entries())validateRing(ring,`${path}[${polygonIndex}][${ringIndex}]`);}}

export function normalizeGisGeometry(geometry,path='geometry'){
  if(!geometry||typeof geometry!=='object')throw new TypeError(`${path} is required.`);
  const type=String(geometry.type??'');
  if(!ALLOWED_GEOMETRIES.has(type))throw new TypeError(`${path} type ${type||'(empty)'} is unsupported.`);
  const coordinates=mapCoordinates(geometry.coordinates,coordinateDepth(type),`${path}.coordinates`);
  if(type==='Polygon'||type==='MultiPolygon')validatePolygonStructure(type,coordinates,`${path}.coordinates`);
  return Object.freeze({type,coordinates});
}

export function normalizeGisFeatureCollection(input={}){
  if(input?.type!=='FeatureCollection'||!Array.isArray(input.features))throw new TypeError('GIS input must be a GeoJSON FeatureCollection.');
  if(input.features.length===0)throw new TypeError('GIS FeatureCollection cannot be empty.');
  const geometryTypes={};
  const features=input.features.map((feature,index)=>{
    if(feature?.type!=='Feature')throw new TypeError(`Feature ${index+1} is invalid.`);
    const geometry=normalizeGisGeometry(feature.geometry,`features[${index}].geometry`);
    geometryTypes[geometry.type]=(geometryTypes[geometry.type]??0)+1;
    return Object.freeze({type:'Feature',...(feature.id==null?{}:{id:String(feature.id)}),properties:Object.freeze({...((feature.properties&&typeof feature.properties==='object')?clone(feature.properties):{})}),geometry});
  });
  return Object.freeze({type:'FeatureCollection',features:Object.freeze(features),summary:Object.freeze({featureCount:features.length,geometryTypes:Object.freeze(geometryTypes)})});
}

export function createGisLayer(input={}){
  const featureCollection=normalizeGisFeatureCollection(input.featureCollection);
  const importedAt=new Date(input.importedAt??Date.now());
  if(Number.isNaN(importedAt.getTime()))throw new TypeError('GIS importedAt is invalid.');
  return Object.freeze({id:idFor('gis-layer',input.id),name:text(input.name,'GIS layer name'),format:text(input.format,'GIS source format').toLowerCase(),sourceFile:optional(input.sourceFile),featureCollection,summary:featureCollection.summary,warnings:Object.freeze(Array.isArray(input.warnings)?input.warnings.map(String):[]),importedAt:importedAt.toISOString(),metadata:Object.freeze({...((input.metadata&&typeof input.metadata==='object')?clone(input.metadata):{})})});
}

export function geometryForField(feature,{fieldId,sourceLayerId=null,featureIndex=null,updatedAt=null}={}){
  if(feature?.type!=='Feature')throw new TypeError('A GeoJSON Feature is required.');
  const geometry=normalizeGisGeometry(feature.geometry,'field boundary');
  if(!['Polygon','MultiPolygon'].includes(geometry.type))throw new TypeError('Field boundary must be a Polygon or MultiPolygon.');
  const date=new Date(updatedAt??Date.now());
  if(Number.isNaN(date.getTime()))throw new TypeError('Field geometry updatedAt is invalid.');
  const id=text(fieldId,'Field id');
  return Object.freeze({id,fieldId:id,type:geometry.type,coordinates:geometry.coordinates,geometry,sourceLayerId:optional(sourceLayerId),sourceFeatureIndex:featureIndex==null?null:Number(featureIndex),updatedAt:date.toISOString()});
}
export const GIS_GEOMETRY_TYPES=Object.freeze([...ALLOWED_GEOMETRIES]);