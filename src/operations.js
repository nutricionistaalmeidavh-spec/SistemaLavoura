import {createWorkflowDefinition,createWorkflowInstance,transitionWorkflow} from '../shared/vendor/release-modules/artisys-workflow-engine/src/index.mjs';

const positive=(v,l)=>{if(!Number.isFinite(Number(v))||Number(v)<=0)throw new TypeError(`${l} must be positive.`);return Number(v);};
const optionalText=value=>typeof value==='string'&&value.trim()?value.trim():null;
const idFor=(prefix,value)=>optionalText(value)??(globalThis.crypto?.randomUUID?.()??`${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const FIELD_OPERATION_WORKFLOW=createWorkflowDefinition({
  id:'agro-field-operation',initialState:'planned',states:['planned','in-progress','completed','cancelled'],
  transitions:[
    {id:'start',from:'planned',to:'in-progress',event:'start'},
    {id:'cancel-planned',from:'planned',to:'cancelled',event:'cancel'},
    {id:'complete',from:'in-progress',to:'completed',event:'complete'},
    {id:'cancel-active',from:'in-progress',to:'cancelled',event:'cancel'}
  ]
});

const workflowInstance=operation=>createWorkflowInstance({id:String(operation.id??'operation'),workflowId:FIELD_OPERATION_WORKFLOW.id,state:operation.status,data:{},history:operation.workflowHistory??[]});
const applyTransition=(operation,to,event,at)=>{const next=transitionWorkflow(FIELD_OPERATION_WORKFLOW,workflowInstance(operation),to,{event,at});return{...operation,status:next.state,workflowHistory:next.history};};
const cloneItems=items=>Object.freeze((items??[]).map(item=>Object.freeze({...item})));

export function createSeasonPlan({id,seasonId,fieldIds,expectedYieldPerHa,budgetMinor=null}={}){return Object.freeze({id:idFor('plan',id),seasonId,fieldIds:Object.freeze([...new Set(fieldIds)]),expectedYieldPerHa:positive(expectedYieldPerHa,'Expected yield'),budgetMinor,status:'planned'});}
export function scheduleFieldOperation({id,seasonId,fieldId,typeId,typeName=null,scheduledAt,machineAssetId=null,machineName=null,operatorPartyId=null,operatorName=null,inputItems=[]}={}){return Object.freeze({id:idFor('operation',id),seasonId,fieldId,typeId,typeName:optionalText(typeName),scheduledAt:new Date(scheduledAt).toISOString(),machineAssetId:optionalText(machineAssetId),machineName:optionalText(machineName),operatorPartyId:optionalText(operatorPartyId),operatorName:optionalText(operatorName),inputItems:cloneItems(inputItems),status:'planned',workflowHistory:Object.freeze([])});}
export function startFieldOperation(operation,{startedAt=new Date().toISOString()}={}){if(operation.status!=='planned')throw new Error('Only planned operation can start.');const at=new Date(startedAt).toISOString();return Object.freeze({...applyTransition(operation,'in-progress','start',at),startedAt:at});}
export function completeFieldOperation(operation,{completedAt=new Date().toISOString(),actualAreaHa=null,inputUsages=[],costBreakdown=null,actualCostMinor=null,costPerHaMinor=null,notes=null}={}){if(operation.status!=='in-progress')throw new Error('Only in-progress operation can complete.');const at=new Date(completedAt).toISOString();return Object.freeze({...applyTransition(operation,'completed','complete',at),completedAt:at,actualAreaHa:actualAreaHa==null?null:positive(actualAreaHa,'Actual area'),inputUsages:cloneItems(inputUsages),costBreakdown:costBreakdown?Object.freeze({...costBreakdown}):null,actualCostMinor:actualCostMinor==null?null:Number(actualCostMinor),costPerHaMinor:costPerHaMinor==null?null:Number(costPerHaMinor),notes:optionalText(notes)});}
export function createHarvestLot({id,seasonId,fieldId,quantity,unit,areaHa,harvestedAt}={}){const qty=positive(quantity,'Harvest quantity'),area=positive(areaHa,'Harvest area');return Object.freeze({id:idFor('harvest',id),seasonId,fieldId,quantity:qty,unit,areaHa:area,harvestedAt:new Date(harvestedAt).toISOString(),yieldPerHa:qty/area});}
export function cropYieldSummary(harvestLots=[]){const qty=harvestLots.reduce((s,h)=>s+h.quantity,0),area=harvestLots.reduce((s,h)=>s+h.areaHa,0);return Object.freeze({quantity:qty,areaHa:area,yieldPerHa:area>0?qty/area:null});}
export function cancelFieldOperation(operation,{reason,cancelledAt=new Date().toISOString()}={}){if(!['planned','in-progress'].includes(operation.status))throw new Error('Only open field operation can be cancelled.');const at=new Date(cancelledAt).toISOString();return Object.freeze({...applyTransition(operation,'cancelled','cancel',at),cancelReason:reason,cancelledAt:at});}
