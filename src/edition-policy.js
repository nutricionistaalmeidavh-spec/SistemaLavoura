const SCREEN_CAPABILITY=Object.freeze({
 overview:'dashboard',fields:'fields',seasons:'seasons',operations:'operations',inputs:'inputs',harvest:'harvest',
 inventory:'inventory',finance:'finance',reports:'reports',settings:'core','field-mode':'operations','offline-maps':'maps','gis-import':'gis',satellite:'satellite',iot:'iot',admin:'admin'
});
const ACTION_CAPABILITY=Object.freeze({
 'reports.pdf':'reports.pdf','fields.uploadFile':'files','fields.removeFile':'files',
 'operations.createChecklist':'checklists','operations.setChecklistItem':'checklists','operations.completeChecklist':'checklists',
 'admin.audit':'audit'
});
export const capabilityForScreen=id=>SCREEN_CAPABILITY[String(id)]??'core';
export const capabilityForAction=(screenId,action)=>ACTION_CAPABILITY[`${String(screenId)}.${String(action)}`]??capabilityForScreen(screenId);
export function assertEntitled(entitlements,capability,{screenId=null,action=null}={}){
 if(!entitlements?.enabled?.(capability)){const error=new Error(`Recurso indisponível nesta edição: ${capability}.`);error.code='EDITION_FORBIDDEN';error.capability=capability;error.screenId=screenId;error.action=action;throw error;}return true;
}
