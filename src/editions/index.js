import {ESSENTIAL} from './essential.js'; import {MANAGEMENT} from './management.js'; import {COMPLETE} from './complete.js'; import {capabilityFlags} from './capabilities.js';
export {CAPABILITIES,ALL_CAPABILITIES,capabilityFlags} from './capabilities.js'; export {ESSENTIAL} from './essential.js'; export {MANAGEMENT} from './management.js'; export {COMPLETE} from './complete.js';
export const EDITIONS=Object.freeze({essential:ESSENTIAL,management:MANAGEMENT,complete:COMPLETE});
export function resolveEdition(id='complete'){const edition=EDITIONS[id];if(!edition)throw new RangeError(`Unknown edition: ${id}`);return edition}
export function editionDefaults(id='complete'){return capabilityFlags(resolveEdition(id).capabilities)}
