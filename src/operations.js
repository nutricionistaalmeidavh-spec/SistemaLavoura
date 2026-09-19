import {createWorkflowDefinition,createWorkflowInstance,transitionWorkflow} from '../shared/vendor/release-modules/artisys-workflow-engine/src/index.mjs';

const positive=(v,l)=>{if(!Number.isFinite(v)||v<=0)throw new TypeError(`${l} must be positive.`);return v;};

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

export function createSeasonPlan({id,seasonId,fieldIds,expectedYieldPerHa,budgetMinor=null}={}){return Object.freeze({id,seasonId,fieldIds:Object.freeze([...new Set(fieldIds)]),expectedYieldPerHa:positive(expectedYieldPerHa,'Expected yield'),budgetMinor,status:'planned'});}
export function scheduleFieldOperation({id,seasonId,fieldId,typeId,scheduledAt,machineAssetId=null,operatorPartyId=null,inputItems=[]}={}){return Object.freeze({id,seasonId,fieldId,typeId,scheduledAt:new Date(scheduledAt).toISOString(),machineAssetId,operatorPartyId,inputItems:Object.freeze(inputItems.map(v=>Object.freeze({...v}))),status:'planned',workflowHistory:Object.freeze([])});}
export function startFieldOperation(operation,{startedAt=new Date().toISOString()}={}){if(operation.status!=='planned')throw new Error('Only planned operation can start.');const at=new Date(startedAt).toISOString();return Object.freeze({...applyTransition(operation,'in-progress','start',at),startedAt:at});}
export function completeFieldOperation(operation,{completedAt=new Date().toISOString(),actualCostMinor=null,notes=null}={}){if(operation.status!=='in-progress')throw new Error('Only in-progress operation can complete.');const at=new Date(completedAt).toISOString();return Object.freeze({...applyTransition(operation,'completed','complete',at),completedAt:at,actualCostMinor,notes});}
export function createHarvestLot({id,seasonId,fieldId,quantity,unit,areaHa,harvestedAt}={}){return Object.freeze({id,seasonId,fieldId,quantity:positive(quantity,'Harvest quantity'),unit,areaHa:positive(areaHa,'Harvest area'),harvestedAt:new Date(harvestedAt).toISOString(),yieldPerHa:quantity/areaHa});}
export function cropYieldSummary(harvestLots=[]){const qty=harvestLots.reduce((s,h)=>s+h.quantity,0),area=harvestLots.reduce((s,h)=>s+h.areaHa,0);return Object.freeze({quantity:qty,areaHa:area,yieldPerHa:area>0?qty/area:null});}
export function cancelFieldOperation(operation,{reason,cancelledAt=new Date().toISOString()}={}){if(!['planned','in-progress'].includes(operation.status))throw new Error('Only open field operation can be cancelled.');const at=new Date(cancelledAt).toISOString();return Object.freeze({...applyTransition(operation,'cancelled','cancel',at),cancelReason:reason,cancelledAt:at});}
