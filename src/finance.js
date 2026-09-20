import { createFinancialEntry, summarizeFinancialEntries, financialEntryFingerprint } from '../shared/packages/domain-finance/src/index.js';
const withFingerprint=entry=>Object.freeze({...entry,metadata:Object.freeze({...entry.metadata,fingerprint:financialEntryFingerprint(entry)})});
const add=(target,key,value)=>{const amount=Number(value)||0;if(amount===0)return;target[String(key??'unallocated')]=(target[String(key??'unallocated')]??0)+amount;};
export function createCropExpense({id,seasonId,fieldId,amountMinor,description,category,operationId=null,costBreakdown=null,metadata={}}={}){return withFingerprint(createFinancialEntry({id,direction:'expense',amountMinor,description,allocation:{kind:'crop-field',id:fieldId},metadata:{...metadata,seasonId,category,operationId,costBreakdown}}));}
export function createHarvestIncome({id,seasonId,fieldId,amountMinor,description='Harvest sale',partyId=null,metadata={}}={}){return withFingerprint(createFinancialEntry({id,direction:'income',amountMinor,description,partyId,allocation:{kind:'crop-field',id:fieldId},metadata:{...metadata,seasonId}}));}
export function cropFinancialMetrics(entries,{seasonId,fieldId,areaHa=0}={}){const scoped=entries.filter(e=>(!fieldId||e.allocation?.id===fieldId)&&(!seasonId||e.metadata?.seasonId===seasonId)),summary=summarizeFinancialEntries(scoped);return Object.freeze({...summary,costPerHaMinor:areaHa>0?summary.expenseMinor/areaHa:null});}
export function agriculturalCostSummary(entries=[],{fields=[],seasons=[]}={}){
  const fieldArea=new Map(fields.map(field=>[String(field.id),Number(field.areaHa)||0]));
  const seasonCrop=new Map(seasons.map(season=>[String(season.id),season.crop??null]));
  const expenses=entries.filter(entry=>entry?.direction==='expense');
  const totalMinor=expenses.reduce((sum,entry)=>sum+(Number(entry.amountMinor)||0),0);
  const byField={},bySeason={},byCrop={},byCategory={},byOperation={};
  for(const entry of expenses){
    const amount=Number(entry.amountMinor)||0;
    const fieldId=entry.allocation?.id??'unallocated';
    const seasonId=entry.metadata?.seasonId??'unallocated';
    const crop=entry.metadata?.crop??seasonCrop.get(String(seasonId))??'unallocated';
    add(byField,fieldId,amount);add(bySeason,seasonId,amount);add(byCrop,crop,amount);
    const operationId=entry.metadata?.operationId;
    if(operationId)add(byOperation,operationId,amount);
    const breakdown=entry.metadata?.costBreakdown;
    if(breakdown){
      add(byCategory,'inputs',breakdown.inputsMinor);
      add(byCategory,'labor',breakdown.laborMinor);
      add(byCategory,'machine',breakdown.machineMinor);
      add(byCategory,'other',breakdown.otherMinor);
      add(byCategory,'manual-adjustment',breakdown.manualAdjustmentMinor);
    }else add(byCategory,entry.metadata?.category??'uncategorized',amount);
  }
  const fieldMetrics=Object.fromEntries(Object.entries(byField).map(([fieldId,amountMinor])=>{const areaHa=fieldArea.get(fieldId)??0;return[fieldId,Object.freeze({amountMinor,areaHa,costPerHaMinor:areaHa>0?Math.round(amountMinor/areaHa):null})];}));
  return Object.freeze({totalMinor,byField:Object.freeze(fieldMetrics),bySeason:Object.freeze(bySeason),byCrop:Object.freeze(byCrop),byCategory:Object.freeze(byCategory),byOperation:Object.freeze(byOperation)});
}
