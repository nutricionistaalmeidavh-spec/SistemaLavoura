export const CAPABILITIES=Object.freeze({
 CORE:'core',DASHBOARD:'dashboard',FIELDS:'fields',SEASONS:'seasons',OPERATIONS:'operations',INPUTS:'inputs',HARVEST:'harvest',
 INVENTORY:'inventory',FINANCE:'finance',REPORTS:'reports',PDF:'reports.pdf',FILES:'files',CHECKLISTS:'checklists',MAPS:'maps',
 GIS:'gis',SATELLITE:'satellite',NDVI:'ndvi',IOT:'iot',ADMIN:'admin',AUDIT:'audit'
});
export const ALL_CAPABILITIES=Object.freeze(Object.values(CAPABILITIES));
export const capabilityFlags=capabilities=>Object.freeze(Object.fromEntries(ALL_CAPABILITIES.map(key=>[`capability.${key}`,capabilities.includes(key)])));
