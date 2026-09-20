import {completeFieldOperation} from './operations.js';
import {createCropExpense} from './finance.js';
import {createFieldNotebookEntry} from './field-notebook.js';

const fold=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('pt-BR');
const toMinor=value=>value==null||value===''?0:Math.round(Number(value)*100);
const minor=value=>{const n=Number(value??0);if(!Number.isFinite(n))throw new TypeError('Cost must be finite.');return Math.round(n);};
const positive=(value,label)=>{const n=Number(value);if(!Number.isFinite(n)||n<=0)throw new TypeError(`${label} must be positive.`);return n;};
const rows=records=>(records??[]).map(record=>record?.payload??record);
const requireRecord=(record,label)=>{if(!record)throw new Error(`${label} not found.`);return record;};

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

export function createAgriculturalWorkflow({repos,inventory,finance}={}){
  if(!repos?.operations||!repos?.fieldNotebook||!inventory?.apply||!finance?.save)throw new TypeError('Agricultural workflow dependencies are required.');
  return Object.freeze({
    async completeOperation(operationId,input={}){
      const current=requireRecord(await repos.operations.get(operationId),'Field operation');
      const operation=current.payload;
      if(operation.status!=='in-progress')throw new Error('Only in-progress operation can complete.');
      const [fieldRecord,inputRecords]=await Promise.all([operation.fieldId?repos.fields.get(operation.fieldId):null,repos.inputs.list()]);
      const field=fieldRecord?.payload??null;
      const actualAreaHa=input.actualAreaHa==null?(field?.areaHa??null):positive(input.actualAreaHa,'Actual area');
      const sourceUsages=input.inputUsages?.length?input.inputUsages:(operation.inputItems??[]);
      const structuredUsages=(sourceUsages??[]).map(item=>typeof item==='string'?parseInputUsageLine(item,inputRecords):({...item}));
      const normalizedUsages=[];
      for(const item of structuredUsages){
        const inputId=String(item.inputId??item.sku??'').trim();if(!inputId)throw new TypeError('Input id is required.');
        const inputRecord=requireRecord(inputRecords.find(record=>String(record.payload?.id??record.id)===inputId),`Input ${inputId}`);
        const inputEntity=inputRecord.payload??inputRecord;
        const quantity=item.quantity!=null?positive(item.quantity,'Input quantity'):(item.dosePerHa!=null&&actualAreaHa!=null?positive(item.dosePerHa,'Input dose')*positive(actualAreaHa,'Actual area'):null);
        if(quantity==null)throw new TypeError(`Quantity or dose/ha is required for ${inputEntity.name}.`);
        const available=await inventory.available(inputId);
        if(available<quantity)throw new RangeError(`insufficient stock for ${inputEntity.name}: required ${quantity}, available ${available}`);
        const unitCostMinor=item.unitCostMinor==null?minor(inputEntity.unitCostMinor??0):minor(item.unitCostMinor);
        normalizedUsages.push(Object.freeze({inputId,sku:inputId,name:inputEntity.name,quantity,unit:item.unit??inputEntity.unit,lotNumber:item.lotNumber??null,dosePerHa:item.dosePerHa==null?null:Number(item.dosePerHa),unitCostMinor,costMinor:Math.round(quantity*unitCostMinor)}));
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
      for(const usage of normalizedUsages){
        inventoryMovements.push(await inventory.apply({id:`operation:${operation.id}:input:${usage.inputId}`,sku:usage.inputId,kind:'out',quantity:usage.quantity,lotNumber:usage.lotNumber,reference:`operation:${operation.id}`,occurredAt:completed.completedAt,metadata:{operationId:operation.id,seasonId:operation.seasonId,fieldId:operation.fieldId}}));
      }
      let expense=null;
      if(totalCostMinor>0){
        expense=await finance.save(createCropExpense({id:`operation-cost:${operation.id}`,seasonId:operation.seasonId,fieldId:operation.fieldId,amountMinor:totalCostMinor,description:`${operation.typeName??operation.typeId??'Operação agrícola'} · ${field?.name??operation.fieldId}`,category:'field-operation',operationId:operation.id,costBreakdown}),{expectedVersion:0});
      }
      const notebook=await repos.fieldNotebook.save(createFieldNotebookEntry({id:`operation:${operation.id}`,kind:'operation',seasonId:operation.seasonId,fieldId:operation.fieldId,operationId:operation.id,operationType:operation.typeName??operation.typeId,occurredAt:completed.completedAt,areaHa:actualAreaHa,inputUsages:normalizedUsages,costMinor:totalCostMinor,costPerHaMinor,machineName:operation.machineName,operatorName:operation.operatorName,notes:completed.notes,metadata:{costBreakdown}}),{expectedVersion:0});
      return Object.freeze({record:operationRecord,effects:Object.freeze({inventoryMovements:Object.freeze(inventoryMovements),expense,notebook})});
    }
  });
}
