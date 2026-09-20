import {test,expect} from '@playwright/test';

test.use({geolocation:{latitude:-21.21,longitude:-47.90},permissions:['geolocation']});

async function enter(page,password){
  await page.goto('/');
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('ArtiSys Agro Lavoura').first()).toBeVisible();
}

test('P4 funciona como PWA de campo com GPS e observação local pendente',async({page})=>{
  await enter(page,'P4-Field-2026!');
  await page.getByTestId('nav-fields').click();
  await page.getByRole('button',{name:'Novo talhão'}).click();
  let dialog=page.getByRole('dialog');
  await dialog.getByLabel('Código',{exact:true}).fill('FIELD-01');
  await dialog.getByLabel('Nome',{exact:true}).fill('Talhão Campo');
  await dialog.getByLabel('Fazenda',{exact:true}).fill('Fazenda Campo');
  await dialog.getByLabel('Área (ha)',{exact:true}).fill('42.5');
  await dialog.getByRole('button',{name:'Criar talhão',exact:true}).click();
  await page.getByText('Talhão Campo',{exact:true}).first().click();
  await page.getByRole('button',{name:'Mapa/GIS',exact:true}).click();
  dialog=page.getByRole('dialog');
  await dialog.getByLabel('Coordenadas do polígono').fill('-47.91,-21.22\n-47.89,-21.22\n-47.89,-21.20\n-47.91,-21.20');
  await dialog.getByRole('button',{name:'Salvar mapa do talhão',exact:true}).click();

  await page.getByTestId('nav-field-mode').click();
  await expect(page.getByTestId('field-mode-workspace')).toBeVisible();
  await page.getByRole('button',{name:'Usar meu GPS'}).click();
  await expect(page.getByText(/-21\.210000, -47\.900000/)).toBeVisible();
  await page.getByTestId('field-observation-title').fill('Ponto observado em campo');
  await page.getByRole('button',{name:'Salvar observação'}).click();
  await expect(page.getByText('Registros para sincronização')).toBeVisible();
  await expect(page.locator('.pending-count')).toHaveText('1');
  await expect(page.getByText('Ponto observado em campo')).toBeVisible();

  const registrations=await page.evaluate(async()=>navigator.serviceWorker?await navigator.serviceWorker.getRegistrations().then(items=>items.length):0);
  expect(registrations).toBeGreaterThan(0);
});
