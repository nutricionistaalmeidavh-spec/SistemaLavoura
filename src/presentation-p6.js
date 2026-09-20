import {createAgroLavouraPresentation as createP5Presentation} from './presentation-p5.js';
import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';
import {createGisLayer,geometryForField} from './gis-import.js';

const rows=records=>(records??[]).map(record=>record?.payload??record).filter(Boolean);
const nav=Object.freeze({id:'gis-import',label:'Importação GIS',icon:'map-import',group:'Produção'});
const saveDefinition=Object.freeze({name:'saveLayer',label:'Salvar camada',description:'Salva localmente a camada GIS analisada.',intent:'primary',confirm:null,requiresSelection:false,fields:Object.freeze([])});
const removeDefinition=Object.freeze({name:'removeLayer',label:'Excluir camada',description:'Remove a camada importada sem alterar limites já aplicados aos talhões.',intent:'danger',confirm:'Remover esta camada GIS?',requiresSelection:true,fields:Object.freeze([])});
const applyDefinition=Object.freeze({name:'applyFieldGeometry',label:'Aplicar ao talhão',description:'Usa uma feição poligonal como limite do talhão selecionado.',intent:'primary',confirm:'Substituir o limite atual deste talhão?',requiresSelection:false,fields:Object.freeze([])});

export function createAgroLavouraPresentation(options={}){
  const base=createP5Presentation(options);
  const gisLayers=createEntityRepository(base.services.persistence,{collection:'crop.gis-layers',validate:createGisLayer});
  const services=Object.freeze({...base.services,gisLayers});
  const shell=Object.freeze({...base.shell,navigation:Object.freeze([...base.shell.navigation,nav])});
  const screen=Object.freeze({
    id:'gis-import',title:'Importação GIS',kind:'gis-import',
    actions:Object.freeze({
      saveLayer:async({layer,expectedVersion=0}={})=>gisLayers.save(layer,{expectedVersion}),
      removeLayer:async({id,expectedVersion}={})=>gisLayers.remove(id,{expectedVersion}),
      applyFieldGeometry:async({layerId,featureIndex,fieldId,expectedVersion}={})=>{
        const layerRecord=await gisLayers.get(layerId);if(!layerRecord)throw new Error('Camada GIS não encontrada.');
        const index=Number(featureIndex);if(!Number.isInteger(index)||index<0)throw new TypeError('Selecione uma feição GIS válida.');
        const feature=layerRecord.payload?.featureCollection?.features?.[index];if(!feature)throw new RangeError('Feição GIS não encontrada.');
        const current=await base.services.repos.fieldGeometries.get(fieldId);
        const entity=geometryForField(feature,{fieldId,sourceLayerId:layerId,featureIndex:index});
        return base.services.repos.fieldGeometries.save(entity,{expectedVersion:expectedVersion??current?.version??0});
      }
    }),
    actionDefinitions:Object.freeze({saveLayer:saveDefinition,removeLayer:removeDefinition,applyFieldGeometry:applyDefinition}),
    async load(){const[layerRecords,fieldRecords]=await Promise.all([gisLayers.list(),base.services.repos.fields.list()]);return Object.freeze({layers:Object.freeze(rows(layerRecords)),fields:Object.freeze(rows(fieldRecords))});}
  });
  const resolve=id=>String(id)==='gis-import'?screen:base.screen(id);
  return Object.freeze({...base,shell,services,screenIds:()=>Object.freeze([...base.screenIds(),'gis-import']),screen:resolve,async load(id,context){return String(id)==='gis-import'?screen.load(context):base.load(id,context);},async action(id,action,input,context){if(String(id)==='gis-import'){const handler=screen.actions[String(action)];if(typeof handler!=='function')throw new Error(`Unknown action ${String(action)} on screen gis-import.`);return handler(input,context);}return base.action(id,action,input,context);}});
}

export {createGisLayer,geometryForField};
