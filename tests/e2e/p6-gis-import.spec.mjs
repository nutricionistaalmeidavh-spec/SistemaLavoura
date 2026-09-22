import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';

const GIS_FIXTURE=fileURLToPath(new URL('../fixtures/p6-talhao.geojson',import.meta.url));

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
  await page.getByTestId('gis-file-input').setInputFiles(GIS_FIXTURE);
  await expect(page.getByTestId('gis-preview')).toBeVisible();
  await expect(page.getByText('Feições').locator('..').getByText('1',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Salvar camada',exact:true}).click();
  await expect(page.getByText('p6-talhao',{exact:true}).first()).toBeVisible();
  await page.getByText('p6-talhao',{exact:true}).first().click();
  await page.getByLabel('Talhão').selectOption({label:'GIS-01 · Talhão Importado'});
  await page.getByRole('button',{name:'Aplicar ao talhão',exact:true}).click();
  await page.getByTestId('nav-fields').click();
  const map=page.getByTestId('agricultural-map');
  await expect(map.locator('.field-shape polygon')).toHaveCount(1);
  await expect(map.getByText('GIS importado')).toBeVisible();
});
