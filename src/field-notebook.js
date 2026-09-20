const text=(value,label)=>{if(typeof value!=='string'||!value.trim())throw new TypeError(`${label} is required.`);return value.trim();};
const optional=value=>typeof value==='string'&&value.trim()?value.trim():null;
const idFor=(prefix,value)=>optional(value)??(globalThis.crypto?.randomUUID?.()??`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function createFieldNotebookEntry({id,kind='operation',seasonId,fieldId,operationId=null,operationType=null,occurredAt=new Date().toISOString(),areaHa=null,inputUsages=[],costMinor=null,costPerHaMinor=null,machineName=null,operatorName=null,notes=null,metadata={}}={}){
  return Object.freeze({
    id:idFor('notebook',id),kind:text(kind,'Notebook entry kind'),seasonId:text(seasonId,'Season id'),fieldId:text(fieldId,'Field id'),operationId:optional(operationId),operationType:optional(operationType),occurredAt:new Date(occurredAt).toISOString(),
    areaHa:areaHa==null?null:Number(areaHa),inputUsages:Object.freeze((inputUsages??[]).map(item=>Object.freeze({...item}))),costMinor:costMinor==null?null:Number(costMinor),costPerHaMinor:costPerHaMinor==null?null:Number(costPerHaMinor),
    machineName:optional(machineName),operatorName:optional(operatorName),notes:optional(notes),metadata:Object.freeze({...metadata})
  });
}

export function summarizeFieldNotebook(entries=[]){
  const byKind={},byField={};
  for(const entry of entries){byKind[entry.kind]=(byKind[entry.kind]??0)+1;byField[entry.fieldId]=(byField[entry.fieldId]??0)+1;}
  return Object.freeze({entries:entries.length,byKind:Object.freeze(byKind),byField:Object.freeze(byField)});
}
