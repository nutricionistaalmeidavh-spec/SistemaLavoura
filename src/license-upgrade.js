import {resolveEdition} from './editions/index.js';
const ORDER=Object.freeze(['essential','management','complete']);
export function canUpgradeEdition(from,to){const a=ORDER.indexOf(resolveEdition(from).id),b=ORDER.indexOf(resolveEdition(to).id);return b>a}
export function createUpgradeRequest({from,to,licenseId=null}={}){if(!canUpgradeEdition(from,to))throw new Error('Target edition must be higher than current edition.');return Object.freeze({product:'artisys-lavoura',licenseId,from,to,requestedAt:new Date().toISOString()})}
export function applyLicenseUpgrade(current,next){if(current?.product!=='artisys-lavoura'||next?.product!=='artisys-lavoura')throw new Error('License product mismatch.');if(!canUpgradeEdition(current.edition,next.edition))throw new Error('License upgrade must increase edition.');return Object.freeze({...next});}
