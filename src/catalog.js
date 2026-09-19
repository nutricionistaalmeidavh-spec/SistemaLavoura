import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';

const text=(value,label)=>{
  if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);
  return value.trim();
};

const positive=(value,label)=>{
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new TypeError(`${label} must be positive.`);
  return value;
};

export function createField({id,code,name,farmUnitId,areaHa,metadata={}}={}){
  return Object.freeze({id:text(id,'Field id'),code:text(code,'Field code'),name:text(name,'Field name'),farmUnitId:text(farmUnitId,'Farm unit id'),areaHa:positive(areaHa,'Field area'),metadata:Object.freeze({...metadata})});
}

export function createCropSeason({id,crop,productionPeriodId,fieldIds=[],metadata={}}={}){
  return Object.freeze({id:text(id,'Crop season id'),crop:text(crop,'Crop'),productionPeriodId:text(productionPeriodId,'Production period id'),fieldIds:Object.freeze([...new Set(fieldIds)]),metadata:Object.freeze({...metadata})});
}

export function createCropInput({id,name,unit,category,unitCostMinor=null}={}){
  return Object.freeze({id:text(id,'Input id'),name:text(name,'Input name'),unit:text(unit,'Input unit'),category:text(category,'Input category'),unitCostMinor});
}

export function createFieldOperationType({id,name,requiresMachine=false}={}){
  return Object.freeze({id:text(id,'Operation type id'),name:text(name,'Operation type name'),requiresMachine:Boolean(requiresMachine)});
}

export function createCropRepositories(persistence){
  return Object.freeze({
    fields:createEntityRepository(persistence,{collection:'crop.fields',validate:createField}),
    seasons:createEntityRepository(persistence,{collection:'crop.seasons',validate:createCropSeason}),
    inputs:createEntityRepository(persistence,{collection:'crop.inputs',validate:createCropInput}),
    operationTypes:createEntityRepository(persistence,{collection:'crop.operation-types',validate:createFieldOperationType}),
    operations:createEntityRepository(persistence,{collection:'crop.operations'}),
    harvestLots:createEntityRepository(persistence,{collection:'crop.harvest-lots'}),
    plans:createEntityRepository(persistence,{collection:'crop.plans'})
  });
}
