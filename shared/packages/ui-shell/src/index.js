export function createShellModel({ brand, capabilities = [], navigation = [] } = {}) {
  if (!brand?.name) throw new TypeError('Brand name is required.');
  const capabilitySet = new Set(capabilities);
  const ids = new Set();
  for (const item of navigation) {
    if (!item?.id) throw new TypeError('Navigation item id is required.');
    if (ids.has(item.id)) throw new Error(`Duplicate navigation id: ${item.id}.`);
    ids.add(item.id);
  }
  const visibleNavigation = navigation.filter((item) => (item.requires ?? []).every((capability) => capabilitySet.has(capability)));
  return Object.freeze({ brand: Object.freeze({ ...brand }), capabilities: Object.freeze([...capabilitySet]), navigation: Object.freeze(visibleNavigation.map((item) => Object.freeze({ ...item }))) });
}
export { createFunctionalPresentation } from './functional.js';