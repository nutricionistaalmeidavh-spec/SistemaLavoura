import {resolveEdition} from './editions/index.js';
const PRODUCT='artisys-lavoura';
const text=(v,l)=>{if(typeof v!=='string'||!v.trim())throw new TypeError(`${l} is required.`);return v.trim()};
export function normalizeLavouraLicense(payload={}){
 const product=text(payload.product,'License product'); if(product!==PRODUCT)throw new Error('License product mismatch.');
 const edition=resolveEdition(text(payload.edition,'License edition')).id;
 const features=payload.features&&typeof payload.features==='object'?Object.freeze({...payload.features}):Object.freeze({});
 return Object.freeze({...payload,product,edition,features});
}
export function createLavouraLicenseContext(payload,{verify=null}={}){
 const license=normalizeLavouraLicense(payload);
 if(verify&&verify(license)!==true)throw new Error('License verification failed.');
 return Object.freeze({license,edition:license.edition,features:license.features});
}
export const LAVOURA_PRODUCT_ID=PRODUCT;
