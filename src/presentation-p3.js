import {createAgroLavouraPresentation as createBasePresentation} from './presentation.js';
import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';
import {buildAgriculturalMapSnapshot,createAgriculturalMapPoint} from './agricultural-map.js';

const rows=records=>(records??[]).map(record=>record?.payload??record).filter(Boolean);
const MAP_POINT_DEFINITION=Object.freeze({name:'saveMapPoint',label:'Adicionar ponto no mapa',description:'Registra uma coordenada agrícola local para sensores, máquinas, armazéns/silos ou amostragem.',intent:'primary',confirm:null,requiresSelection:false,fields:Object.freeze([
  Object.freeze({name:'kind',label:'Tipo',type:'select',required:true,options:Object.freeze([{value:'sensor',label:'Sensor / pluviômetro'},{value:'machine',label:'Máquina'},{value:'storage',label:'Armazém / silo'},{value:'sampling',label:'Ponto de amostragem'}])}),
  Object.freeze({name:'name',label:'Nome',type:'text',required:true}),
  Object.freeze({name:'latitude',label:'Latitude',type:'number',required:true}),
  Object.freeze({name:'longitude',label:'Longitude',type:'number',required:true}),
  Object.freeze({name:'fieldId',label:'Talhão',type:'select',required:false,optionsRef:'fieldOptions'}),
  Object.freeze({name:'notes',label:'Observações',type:'textarea',required:false})
])});
const REMOVE_POINT_DEFINITION=Object.freeze({name:'removeMapPoint',label:'Excluir ponto do mapa',description:'Remove logicamente um ponto agrícola cadastrado.',intent:'danger',confirm:'Confirmar exclusão do ponto do mapa?',requiresSelection:true,fields:Object.freeze([Object.freeze({name:'id',label:'ID',type:'text',required:true}),Object.freeze({name:'expectedVersion',label:'Versão esperada',type:'number',required:false})])});

async function agriculturalMapData(base,mapPoints){
  const repos=base.services.repos;
  const [fieldRecords,geometryRecords,seasonRecords,operationRecords,applicationRecords,scoutingRecords,rainRecords,fileRecords,pointRecords]=await Promise.all([
    repos.fields.list(),repos.fieldGeometries.list(),repos.seasons.list(),repos.operations.list(),repos.applications.list(),repos.scouting.list(),repos.rainfall.list(),base.services.files.list({entityType:'field'}),mapPoints.list()
  ]);
  return buildAgriculturalMapSnapshot({fields:rows(fieldRecords),geometries:rows(geometryRecords),seasons:rows(seasonRecords),operations:rows(operationRecords),applications:rows(applicationRecords),scouting:rows(scoutingRecords),rainfall:rows(rainRecords),files:rows(fileRecords),mapPoints:rows(pointRecords)});
}

export function createAgroLavouraPresentation(options={}){
  const base=createBasePresentation(options);
  const mapPoints=createEntityRepository(base.services.persistence,{collection:'crop.map-points',validate:createAgriculturalMapPoint});
  const baseFields=base.screen('fields');
  const fieldsScreen=Object.freeze({...baseFields,actions:Object.freeze({...baseFields.actions,saveMapPoint:(input={})=>mapPoints.save(input,{expectedVersion:input.expectedVersion??0}),removeMapPoint:({id,expectedVersion}={})=>mapPoints.remove(id,{expectedVersion})}),actionDefinitions:Object.freeze({...baseFields.actionDefinitions,saveMapPoint:MAP_POINT_DEFINITION,removeMapPoint:REMOVE_POINT_DEFINITION})});
  const services=Object.freeze({...base.services,mapPoints});
  const screen=id=>String(id)==='fields'?fieldsScreen:base.screen(id);
  return Object.freeze({...base,services,screen,async load(id,context){const data=await base.load(id,context);if(String(id)!=='fields')return data;return Object.freeze({...data,map:await agriculturalMapData(base,mapPoints),mapPoints:await mapPoints.list()});},async action(id,action,input,context){if(String(id)==='fields'&&action==='saveMapPoint')return fieldsScreen.actions.saveMapPoint(input,context);if(String(id)==='fields'&&action==='removeMapPoint')return fieldsScreen.actions.removeMapPoint(input,context);return base.action(id,action,input,context);}});
}

export {buildAgriculturalMapSnapshot,createAgriculturalMapPoint};
