import { createFinancialEntry, summarizeFinancialEntries, financialEntryFingerprint } from '../shared/packages/domain-finance/src/index.js';
const withFingerprint=entry=>Object.freeze({...entry,metadata:Object.freeze({...entry.metadata,fingerprint:financialEntryFingerprint(entry)})});
export function createCropExpense({id,seasonId,fieldId,amountMinor,description,category,operationId=null,costBreakdown=null,metadata={}}={}){return withFingerprint(createFinancialEntry({id,direction:'expense',amountMinor,description,allocation:{kind:'crop-field',id:fieldId},metadata:{...metadata,seasonId,category,operationId,costBreakdown}}));}
export function createHarvestIncome({id,seasonId,fieldId,amountMinor,description='Harvest sale',partyId=null,metadata={}}={}){return withFingerprint(createFinancialEntry({id,direction:'income',amountMinor,description,partyId,allocation:{kind:'crop-field',id:fieldId},metadata:{...metadata,seasonId}}));}
export function cropFinancialMetrics(entries,{seasonId,fieldId,areaHa=0}={}){const scoped=entries.filter(e=>(!fieldId||e.allocation?.id===fieldId)&&(!seasonId||e.metadata?.seasonId===seasonId)),summary=summarizeFinancialEntries(scoped);return Object.freeze({...summary,costPerHaMinor:areaHa>0?summary.expenseMinor/areaHa:null});}
export function agriculturalCostSummary(entries=[],{fields=[]}={}){
  const fieldArea=new Map(fields.map(field=>[String(field.id),Number(field.areaHa)||0]));
  const expenses=entries.filter(entry=>entry?.direction==='expense');
  const totalMinor=expenses.reduce((sum,entry)=>sum+(Number(entry.amountMinor)||0),0);
  const byField={},bySeason={},byCategory={};
  for(const entry of expenses){
    const amount=Number(entry.amountMinor)||0,fieldId=entry.allocation?.id??'unallocated',seasonId=entry.metadata?.seasonId??'unallocated',category=entry.metadata?.category??'uncategorized';
    byField[fieldId]=(byField[fieldId]??0)+amount;bySeason[seasonId]=(bySeason[seasonId]??0)+amount;byCategory[category]=(byCategory[category]??0)+amount;
  }
  const fieldMetrics=Object.fromEntries(Object.entries(byField).map(([fieldId,amountMinor])=>[fieldId,Object.freeze({amountMinor,areaHa:fieldArea.get(fieldId)??0,costPerHaMinor:(fieldArea.get(fieldId)??0)>0?Math.round(amountMinor/fieldArea.get(fieldId)):null})]));
  return Object.freeze({totalMinor,byField:Object.freeze(fieldMetrics),bySeason:Object.freeze(bySeason),byCategory:Object.freeze(byCategory)});
}
