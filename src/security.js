import {createProductSecurity} from '../shared/packages/product-security/src/index.js';

export const SECURITY_POLICY=Object.freeze({
  admin:['*'],
  manager:['crop:read','crop:write','inventory:read','inventory:write','finance:read','reports:read','audit:read','session:revoke'],
  'field-operator':['crop:read','crop:write','inventory:read','reports:read','session:revoke'],
  warehouse:['crop:read','inventory:read','inventory:write','reports:read','session:revoke'],
  viewer:['crop:read','reports:read','session:revoke']
});

export const PRESENTATION_ACCESS=Object.freeze({
  defaultRead:'crop:read',
  defaultWrite:'crop:write',
  screens:Object.freeze({
    inventory:{read:'inventory:read',write:'inventory:write'},
    finance:{read:'finance:read'},
    reports:{read:'reports:read',write:'reports:read'},
    settings:{
      read:'settings:read',
      write:'settings:write',
      actions:{backup:'backup:write',restore:'backup:restore'}
    }
  })
});

export const createSecurityService=(persistence)=>createProductSecurity(persistence,{
  productId:'agro-lavoura',
  policyDefinition:SECURITY_POLICY,
  presentationAccess:PRESENTATION_ACCESS
});
