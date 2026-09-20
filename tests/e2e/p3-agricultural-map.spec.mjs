import {test,expect} from '@playwright/test';

async function enter(page,password){
  await page.goto('/');
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('ArtiSys Agro Lavoura').first()).toBeVisible();
}

test('P3 cria polígono do talhão, abre ficha espacial e persiste ponto agrícola',async({page})=>{
  await enter(page,'P3-Map-2026!');
  await page.getByTestId('nav-fields').click();
  await expect(page.getByTestId('agricultural-map')).toBeVisible();

  await page.getByRole('button',{name:'Novo talhão'}).click();
  let dialog=page.getByRole('dialog');
  await dialog.getByLabel('Código',{exact:true}).fill('MAP-01');
  await dialog.getByLabel('Nome',{exact:true}).fill('Talhão Mapa P3');
  await dialog.getByLabel('Fazenda',{exact:true}).fill('Fazenda Mapa P3');
  await dialog.getByLabel('Área (ha)',{exact:true}).fill('42.5');
  await dialog.getByRole('button',{name:'Criar talhão',exact:true}).click();
  await expect(page.getByText('Talhão Mapa P3',{exact:true}).first()).toBeVisible();

  await page.getByText('Talhão Mapa P3',{exact:true}).first().click();
  await page.getByRole('button',{name:'Mapa/GIS',exact:true}).click();
  dialog=page.getByRole('dialog');
  await dialog.getByLabel('Coordenadas do polígono').fill('-47.91,-21.22\n-47.89,-21.22\n-47.89,-21.20\n-47.91,-21.20');
  await dialog.getByRole('button',{name:'Salvar mapa do talhão',exact:true}).click();

  const map=page.getByTestId('agricultural-map');
  await expect(map.locator('.field-shape')).toHaveCount(1);
  await map.locator('.field-shape').click();
  await expect(map.getByText('Talhão Mapa P3',{exact:true})).toBeVisible();
  await expect(map.getByText('Safra ativa',{exact:true})).toBeVisible();

  await page.getByRole('button',{name:'Novo ponto no mapa',exact:true}).click();
  dialog=page.getByRole('dialog');
  await dialog.locator('#field-kind').selectOption('sensor');
  await dialog.locator('#field-name').fill('Pluviômetro P3');
  await dialog.locator('#field-latitude').fill('-21.21');
  await dialog.locator('#field-longitude').fill('-47.90');
  await dialog.getByRole('button',{name:'Salvar ponto',exact:true}).click();

  await expect(page.getByText('Pontos georreferenciados').locator('..').getByText('1',{exact:true})).toBeVisible();
  await expect(map.locator('.map-marker')).toHaveCount(1);
});
