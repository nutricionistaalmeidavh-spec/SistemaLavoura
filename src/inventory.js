import {createProductInventoryService} from '../shared/packages/product-inventory/src/index.js';
export const createInventoryService=(p)=>createProductInventoryService(p,{namespace:'agro-lavoura'});
export const receiveCropInput=(s,input)=>s.apply({...input,kind:'in'});
export const consumeCropInput=(s,input)=>s.apply({...input,kind:'out'});