import {test,expect} from '@playwright/test';

test('shell productizado abre dashboard especializado e preserva fallback operacional',async({page})=>{
  await page.goto('/');
  await page.getByTestId('password').fill('Ui-Product-2026!');
  await page.getByTestId('auth-submit').click();

  await expect(page.getByText('ArtiSys Agro Lavoura').first()).toBeVisible();
  await expect(page.getByRole('heading',{name:'Panorama da lavoura'})).toBeVisible();
  await expect(page.getByText('Área plantada')).toBeVisible();
  await expect(page.getByText('Andamento das operações')).toBeVisible();
  await expect(page.getByTestId('action-json')).toHaveCount(0);

  const fields=page.getByTestId('nav-fields');
  await fields.click();
  await expect(fields).toHaveClass(/active/);
  await expect(page.getByText('Ações da tela')).toBeVisible();
  await expect(page.getByRole('button',{name:'Salvar',exact:true})).toBeVisible();
});
