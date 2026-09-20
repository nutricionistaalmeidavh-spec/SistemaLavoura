import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openProductPersistence} from '../shared/packages/vertical-persistence/src/index.js';
import {createAgroLavouraPresentation} from '../src/presentation-p7.js';
import {createField,createFarmUnit} from '../src/catalog.js';
import {normalizeGisFeatureCollection,createGisLayer} from '../src/gis-import.js';
import {normalizeStacScene,calculateNdviGrid} from '../src/satellite.js';

async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'lavoura-p6p7-'));
  const sql=await readFile(new URL('../migrations/001-initial.sql',import.meta.url),'utf8');
  const persistence=await openProductPersistence({dbPath:join(root,'db.sqlite'),productId:'agro-lavoura',migrations:[{id:'agro-lavoura/001-initial.sql',sql}]});
  const presentation=createAgroLavouraPresentation({persistence});
  return {root,persistence,presentation,async close(){await persistence.close();await rm(root,{recursive:true,force:true});}};
}

test('P6/P7 add GIS import and satellite screens without removing P0-P5 screens',async()=>{
  const ctx=await fixture();
  try{
    const ids=ctx.presentation.screenIds();
    for(const id of ['overview','fields','seasons','operations','inputs','harvest','inventory','finance','reports','settings','field-mode','offline-maps'])assert.ok(ids.includes(id),id);
    assert.ok(ids.includes('gis-import'));
    assert.ok(ids.includes('satellite'));
    assert.equal(ctx.presentation.screen('gis-import').kind,'gis-import');
    assert.equal(ctx.presentation.screen('satellite').kind,'satellite');
  }finally{await ctx.close();}
});

test('P6 saves GIS layer, applies polygon to field, and layer removal preserves boundary',async()=>{
  const ctx=await fixture();
  try{
    await ctx.presentation.services.repos.farmUnits.save(createFarmUnit({id:'farm-1',name:'Fazenda 1'}),{expectedVersion:0});
    await ctx.presentation.services.repos.fields.save(createField({id:'field-1',code:'T1',name:'Talhão 1',farmUnitId:'farm-1',areaHa:10}),{expectedVersion:0});
    const fc=normalizeGisFeatureCollection({type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Limite'},geometry:{type:'Polygon',coordinates:[[[-48,-22],[-47.9,-22],[-47.9,-21.9],[-48,-21.9],[-48,-22]]]}}]});
    const layer=createGisLayer({id:'gis-1',name:'Mapa produtor',format:'geojson',featureCollection:fc});
    await ctx.presentation.action('gis-import','saveLayer',{layer});
    await ctx.presentation.action('gis-import','applyFieldGeometry',{layerId:'gis-1',featureIndex:0,fieldId:'field-1'});
    const geometry=await ctx.presentation.services.repos.fieldGeometries.get('field-1');
    assert.equal(geometry.payload.geometry.type,'Polygon');
    assert.equal(geometry.payload.sourceLayerId,'gis-1');
    await ctx.presentation.action('gis-import','removeLayer',{id:'gis-1'});
    assert.equal(await ctx.presentation.services.gisLayers.get('gis-1'),null);
    assert.equal((await ctx.presentation.services.repos.fieldGeometries.get('field-1')).payload.geometry.type,'Polygon');
  }finally{await ctx.close();}
});

test('P7 persists cached scene and NDVI but strips credentials',async()=>{
  const ctx=await fixture();
  try{
    const scene=normalizeStacScene('landsat',{id:'L9-A',bbox:[-48,-22,-47,-21],properties:{datetime:'2026-09-10T10:00:00Z','eo:cloud_cover':2},assets:{thumbnail:{href:'https://example.test/thumb.jpg'},red:{href:'https://example.test/red.tif'},nir08:{href:'https://example.test/nir.tif'}}});
    await ctx.presentation.action('satellite','cacheScene',{scene,previewDataUrl:'data:image/png;base64,AA==',credentials:{token:'secret'}});
    const ndvi=calculateNdviGrid({red:[1,1,0,0],nir:[3,1,0,2],width:2,height:2});
    await ctx.presentation.action('satellite','saveNdvi',{id:'landsat:L9-A',ndvi});
    const cached=await ctx.presentation.services.satelliteCache.get('landsat:L9-A');
    assert.ok(cached);
    assert.equal(cached.payload.ndvi.values.length,4);
    assert.equal(JSON.stringify(cached.payload).includes('secret'),false);
  }finally{await ctx.close();}
});
