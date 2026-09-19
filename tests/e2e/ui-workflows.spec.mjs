import {test,expect} from '@playwright/test';

async function enter(page,password){
  await page.goto('/');
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('ArtiSys Agro Lavoura').first()).toBeVisible();
}

test('estoque registra entrada por formulário estruturado',async({page})=>{
  await enter(page,'Inventory-Form-2026!');
  await page.getByTestId('nav-inventory').click();
  await page.getByRole('button',{name:'Registrar entrada'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('ID do movimento').fill('movement-e2e');
  await dialog.getByLabel('SKU/Insumo').fill('NPK-E2E');
  await dialog.getByLabel('Quantidade').fill('25');
  await dialog.getByRole('button',{name:'Registrar entrada'}).click();
  await expect(page.getByText('NPK-E2E').first()).toBeVisible();
  await expect(page.getByTestId('action-json')).toHaveCount(0);
});

test('financeiro registra despesa e atualiza os indicadores',async({page})=>{
  await enter(page,'Finance-Form-2026!');
  await page.getByTestId('nav-finance').click();
  await page.getByRole('button',{name:'Nova despesa'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('ID').fill('expense-e2e');
  await dialog.getByLabel('Safra').fill('season-e2e');
  await dialog.getByLabel('Talhão').fill('field-e2e');
  await dialog.getByLabel('Valor (centavos)').fill('150000');
  await dialog.getByLabel('Descrição').fill('Adubação E2E');
  await dialog.getByLabel('Categoria').fill('insumos');
  await dialog.getByRole('button',{name:'Nova despesa'}).click();
  await expect(page.getByText('Adubação E2E')).toBeVisible();
});

test('relatórios gera CSV e emite documento sem parâmetros técnicos',async({page})=>{
  await enter(page,'Reports-Form-2026!');
  await page.getByTestId('nav-reports').click();
  await page.getByRole('button',{name:'Gerar CSV'}).click();
  await expect(page.getByText('Resultado pronto')).toBeVisible();
  await page.getByRole('button',{name:'Emitir documento'}).click();
  await expect(page.getByText('Documentos emitidos')).toBeVisible();
  await expect(page.getByText('JSON de entrada')).toHaveCount(0);
});

test('configurações expõe preferências, backup, importação e catálogo por controles humanos',async({page})=>{
  await enter(page,'Settings-Form-2026!');
  await page.getByTestId('nav-settings').click();
  await expect(page.getByTestId('settings-workspace')).toBeVisible();
  await expect(page.getByText('Preferências')).toBeVisible();
  await expect(page.getByText('Backups locais')).toBeVisible();
  await expect(page.getByRole('button',{name:'Importar CSV'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Novo item'})).toBeVisible();
});
