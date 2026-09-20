import {test,expect} from '@playwright/test';

async function enter(page,password){
  await page.goto('/');
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByText('ArtiSys Agro Lavoura').first()).toBeVisible();
}

async function createInput(page,{name='NPK E2E',unit='kg',category='Fertilizante',unitCost='12.50'}={}){
  await page.getByTestId('nav-inputs').click();
  await page.getByRole('button',{name:/Novo insumo/}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('ID',{exact:true})).toHaveCount(0);
  await dialog.getByLabel('Nome',{exact:true}).fill(name);
  await dialog.locator('#field-unit').selectOption(unit);
  await dialog.getByLabel('Categoria',{exact:true}).fill(category);
  await dialog.getByLabel('Custo unitário (R$)',{exact:true}).fill(unitCost);
  await dialog.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page.getByText(name,{exact:true}).first()).toBeVisible();
}

async function createField(page,{code='FIN',name='Talhão Finance E2E',farm='Fazenda Finance E2E',areaHa='10'}={}){
  await page.getByTestId('nav-fields').click();
  await page.getByRole('button',{name:'Novo talhão'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Código',{exact:true}).fill(code);
  await dialog.getByLabel('Nome',{exact:true}).fill(name);
  await dialog.getByLabel('Fazenda',{exact:true}).fill(farm);
  await dialog.getByLabel('Área (ha)',{exact:true}).fill(areaHa);
  await dialog.getByRole('button',{name:'Criar talhão',exact:true}).click();
  await expect(page.getByText(name,{exact:true})).toBeVisible();
}

async function createSeason(page,{crop='Soja',period='2026/27'}={}){
  await page.getByTestId('nav-seasons').click();
  await page.getByRole('button',{name:'Nova safra',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('ID',{exact:true})).toHaveCount(0);
  await dialog.getByLabel('Cultura',{exact:true}).fill(crop);
  await dialog.locator('#field-periodName').fill(period);
  await dialog.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page.getByText(crop,{exact:true}).first()).toBeVisible();
}

test('estoque registra entrada por formulário estruturado e insumo legível',async({page})=>{
  await enter(page,'Inventory-Form-2026!');
  await createInput(page);
  await page.getByTestId('nav-inventory').click();
  await page.getByRole('button',{name:'Registrar entrada'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('ID do movimento')).toHaveCount(0);
  await dialog.locator('#field-sku').selectOption({label:'NPK E2E (kg)'});
  await dialog.getByLabel('Quantidade',{exact:true}).fill('25');
  await dialog.getByLabel('Lote',{exact:true}).fill('LOT-E2E');
  await dialog.getByRole('button',{name:'Registrar entrada',exact:true}).click();
  await expect(page.getByText('NPK E2E (kg)',{exact:true}).first()).toBeVisible();
  await expect(page.getByTestId('action-json')).toHaveCount(0);
});

test('financeiro registra despesa em reais com seletores agrícolas e atualiza os indicadores',async({page})=>{
  await enter(page,'Finance-Form-2026!');
  await createField(page);
  await createSeason(page);
  await page.getByTestId('nav-finance').click();
  await page.getByRole('button',{name:'Nova despesa'}).click();
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByLabel('ID',{exact:true})).toHaveCount(0);
  await expect(dialog.getByLabel('Valor (centavos)')).toHaveCount(0);
  await dialog.getByLabel('Safra',{exact:true}).selectOption({label:'Soja 2026/27'});
  await dialog.getByLabel('Talhão',{exact:true}).selectOption({label:'Fazenda Finance E2E > Talhão Finance E2E — 10 ha'});
  await dialog.getByLabel('Valor (R$)',{exact:true}).fill('1500.00');
  await dialog.getByLabel('Descrição',{exact:true}).fill('Adubação E2E');
  await dialog.getByLabel('Categoria',{exact:true}).fill('insumos');
  await dialog.getByRole('button',{name:'Nova despesa',exact:true}).click();
  await expect(page.getByText('Adubação E2E',{exact:true})).toBeVisible();
  await expect(page.getByText('R$ 1.500,00',{exact:true}).first()).toBeVisible();
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
  await expect(page.getByText('Preferências',{exact:true})).toBeVisible();
  await expect(page.getByText('Backups locais',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Importar CSV',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Novo item',exact:true})).toBeVisible();
});
