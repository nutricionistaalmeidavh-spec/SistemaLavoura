import {createProductSecurity} from '../shared/packages/product-security/src/index.js';

export const SECURITY_POLICY=Object.freeze({
  admin:['*'],
  manager:['crop:read','crop:write','inventory:read','inventory:write','finance:read','reports:read','users:read','audit:read','session:revoke','iot:read','iot:manage','iot:configure'],
  'field-operator':['crop:read','crop:write','inventory:read','reports:read','session:revoke','iot:read'],
  warehouse:['crop:read','inventory:read','inventory:write','reports:read','session:revoke','iot:read'],
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
    },
    admin:{read:'users:read',write:'users:write'},
    iot:{read:'iot:read',write:'iot:configure'}
  })
});

export const createSecurityService=(persistence)=>createProductSecurity(persistence,{
  productId:'agro-lavoura',
  policyDefinition:SECURITY_POLICY,
  presentationAccess:PRESENTATION_ACCESS
});