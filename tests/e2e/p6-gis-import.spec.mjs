import {test,expect} from '@playwright/test';

async function enter(page,password){
  await page.goto('/');
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('ArtiSys Agro Lavoura').first()).toBeVisible();
}

test('P6 importa GeoJSON localmente, salva camada e aplica limite ao talhão',async({page})=>{
  await enter(page,'P6-GIS-2026!');
  await page.getByTestId('nav-fields').click();
  await page.getByRole('button',{name:'Novo talhão'}).click();
  let dialog=page.getByRole('dialog');
  await dialog.getByLabel('Código',{exact:true}).fill('GIS-01');
  await dialog.getByLabel('Nome',{exact:true}).fill('Talhão Importado');
  await dialog.getByLabel('Fazenda',{exact:true}).fill('Fazenda GIS');
  await dialog.getByLabel('Área (ha)',{exact:true}).fill('15');
  await dialog.getByRole('button',{name:'Criar talhão',exact:true}).click();
  await expect(page.getByText('Talhão Importado',{exact:true}).first()).toBeVisible();
  await page.getByTestId('nav-gis-import').click();
  await expect(page.getByTestId('gis-import-workspace')).toBeVisible();
  const geojson={type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Limite produtor'},geometry:{type:'Polygon',coordinates:[[[-47.91,-21.22],[-47.89,-21.22],[-47.89,-21.20],[-47.91,-21.20],[-47.91,-21.22]]]}}]};
  await page.locator('input[type="file"]').setInputFiles({name:'talhao.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify(geojson))});
  await expect(page.getByTestId('gis-preview')).toBeVisible();
  await expect(page.getByText('Feições').locator('..').getByText('1',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Salvar camada',exact:true}).click();
  await expect(page.getByText('talhao',{exact:true}).first()).toBeVisible();
  await page.getByText('talhao',{exact:true}).first().click();
  await page.getByLabel('Talhão').selectOption({label:'GIS-01 · Talhão Importado'});
  await page.getByRole('button',{name:'Aplicar ao talhão',exact:true}).click();
  await page.getByTestId('nav-fields').click();
  const map=page.getByTestId('agricultural-map');
  await expect(map.locator('.field-shape polygon')).toHaveCount(1);
  await expect(map.getByText('GIS importado')).toBeVisible();
});
