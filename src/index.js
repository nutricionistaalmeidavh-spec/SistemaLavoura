const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim()};
const positive=(v,l)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<=0)throw new TypeError(`${l} must be positive.`);return v};

export function recordInputApplication({id,seasonId,fieldId,catalogItemId,quantity,unit,appliedAt,inventoryMovementId=null,metadata={}}={}){return Object.freeze({id:text(id,'Application id'),seasonId:text(seasonId,'Season id'),fieldId:text(fieldId,'Field id'),catalogItemId:text(catalogItemId,'Catalog item id'),quantity:positive(quantity,'Quantity'),unit:text(unit,'Unit'),appliedAt:text(appliedAt,'Applied at'),inventoryMovementId,metadata:Object.freeze({...metadata})})}
export function recordHarvest({id,seasonId,fieldId,quantity,unit,harvestedAt,metadata={}}={}){return Object.freeze({id:text(id,'Harvest id'),seasonId:text(seasonId,'Season id'),fieldId:text(fieldId,'Field id'),quantity:positive(quantity,'Quantity'),unit:text(unit,'Unit'),harvestedAt:text(harvestedAt,'Harvested at'),metadata:Object.freeze({...metadata})})}

export * from './catalog.js';
export * from './operations.js';
export * from './finance.js';
export * from './field-notebook.js';
export * from './agricultural-workflow.js';
export * from './agricultural-map.js';
export * from './field-mode.js';
export * from './map-package-planner.js';
export { createAgroShellModel, agroTheme } from './ui.js';
export { createAgroLavouraPresentation } from './presentation-p5.js';
export * from './inventory.js';
export * from './documents.js';
export * from './security.js';
