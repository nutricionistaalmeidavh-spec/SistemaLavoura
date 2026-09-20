import {expect} from '@playwright/test';

const slug=value=>String(value??'step').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase();

export async function captureStep(page,testInfo,name){
  await page.waitForLoadState('networkidle').catch(()=>{});
  const filename=`${String((testInfo.__evidenceStep=(testInfo.__evidenceStep??0)+1)).padStart(2,'0')}-${slug(name)}.png`;
  const path=testInfo.outputPath(filename);
  await page.screenshot({path,fullPage:true});
  await testInfo.attach(filename,{path,contentType:'image/png'});
  return path;
}

export async function enterProduct(page,{username='admin',password}){
  await page.goto('/');
  await page.getByTestId('username').fill(username);
  await page.getByTestId('password').fill(password);
  await page.getByTestId('auth-submit').click();
  await expect(page.getByRole('button',{name:'Sair'})).toBeVisible();
}

export async function fillLines(dialog,label,value){
  await dialog.locator('label').filter({hasText:label}).locator('textarea').fill(value);
}

export async function submitDialog(dialog,buttonName){
  await dialog.getByRole('button',{name:buttonName,exact:true}).click();
  await expect(dialog).toBeHidden();
}

export async function selectOptionContaining(selectLocator,text){
  const option=selectLocator.locator('option').filter({hasText:text}).first();
  await expect(option).toHaveCount(1);
  const value=await option.getAttribute('value');
  if(value==null||value==='')throw new Error(`Option containing "${text}" has no selectable value.`);
  await selectLocator.selectOption(value);
}

export async function selectOperationRow(page,name){
  const row=page.locator('.workspace-split .workspace-table tbody tr').filter({hasText:name}).first();
  await expect(row).toBeVisible();
  await row.click();
  return row;
}

export async function createField(page,{code='E2E-01',name='Talhão E2E',farm='Fazenda E2E',area='10'}={}){
  await page.getByTestId('nav-fields').click();
  await page.getByRole('button',{name:'Novo talhão'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.locator('#field-code').fill(code);
  await dialog.locator('#field-name').fill(name);
  await dialog.locator('#field-farmUnitName').fill(farm);
  await dialog.locator('#field-areaHa').fill(area);
  await submitDialog(dialog,'Criar talhão');
  await expect(page.getByText(name,{exact:true}).first()).toBeVisible();
}

export async function createSeason(page,{crop='Soja E2E',period='2026/27'}={}){
  await page.getByTestId('nav-seasons').click();
  await page.getByRole('button',{name:'Nova safra',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.locator('#field-crop').fill(crop);
  await dialog.locator('#field-periodName').fill(period);
  await submitDialog(dialog,'Salvar');
  await expect(page.getByText(crop,{exact:true}).first()).toBeVisible();
}

export async function createInput(page,{name='Insumo E2E',unit='L',category='Defensivo',unitCost='25.90'}={}){
  await page.getByTestId('nav-inputs').click();
  await page.getByRole('button',{name:/Novo insumo/}).click();
  const dialog=page.getByRole('dialog');
  await dialog.locator('#field-name').fill(name);
  await dialog.locator('#field-unit').selectOption(unit);
  await dialog.locator('#field-category').fill(category);
  await dialog.locator('#field-unitCost').fill(unitCost);
  await submitDialog(dialog,'Salvar');
  await expect(page.getByText(name,{exact:true}).first()).toBeVisible();
}

export async function logout(page){
  await page.getByRole('button',{name:'Sair'}).click();
  await expect(page.getByTestId('auth-submit')).toBeVisible();
}
