import {completeFieldOperation} from './operations.js';
import {createCropExpense} from './finance.js';
import {createFieldNotebookEntry} from './field-notebook.js';

const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
const toMinor=value=>value==null||value===''?0:Math.round(Number(value)*100);
const minor=value=>{const n=Number(value??0);if(!Number.isFinite(n))throw new TypeError('Cost must be finite.');return Math.round(n);};
const positive=(value,label)=>{const n=Number(value);if(!Number.isFinite(n)||n<=0)throw new TypeError(`${label} must be positive.`);return n;};
const rows=records=>(records??[]).map(record=>record?.payload??record);
const requireRecord=(record,label)=>{if(!record)throw new Error(`${label} not found.`);return record;};
const expirySortValue=value=>{const parsed=value?Date.parse(value):Number.POSITIVE_INFINITY;return Number.isFinite(parsed)?parsed:Number.POSITIVE_INFINITY;};

export function parseInputUsageLine(line,inputRecords=[]){
  const raw=String(line??'').trim();if(!raw)throw new TypeError('Input usage line is required.');
  const [namePart,...amountParts]=raw.split('|').map(part=>part.trim());
  if(!namePart||!amountParts.length)throw new TypeError('Use "Insumo | 2 L/ha" or "Insumo | 100 L".');
  const amountText=amountParts.join('|').trim();
  const match=amountText.match(/^([0-9]+(?:[.,][0-9]+)?)\s*([^/\s]+)?\s*(\/\s*ha)?$/i);
  if(!match)throw new TypeError(`Invalid input usage: ${raw}`);
  const value=positive(Number(match[1].replace(',','.')),'Input usage');
  const found=rows(inputRecords).find(input=>fold(input.id)===fold(namePart)||fold(input.name)===fold(namePart));
  if(!found)throw new Error(`Input not found: ${namePart}`);
  return Object.freeze({inputId:found.id,sku:found.id,name:found.name,unit:match[2]??found.unit,...(match[3]?{dosePerHa:value}:{quantity:value})});
}

function buildStockContext(available,trace={}){
  const lots=(trace.lots??[]).filter(lot=>Number(lot.onHand)>0).map(lot=>({...lot,onHand:Number(lot.onHand)}));
  const tracked=lots.reduce((sum,lot)=>sum+lot.onHand,0);
  return {available:Number(available)||0,lots,untracked:Math.max(0,(Number(available)||0)-tracked)};
}

function allocateStock(context,quantity,{preferredLot=null,inputName='insumo'}={}){
  const needed=positive(quantity,'Input quantity');
  if(context.available<needed)throw new RangeError(`insufficient stock for ${inputName}: required ${needed}, available ${context.available}`);
  const allocations=[];
  let remaining=needed;
  if(preferredLot){
    const lot=context.lots.find(item=>String(item.lotNumber)===String(preferredLot));
    if(!lot||lot.onHand<remaining)throw new RangeError(`insufficient lot stock for ${inputName}: ${preferredLot}`);
    lot.onHand-=remaining;allocations.push(Object.freeze({lotNumber:String(preferredLot),quantity:remaining,expiresAt:lot.expiresAt??null}));remaining=0;
  }else{
    const ordered=[...context.lots].sort((a,b)=>expirySortValue(a.expiresAt)-expirySortValue(b.expiresAt)||String(a.lotNumber).localeCompare(String(b.lotNumber)));
    for(const lot of ordered){
      if(remaining<=0)break;
      const take=Math.min(remaining,lot.onHand);
      if(take<=0)continue;
      lot.onHand-=take;remaining-=take;allocations.push(Object.freeze({lotNumber:String(lot.lotNumber),quantity:take,expiresAt:lot.expiresAt??null}));
    }
    if(remaining>0){
      if(context.untracked<remaining)throw new RangeError(`insufficient traceable stock for ${inputName}`);
      context.untracked-=remaining;allocations.push(Object.freeze({lotNumber:null,quantity:remaining,expiresAt:null}));remaining=0;
    }
  }
  context.available-=needed;
  return Object.freeze(allocations);
}

export function createAgriculturalWorkflow({repos,inventory,finance}={}){
  if(!repos?.operations||!repos?.fieldNotebook||!inventory?.apply||!inventory?.trace||!finance?.save)throw new TypeError('Agricultural workflow dependencies are required.');
  return Object.freeze({
    async completeOperation(operationId,input={}){
      const current=requireRecord(await repos.operations.get(operationId),'Field operation');
      const operation=current.payload;
      if(operation.status!=='in-progress')throw new Error('Only in-progress operation can complete.');
      const [fieldRecord,seasonRecord,inputRecords]=await Promise.all([operation.fieldId?repos.fields.get(operation.fieldId):null,operation.seasonId?repos.seasons.get(operation.seasonId):null,repos.inputs.list()]);
      const field=fieldRecord?.payload??null;
      const season=seasonRecord?.payload??null;
      const actualAreaHa=input.actualAreaHa==null?(field?.areaHa??null):positive(input.actualAreaHa,'Actual area');
      const sourceUsages=input.inputUsages?.length?input.inputUsages:(operation.inputItems??[]);
      const structuredUsages=(sourceUsages??[]).map(item=>typeof item==='string'?parseInputUsageLine(item,inputRecords):({...item}));
      const normalizedUsages=[];
      const stockContexts=new Map();
      for(const item of structuredUsages){
        const inputId=String(item.inputId??item.sku??'').trim();if(!inputId)throw new TypeError('Input id is required.');
        const inputRecord=requireRecord(inputRecords.find(record=>String(record.payload?.id??record.id)===inputId),`Input ${inputId}`);
        const inputEntity=inputRecord.payload??inputRecord;
        const quantity=item.quantity!=null?positive(item.quantity,'Input quantity'):(item.dosePerHa!=null&&actualAreaHa!=null?positive(item.dosePerHa,'Input dose')*positive(actualAreaHa,'Actual area'):null);
        if(quantity==null)throw new TypeError(`Quantity or dose/ha is required for ${inputEntity.name}.`);
        if(!stockContexts.has(inputId)){
          const [available,trace]=await Promise.all([inventory.available(inputId),inventory.trace(inputId)]);
          stockContexts.set(inputId,buildStockContext(available,trace));
        }
        const allocations=allocateStock(stockContexts.get(inputId),quantity,{preferredLot:item.lotNumber??null,inputName:inputEntity.name});
        const unitCostMinor=item.unitCostMinor==null?minor(inputEntity.unitCostMinor??0):minor(item.unitCostMinor);
        normalizedUsages.push(Object.freeze({inputId,sku:inputId,name:inputEntity.name,quantity,unit:item.unit??inputEntity.unit,lotNumber:item.lotNumber??(allocations.length===1?allocations[0].lotNumber:null),allocations,dosePerHa:item.dosePerHa==null?null:Number(item.dosePerHa),unitCostMinor,costMinor:Math.round(quantity*unitCostMinor)}));
      }
      const inputCostMinor=normalizedUsages.reduce((sum,item)=>sum+item.costMinor,0);
      const laborCostMinor=input.laborCostMinor!=null?minor(input.laborCostMinor):toMinor(input.laborCost);
      const machineCostMinor=input.machineCostMinor!=null?minor(input.machineCostMinor):toMinor(input.machineCost);
      const otherCostMinor=input.otherCostMinor!=null?minor(input.otherCostMinor):toMinor(input.otherCost);
      const componentTotal=inputCostMinor+laborCostMinor+machineCostMinor+otherCostMinor;
      const manualTotal=input.actualCostMinor==null?null:minor(input.actualCostMinor);
      const totalCostMinor=manualTotal??componentTotal;
      const costBreakdown=Object.freeze({inputsMinor:inputCostMinor,laborMinor:laborCostMinor,machineMinor:machineCostMinor,otherMinor:otherCostMinor,manualAdjustmentMinor:manualTotal==null?0:manualTotal-componentTotal,totalMinor:totalCostMinor});
      const costPerHaMinor=actualAreaHa&&totalCostMinor?Math.round(totalCostMinor/actualAreaHa):(actualAreaHa?0:null);
      const completed=completeFieldOperation(operation,{...input,actualAreaHa,inputUsages:normalizedUsages,costBreakdown,actualCostMinor:totalCostMinor,costPerHaMinor});
      const operationRecord=await repos.operations.save(completed,{expectedVersion:current.version});
      const inventoryMovements=[];
      let movementIndex=0;
      for(const usage of normalizedUsages){
        for(const allocation of usage.allocations){
          movementIndex+=1;
          inventoryMovements.push(await inventory.apply({id:`operation:${operation.id}:input:${usage.inputId}:${movementIndex}`,sku:usage.inputId,kind:'out',quantity:allocation.quantity,lotNumber:allocation.lotNumber,reference:`operation:${operation.id}`,occurredAt:completed.completedAt,metadata:{operationId:operation.id,seasonId:operation.seasonId,fieldId:operation.fieldId,crop:season?.crop??null}}));
        }
      }
      let expense=null;
      if(totalCostMinor>0){
        expense=await finance.save(createCropExpense({id:`operation-cost:${operation.id}`,seasonId:operation.seasonId,fieldId:operation.fieldId,amountMinor:totalCostMinor,description:`${operation.typeName??operation.typeId??'Operação agrícola'} · ${field?.name??operation.fieldId}`,category:'field-operation',operationId:operation.id,costBreakdown,metadata:{crop:season?.crop??null,operationType:operation.typeName??operation.typeId??null}}),{expectedVersion:0});
      }
      const notebook=await repos.fieldNotebook.save(createFieldNotebookEntry({id:`operation:${operation.id}`,kind:'operation',seasonId:operation.seasonId,fieldId:operation.fieldId,operationId:operation.id,operationType:operation.typeName??operation.typeId,occurredAt:completed.completedAt,areaHa:actualAreaHa,inputUsages:normalizedUsages,costMinor:totalCostMinor,costPerHaMinor,machineName:operation.machineName,operatorName:operation.operatorName,notes:completed.notes,metadata:{costBreakdown,crop:season?.crop??null}}),{expectedVersion:0});
      return Object.freeze({record:operationRecord,effects:Object.freeze({inventoryMovements:Object.freeze(inventoryMovements),expense,notebook})});
    }
  });
}
