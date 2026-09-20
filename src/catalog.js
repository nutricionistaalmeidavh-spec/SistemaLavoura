import {createEntityRepository} from '../shared/packages/vertical-persistence/src/repository.js';

const text=(value,label)=>{
  if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);
  return value.trim();
};
const optionalText=value=>typeof value==='string'&&value.trim()?value.trim():null;
const positive=(value,label)=>{
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new TypeError(`${label} must be positive.`);
  return value;
};
const optionalPositive=(value,label)=>value==null?null:positive(Number(value),label);
const idFor=(prefix,value)=>optionalText(value)??(globalThis.crypto?.randomUUID?.()??`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const isoOrNull=value=>value?new Date(value).toISOString():null;

export function createFarmUnit({id,name,code=null,metadata={}}={}){
  return Object.freeze({id:idFor('farm',id),name:text(name,'Farm name'),code:optionalText(code),metadata:Object.freeze({...metadata})});
}

export function createFarmArea({id,farmUnitId,name,code=null,metadata={}}={}){
  return Object.freeze({id:idFor('area',id),farmUnitId:text(farmUnitId,'Farm unit id'),name:text(name,'Farm area name'),code:optionalText(code),metadata:Object.freeze({...metadata})});
}

export function createField({id,code,name,farmUnitId,areaGroupId=null,areaHa,metadata={}}={}){
  return Object.freeze({id:idFor('field',id),code:text(code,'Field code'),name:text(name,'Field name'),farmUnitId:text(farmUnitId,'Farm unit id'),areaGroupId:optionalText(areaGroupId),areaHa:positive(Number(areaHa),'Field area'),metadata:Object.freeze({...metadata})});
}

export function createCropVariety({id,crop,name,cycleDays=null,metadata={}}={}){
  return Object.freeze({id:idFor('variety',id),crop:text(crop,'Crop'),name:text(name,'Variety name'),cycleDays:optionalPositive(cycleDays,'Cycle days'),metadata:Object.freeze({...metadata})});
}

export function createCropSeason({id,name=null,crop,productionPeriodId=null,periodName=null,fieldIds=[],varietyId=null,varietyName=null,cycleDays=null,plantingWindowStart=null,plantingWindowEnd=null,targetPopulation=null,expectedYieldPerHa=null,budgetMinor=null,metadata={}}={}){
  const period=text(productionPeriodId??periodName,'Production period');
  return Object.freeze({
    id:idFor('season',id),name:optionalText(name)??`${text(crop,'Crop')} ${period}`,crop:text(crop,'Crop'),productionPeriodId:period,periodName:optionalText(periodName)??period,
    fieldIds:Object.freeze([...new Set((fieldIds??[]).map(String))]),varietyId:optionalText(varietyId),varietyName:optionalText(varietyName),cycleDays:optionalPositive(cycleDays,'Cycle days'),
    plantingWindowStart:isoOrNull(plantingWindowStart),plantingWindowEnd:isoOrNull(plantingWindowEnd),targetPopulation:optionalPositive(targetPopulation,'Target population'),expectedYieldPerHa:optionalPositive(expectedYieldPerHa,'Expected yield'),
    budgetMinor:budgetMinor==null?null:Number(budgetMinor),metadata:Object.freeze({...metadata})
  });
}

export function createCropInput({id,name,unit,category,unitCostMinor=null,brand=null,activeIngredient=null,manufacturer=null,packageSize=null,metadata={}}={}){
  const cost=unitCostMinor==null?null:Number(unitCostMinor);
  if(cost!=null&&(!Number.isSafeInteger(cost)||cost<0))throw new TypeError('Input unit cost must be a non-negative integer in minor units.');
  return Object.freeze({id:idFor('input',id),name:text(name,'Input name'),unit:text(unit,'Input unit'),category:text(category,'Input category'),unitCostMinor:cost,brand:optionalText(brand),activeIngredient:optionalText(activeIngredient),manufacturer:optionalText(manufacturer),packageSize:packageSize==null?null:Number(packageSize),metadata:Object.freeze({...metadata})});
}

export function createFieldOperationType({id,name,requiresMachine=false,category=null}={}){
  return Object.freeze({id:idFor('operation-type',id),name:text(name,'Operation type name'),requiresMachine:Boolean(requiresMachine),category:optionalText(category)});
}

export function createCropRepositories(persistence){
  return Object.freeze({
    farmUnits:createEntityRepository(persistence,{collection:'crop.farm-units',validate:createFarmUnit}),
    farmAreas:createEntityRepository(persistence,{collection:'crop.farm-areas',validate:createFarmArea}),
    fields:createEntityRepository(persistence,{collection:'crop.fields',validate:createField}),
    varieties:createEntityRepository(persistence,{collection:'crop.varieties',validate:createCropVariety}),
    seasons:createEntityRepository(persistence,{collection:'crop.seasons',validate:createCropSeason}),
    inputs:createEntityRepository(persistence,{collection:'crop.inputs',validate:createCropInput}),
    operationTypes:createEntityRepository(persistence,{collection:'crop.operation-types',validate:createFieldOperationType}),
    operations:createEntityRepository(persistence,{collection:'crop.operations'}),
    harvestLots:createEntityRepository(persistence,{collection:'crop.harvest-lots'}),
    plans:createEntityRepository(persistence,{collection:'crop.plans'}),
    fieldNotebook:createEntityRepository(persistence,{collection:'crop.field-notebook'}),
    applications:createEntityRepository(persistence,{collection:'crop.applications'}),
    scouting:createEntityRepository(persistence,{collection:'crop.scouting'}),
    fieldGeometries:createEntityRepository(persistence,{collection:'crop.field-geometries'}),
    inventoryCounts:createEntityRepository(persistence,{collection:'crop.inventory-counts'}),
    inventoryTransfers:createEntityRepository(persistence,{collection:'crop.inventory-transfers'}),
    rainfall:createEntityRepository(persistence,{collection:'crop.rainfall'}),
    suppliers:createEntityRepository(persistence,{collection:'crop.suppliers'}),
    purchaseOrders:createEntityRepository(persistence,{collection:'crop.purchase-orders'}),
    storageLots:createEntityRepository(persistence,{collection:'crop.storage-lots'}),
    sales:createEntityRepository(persistence,{collection:'crop.sales'}),
    deliveries:createEntityRepository(persistence,{collection:'crop.deliveries'})
  });
}
