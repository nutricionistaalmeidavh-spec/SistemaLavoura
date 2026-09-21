import {test,expect} from '@playwright/test';

async function enter(page){
  await page.goto('/');
  await page.getByTestId('password').fill('P5-Maps-2026!');
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('ArtiSys Agro Lavoura').first()).toBeVisible();
}

test('P8 preserves field workflow while desktop map operations are unavailable in PWA',async({page})=>{
  await enter(page);
  await page.getByTestId('nav-offline-maps').click();
  const workspace=page.getByTestId('offline-maps-workspace');
  await expect(workspace).toBeVisible();
  await expect(workspace.getByText('Somente no desktop Windows',{exact:true})).toBeVisible();
  await expect(workspace.getByRole('button',{name:'Baixar mapa desta fazenda'})).toBeDisabled();
  await expect(workspace.getByText(/Modo Campo continua funcionando/)).toBeVisible();
  await page.getByTestId('nav-field-mode').click();
  await expect(page.getByTestId('field-mode-workspace')).toBeVisible();
});