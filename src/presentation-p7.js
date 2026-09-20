import {createAgroLavouraPresentation as createP6Presentation} from './presentation-p6.js';
import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';
import {SATELLITE_PROVIDERS,searchSatelliteScenes,createSatelliteCacheEntry,calculateNdviGrid} from './satellite.js';

const MAX_PREVIEW_BYTES=8*1024*1024;
const rows=records=>(records??[]).map(record=>record?.payload??record).filter(Boolean);
const nav=Object.freeze({id:'satellite',label:'Satélite',icon:'satellite',group:'Monitoramento'});
const searchDefinition=Object.freeze({name:'searchScenes',label:'Buscar imagens',description:'Consulta catálogos oficiais de satélite para a área e período selecionados.',intent:'primary',confirm:null,requiresSelection:false,fields:Object.freeze([])});
const cacheDefinition=Object.freeze({name:'cacheScene',label:'Salvar offline',description:'Guarda localmente os metadados e o preview escolhido.',intent:'primary',confirm:null,requiresSelection:false,fields:Object.freeze([])});
const removeDefinition=Object.freeze({name:'removeCachedScene',label:'Remover do cache',description:'Remove somente o item de satélite salvo localmente.',intent:'danger',confirm:'Remover esta imagem do cache local?',requiresSelection:true,fields:Object.freeze([])});

function validateCacheEntry(entity){if(!entity?.scene)throw new TypeError('Satellite cache entry requires a scene.');return createSatelliteCacheEntry(entity);}
function safeScene(scene){return structuredClone(scene);}
function previewBytes(dataUrl){if(!dataUrl)return 0;const comma=String(dataUrl).indexOf(',');if(comma<0)return Infinity;const base64=String(dataUrl).slice(comma+1);return Math.ceil(base64.length*3/4);}

export function createAgroLavouraPresentation(options={}){
  const {satelliteFetch=globalThis.fetch}=options;
  const base=createP6Presentation(options);
  const satelliteCache=createEntityRepository(base.services.persistence,{collection:'crop.satellite-cache',validate:validateCacheEntry});
  const services=Object.freeze({...base.services,satelliteCache});
  const shell=Object.freeze({...base.shell,navigation:Object.freeze([...base.shell.navigation,nav])});
  const screen=Object.freeze({
    id:'satellite',title:'Satélite',kind:'satellite',
    actions:Object.freeze({
      searchScenes:input=>searchSatelliteScenes(input,{fetch:satelliteFetch}),
      cacheScene:async({scene,previewDataUrl=null,expectedVersion}={})=>{
        if(previewBytes(previewDataUrl)>MAX_PREVIEW_BYTES)throw new Error('Preview de satélite excede o limite local de 8 MiB.');
        const current=scene?.id&&scene?.provider?await satelliteCache.get(`${scene.provider}:${scene.id}`):null;
        const entry=createSatelliteCacheEntry({scene:safeScene(scene),previewDataUrl});
        return satelliteCache.save(entry,{expectedVersion:expectedVersion??current?.version??0});
      },
      saveNdvi:async({id,ndvi,expectedVersion}={})=>{
        const current=await satelliteCache.get(id);if(!current)throw new Error('Cena de satélite não está no cache local.');
        const normalized=calculateNdviGrid(ndvi);
        const entry=createSatelliteCacheEntry({scene:current.payload.scene,previewDataUrl:current.payload.previewDataUrl,ndvi:normalized,cachedAt:current.payload.cachedAt});
        return satelliteCache.save(entry,{expectedVersion:expectedVersion??current.version});
      },
      removeCachedScene:async({id,expectedVersion}={})=>{const current=await satelliteCache.get(id);if(!current)return null;return satelliteCache.remove(id,{expectedVersion:expectedVersion??current.version});}
    }),
    actionDefinitions:Object.freeze({searchScenes:searchDefinition,cacheScene:cacheDefinition,removeCachedScene:removeDefinition}),
    async load(){
      const[fieldRecords,geometryRecords,cacheRecords,mapData]=await Promise.all([base.services.repos.fields.list(),base.services.repos.fieldGeometries.list(),satelliteCache.list(),base.load('fields',{})]);
      return Object.freeze({fields:Object.freeze(rows(fieldRecords)),geometries:Object.freeze(rows(geometryRecords)),cached:Object.freeze(rows(cacheRecords)),map:mapData?.map??null,providers:SATELLITE_PROVIDERS,modes:Object.freeze(['vector','imagery','ndvi']),onlineOptional:true,credentialsStored:false,maxPreviewBytes:MAX_PREVIEW_BYTES});
    }
  });
  const resolve=id=>String(id)==='satellite'?screen:base.screen(id);
  return Object.freeze({...base,shell,services,screenIds:()=>Object.freeze([...base.screenIds(),'satellite']),screen:resolve,async load(id,context){return String(id)==='satellite'?screen.load(context):base.load(id,context);},async action(id,action,input,context){if(String(id)==='satellite'){const handler=screen.actions[String(action)];if(typeof handler!=='function')throw new Error(`Unknown action ${String(action)} on screen satellite.`);return handler(input,context);}return base.action(id,action,input,context);}});
}

export {SATELLITE_PROVIDERS,calculateNdviGrid};
