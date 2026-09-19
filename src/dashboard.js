import {cropYieldSummary} from './operations.js';
import {cropFinancialMetrics} from './finance.js';

const finite=value=>Number.isFinite(Number(value))?Number(value):0;
export async function buildDashboardSnapshot({fields=[],seasons=[],operations=[],harvestLots=[],entries=[],alerts=[],inventory={state:{}},lowStockThreshold=0,planning={plans:[],progress:0,conflicts:[]},now=new Date().toISOString()}={}){
  const fieldArea=fields.reduce((sum,item)=>sum+finite(item.areaHa),0);
  const operationCounts={planned:0,'in-progress':0,completed:0,cancelled:0};for(const operation of operations)if(operationCounts[operation.status]!==undefined)operationCounts[operation.status]+=1;
  const harvest=cropYieldSummary(harvestLots);
  const finance=cropFinancialMetrics(entries,{});
  const current=Date.parse(now);
  const activeAlerts=alerts.filter(alert=>alert.status!=='dismissed');
  const due=activeAlerts.filter(alert=>alert.status==='active'&&Date.parse(alert.snoozedUntil??alert.dueAt)<=current).length;
  const threshold=finite(lowStockThreshold);
  const lowStock=Object.values(inventory?.state??{}).filter(item=>finite(item.onHand)-finite(item.reserved)<threshold).length;
  return Object.freeze({
    fields:Object.freeze({count:fields.length,areaHa:fieldArea}),
    seasons:Object.freeze({count:seasons.length}),
    operations:Object.freeze({...operationCounts,total:operations.length}),
    harvest,
    finance,
    alerts:Object.freeze({active:activeAlerts.length,due}),
    inventory:Object.freeze({lowStock,threshold}),
    planning:Object.freeze({plans:planning.plans?.length??0,progress:finite(planning.progress),conflicts:planning.conflicts?.length??0})
  });
}
