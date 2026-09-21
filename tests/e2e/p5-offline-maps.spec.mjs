import {test,expect} from '@playwright/test';

async function enter(page,password){
  await page.goto('/');
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('ArtiSys Agro Lavoura').first()).toBeVisible();
}

test('P5 mostra gerenciador de mapas e mantém fallback seguro no PWA',async({page})=>{
  await enter(page,'P5-Maps-2026!');
  await page.getByTestId('nav-offline-maps').click();
  const workspace=page.getByTestId('offline-maps-workspace');
  await expect(workspace).toBeVisible();
  await expect(workspace.getByText('Disponibilizar fazenda offline')).toBeVisible();
  await expect(workspace.getByText('Somente no desktop Windows',{exact:true})).toBeVisible();
  await expect(workspace.getByRole('button',{name:'Baixar mapa desta fazenda'})).toBeDisabled();
  await expect(workspace.getByText(/Modo Campo continua funcionando/)).toBeVisible();
});
