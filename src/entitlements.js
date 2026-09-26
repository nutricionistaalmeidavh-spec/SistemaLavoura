import {editionDefaults,resolveEdition} from './editions/index.js';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
export function resolveEntitlements({edition='complete',licenseFeatures={},tenantFlags={},userFlags={}}={}){
 const productEdition=resolveEdition(edition); const defaults=editionDefaults(productEdition.id);
 const merged={...defaults,...licenseFeatures,...tenantFlags,...userFlags};
 return Object.freeze({edition:productEdition.id,flags:Object.freeze(merged),enabled(name){const key=name.startsWith('capability.')?name:`capability.${name}`;return merged[key]===true}});
}
export function createEditionFeatureFlags({edition='complete',licenseFeatures={},tenantFlags={},userFlags={}}={}){
 const entitlements=resolveEntitlements({edition,licenseFeatures,tenantFlags,userFlags});
 return Object.freeze({edition:entitlements.edition,get(name){return own(entitlements.flags,name)?entitlements.flags[name]:false},enabled(name){return this.get(name)===true},snapshot(){return entitlements.flags}});
}
