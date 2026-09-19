import {createProductDocumentService} from '../shared/packages/product-documents/src/index.js';
export const DOCUMENT_DEFINITIONS=Object.freeze({
  'season-summary': Object.freeze({title:'Resumo da safra',columns:Object.freeze(['seasonId', 'crop', 'areaHa', 'harvestQuantity', 'yieldPerHa', 'costMinor'])}),
  'field-operations': Object.freeze({title:'Operações por talhão',columns:Object.freeze(['fieldId', 'operationType', 'occurredAt', 'input', 'quantity'])}),
  'traceability': Object.freeze({title:'Rastreabilidade da safra',columns:Object.freeze(['seasonId', 'fieldId', 'inputLot', 'operationAt', 'harvestLot'])})
});
export const createDocumentService=(persistence=null)=>createProductDocumentService({productId:'agro-lavoura',definitions:DOCUMENT_DEFINITIONS,persistence});