import {test,expect} from '@playwright/test';

const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
async function enter(page,password){
  await page.goto('/');
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('ArtiSys Agro Lavoura').first()).toBeVisible();
}

test('P7 busca Sentinel pelo talhão e mantém preview no cache local',async({page})=>{
  await page.route('https://stac.dataspace.copernicus.eu/v1/search',async route=>{
    const body=route.request().postDataJSON();
    expect(body.collections).toEqual(['sentinel-2-l2a']);
    expect(body.bbox).toHaveLength(4);
    await route.fulfill({status:200,contentType:'application/geo+json',body:JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',id:'S2-TEST',collection:'sentinel-2-l2a',bbox:[-47.92,-21.23,-47.88,-21.19],properties:{datetime:'2026-09-18T10:00:00Z','eo:cloud_cover':4},assets:{thumbnail:{href:'https://example.test/s2.png'},B04_10m:{href:'https://example.test/red.tif'},B08_10m:{href:'https://example.test/nir.tif'}}}]})});
  });
  await page.route('https://example.test/s2.png',route=>route.fulfill({status:200,contentType:'image/png',body:pixel}));
  await enter(page,'P7-Sat-2026!');
  await page.getByTestId('nav-fields').click();
  await page.getByRole('button',{name:'Novo talhão'}).click();
  let dialog=page.getByRole('dialog');
  await dialog.getByLabel('Código',{exact:true}).fill('SAT-01');
  await dialog.getByLabel('Nome',{exact:true}).fill('Talhão Satélite');
  await dialog.getByLabel('Fazenda',{exact:true}).fill('Fazenda Satélite');
  await dialog.getByLabel('Área (ha)',{exact:true}).fill('20');
  await dialog.getByRole('button',{name:'Criar talhão',exact:true}).click();
  await page.getByText('Talhão Satélite',{exact:true}).first().click();
  await page.getByRole('button',{name:'Mapa/GIS',exact:true}).click();
  dialog=page.getByRole('dialog');
  await dialog.getByLabel('Coordenadas do polígono').fill('-47.91,-21.22\n-47.89,-21.22\n-47.89,-21.20\n-47.91,-21.20');
  await dialog.getByRole('button',{name:'Salvar mapa do talhão',exact:true}).click();
  await page.getByTestId('nav-satellite').click();
  await expect(page.getByTestId('satellite-workspace')).toBeVisible();
  await page.getByLabel('Talhão').selectOption({label:'SAT-01 · Talhão Satélite'});
  await page.getByRole('button',{name:'Buscar imagens',exact:true}).click();
  await expect(page.getByText('Sentinel-2 · Copernicus').last()).toBeVisible();
  await expect(page.getByText('Nuvens: 4%')).toBeVisible();
  await page.getByRole('button',{name:'Salvar offline',exact:true}).click();
  await expect(page.getByText('S2-TEST',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Imagem',exact:true}).click();
  await expect(page.getByAltText('Preview da cena de satélite selecionada')).toBeVisible();
});
