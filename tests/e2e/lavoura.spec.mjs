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
  await expect(dialog.getByLabel('ID',{exact:true})).toHaveCount(0);
  await dialog.getByLabel('Código',{exact:true}).fill('E2E');
  await dialog.getByLabel('Nome',{exact:true}).fill('Talhão E2E');
  await dialog.getByLabel('Fazenda',{exact:true}).fill('Fazenda E2E');
  await dialog.getByLabel('Área/Setor (opcional)',{exact:true}).fill('Área E2E');
  await dialog.getByLabel('Área (ha)',{exact:true}).fill('10');
  await dialog.getByRole('button',{name:'Criar talhão',exact:true}).click();

  await expect(page.getByText('Talhão E2E',{exact:true})).toBeVisible();
  await expect(page.getByText('Fazenda E2E',{exact:true}).first()).toBeVisible();
  await expect(page.getByTestId('action-json')).toHaveCount(0);
});
