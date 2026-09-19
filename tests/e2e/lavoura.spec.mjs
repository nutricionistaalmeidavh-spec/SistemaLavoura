import {test,expect} from '@playwright/test';

test('bootstrap, navegação e cadastro humano de talhão funcionam no standalone',async({page})=>{
  await page.goto('/');
  await page.getByTestId('password').fill('senha-e2e-123');
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('ArtiSys Agro Lavoura').first()).toBeVisible();

  await page.getByTestId('nav-fields').click();
  await expect(page.getByTestId('fields-workspace')).toBeVisible();
  await page.getByRole('button',{name:'Novo talhão'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('ID').fill('field-e2e');
  await dialog.getByLabel('Código').fill('E2E');
  await dialog.getByLabel('Nome').fill('Talhão E2E');
  await dialog.getByLabel('Unidade/Fazenda').fill('farm-e2e');
  await dialog.getByLabel('Área (ha)').fill('10');
  await dialog.getByRole('button',{name:'Criar talhão'}).click();

  await expect(page.getByText('Talhão E2E')).toBeVisible();
  await expect(page.getByText('field-e2e')).toHaveCount(0);
  await expect(page.getByTestId('action-json')).toHaveCount(0);
});
