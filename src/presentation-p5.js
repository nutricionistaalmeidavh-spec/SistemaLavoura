import {createAgroLavouraPresentation as createP3Presentation} from './presentation-p3.js';
import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';
import {createFieldObservation,buildFieldModeSnapshot} from './field-mode.js';
import {farmBoundsFromGeometries,buildFarmMapDownloadPlan} from './map-package-planner.js';

const rows=records=>(records??[]).map(record=>record?.payload??record).filter(Boolean);
const fieldModeNav=Object.freeze({id:'field-mode',label:'Modo Campo',icon:'crosshair',group:'Produção'});
const offlineMapsNav=Object.freeze({id:'offline-maps',label:'Mapas offline',icon:'download',group:'Sistema'});
const observationDefinition=Object.freeze({name:'saveObservation',label:'Registrar observação',description:'Salva uma observação georreferenciada localmente para uso sem internet.',intent:'primary',confirm:null,requiresSelection:false,fields:Object.freeze([])});
const removeObservationDefinition=Object.freeze({name:'removeObservation',label:'Excluir observação',description:'Remove uma observação de campo local.',intent:'danger',confirm:'Excluir esta observação?',requiresSelection:true,fields:Object.freeze([])});
const installMapDefinition=Object.freeze({name:'installFarmMap',label:'Disponibilizar fazenda offline',description:'Recorta e instala somente a região mapeada da fazenda.',intent:'primary',confirm:null,requiresSelection:false,fields:Object.freeze([])});
const verifyMapDefinition=Object.freeze({name:'verifyFarmMap',label:'Verificar integridade',description:'Verifica o pacote PMTiles local sem alterar dados agrícolas.',intent:'secondary',confirm:null,requiresSelection:true,fields:Object.freeze([])});
const removeMapDefinition=Object.freeze({name:'removeFarmMap',label:'Remover mapa offline',description:'Remove um pacote local de mapa da fazenda.',intent:'danger',confirm:'Remover este mapa offline?',requiresSelection:true,fields:Object.freeze([])});

async function fieldModeData(base,observations){
  const repos=base.services.repos;
  const [fieldRecords,geometryRecords,operationRecords,scoutingRecords,rainRecords,observationRecords,fileRecords,mapData]=await Promise.all([
    repos.fields.list(),repos.fieldGeometries.list(),repos.operations.list(),repos.scouting.list(),repos.rainfall.list(),observations.list(),base.services.files.list({entityType:'field'}),base.load('fields',{})
  ]);
  return Object.freeze({
    ...buildFieldModeSnapshot({fields:rows(fieldRecords),geometries:rows(geometryRecords),operations:rows(operationRecords),scouting:rows(scoutingRecords),rainfall:rows(rainRecords),observations:rows(observationRecords),files:rows(fileRecords)}),
    map:mapData?.map??null,
    references:mapData?.references??{},
    mapPoints:mapData?.mapPoints??[]
  });
}

async function offlineMapsData(base,mapPackages){
  const repos=base.services.repos;
  const [farmRecords,fieldRecords,geometryRecords,provider]=await Promise.all([
    repos.farmUnits.list(),repos.fields.list(),repos.fieldGeometries.list(),mapPackages?.snapshot?.()??Promise.resolve({available:false,reason:'desktop-required',installed:[],profiles:[{id:'basic',label:'Básico',maxZoom:10},{id:'detailed',label:'Detalhado',maxZoom:12},{id:'maximum',label:'Máximo',maxZoom:14}]})
  ]);
  const farms=rows(farmRecords),fields=rows(fieldRecords),geometries=rows(geometryRecords);
  const farmRows=farms.map(farm=>{
    try{return Object.freeze({id:String(farm.id),name:farm.name??String(farm.id),bounds:Object.freeze(farmBoundsFromGeometries({farmUnitId:farm.id,fields,geometries})),mapped:true,fieldCount:fields.filter(field=>String(field.farmUnitId)===String(farm.id)).length});}
    catch{return Object.freeze({id:String(farm.id),name:farm.name??String(farm.id),bounds:null,mapped:false,fieldCount:fields.filter(field=>String(field.farmUnitId)===String(farm.id)).length});}
  });
  return Object.freeze({farms:Object.freeze(farmRows),provider:Object.freeze({...provider}),attribution:'Protomaps © OpenStreetMap contributors'});
}

export function createAgroLavouraPresentation(options={}){
  const {mapPackages=null}=options;
  const base=createP3Presentation(options);
  const observations=createEntityRepository(base.services.persistence,{collection:'crop.field-observations',validate:createFieldObservation});
  const services=Object.freeze({...base.services,observations,mapPackages});
  const shell=Object.freeze({...base.shell,navigation:Object.freeze([...base.shell.navigation,fieldModeNav,offlineMapsNav])});

  const fieldModeScreen=Object.freeze({
    id:'field-mode',title:'Modo Campo',kind:'field-mode',
    actions:Object.freeze({
      saveObservation:(input={})=>observations.save(createFieldObservation(input),{expectedVersion:input.expectedVersion??0}),
      removeObservation:({id,expectedVersion}={})=>observations.remove(id,{expectedVersion}),
      markObservationSynced:async({id,syncedAt=new Date().toISOString()}={})=>{const current=await observations.get(id);if(!current)throw new Error('Field observation not found.');return observations.save({...current.payload,syncState:'synced',syncedAt},{expectedVersion:current.version});},
      startOperation:(input={},context={})=>base.action('operations','start',input,context),
      addScouting:(input={},context={})=>base.action('operations','addScouting',input,context),
      saveMapPoint:(input={},context={})=>base.action('fields','saveMapPoint',input,context),
      uploadPhoto:(input={},context={})=>base.action('fields','uploadFile',{...input,entityId:input.fieldId},context)
    }),
    actionDefinitions:Object.freeze({saveObservation:observationDefinition,removeObservation:removeObservationDefinition}),
    load:()=>fieldModeData(base,observations)
  });

  const offlineMapsScreen=Object.freeze({
    id:'offline-maps',title:'Mapas offline',kind:'offline-maps',
    actions:Object.freeze({
      refreshCatalog:()=>{if(typeof mapPackages?.refreshCatalog!=='function')throw new Error('Atualização do catálogo de mapas requer o aplicativo desktop.');return mapPackages.refreshCatalog();},
      installFarmMap:async(input={})=>{
        if(typeof mapPackages?.installFarmMap!=='function')throw new Error('Download inteligente de mapas requer o aplicativo desktop Windows.');
        const [fieldRecords,geometryRecords,snapshot]=await Promise.all([base.services.repos.fields.list(),base.services.repos.fieldGeometries.list(),mapPackages.snapshot()]);
        const fields=rows(fieldRecords),geometries=rows(geometryRecords),bounds=farmBoundsFromGeometries({farmUnitId:input.farmUnitId,fields,geometries});
        let plan=null;
        if(snapshot?.catalog){
          try{plan=buildFarmMapDownloadPlan({farmUnitId:input.farmUnitId,farmName:input.farmName,fields,geometries,manifest:snapshot.catalog,profile:input.profile??'detailed'});}catch{plan=null;}
        }
        return mapPackages.installFarmMap({...input,bounds,profile:input.profile??'detailed',estimatedBytes:plan?.estimatedBytes,extractSource:plan?.extractSource,sourceDate:plan?.sourceDate});
      },
      verifyFarmMap:input=>{if(typeof mapPackages?.verifyFarmMap!=='function')throw new Error('Verificação de mapas requer o aplicativo desktop.');return mapPackages.verifyFarmMap(input);},
      removeFarmMap:input=>{if(typeof mapPackages?.removeFarmMap!=='function')throw new Error('Gerenciamento de mapas requer o aplicativo desktop.');return mapPackages.removeFarmMap(input);}
    }),
    actionDefinitions:Object.freeze({installFarmMap:installMapDefinition,verifyFarmMap:verifyMapDefinition,removeFarmMap:removeMapDefinition}),
    load:()=>offlineMapsData(base,mapPackages)
  });

  const extraScreens=new Map([['field-mode',fieldModeScreen],['offline-maps',offlineMapsScreen]]);
  const screen=id=>extraScreens.get(String(id))??base.screen(id);
  return Object.freeze({
    ...base,shell,services,
    screenIds:()=>Object.freeze([...base.screenIds(),'field-mode','offline-maps']),
    screen,
    async load(id,context){const extra=extraScreens.get(String(id));return extra?extra.load(context):base.load(id,context);},
    async action(id,action,input,context){const extra=extraScreens.get(String(id));if(extra){const handler=extra.actions[String(action)];if(typeof handler!=='function')throw new Error(`Unknown action ${String(action)} on screen ${String(id)}.`);return handler(input,context);}return base.action(id,action,input,context);}
  });
}

export {createFieldObservation,buildFieldModeSnapshot,farmBoundsFromGeometries,buildFarmMapDownloadPlan};
