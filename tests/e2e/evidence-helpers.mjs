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

export async function createField(page,{code='E2E-01',name='Talhão E2E',farm='Fazenda E2E',area='10'}={}){
  await page.getByTestId('nav-fields').click();
  await page.getByRole('button',{name:'Novo talhão'}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Código',{exact:true}).fill(code);
  await dialog.getByLabel('Nome',{exact:true}).fill(name);
  await dialog.getByLabel('Fazenda',{exact:true}).fill(farm);
  await dialog.getByLabel('Área (ha)',{exact:true}).fill(area);
  await dialog.getByRole('button',{name:'Criar talhão',exact:true}).click();
  await expect(page.getByText(name,{exact:true}).first()).toBeVisible();
}

export async function createSeason(page,{crop='Soja E2E',period='2026/27'}={}){
  await page.getByTestId('nav-seasons').click();
  await page.getByRole('button',{name:'Nova safra',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Cultura',{exact:true}).fill(crop);
  await dialog.getByLabel('Safra/Período',{exact:true}).fill(period);
  await dialog.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page.getByText(crop,{exact:true}).first()).toBeVisible();
}

export async function createInput(page,{name='Insumo E2E',unit='L',category='Defensivo',unitCost='25.90'}={}){
  await page.getByTestId('nav-inputs').click();
  await page.getByRole('button',{name:/Novo insumo/}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Nome',{exact:true}).fill(name);
  await dialog.locator('#field-unit').selectOption(unit);
  await dialog.getByLabel('Categoria',{exact:true}).fill(category);
  await dialog.getByLabel('Custo unitário (R$)',{exact:true}).fill(unitCost);
  await dialog.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(page.getByText(name,{exact:true}).first()).toBeVisible();
}

export async function logout(page){
  await page.getByRole('button',{name:'Sair'}).click();
  await expect(page.getByTestId('auth-submit')).toBeVisible();
}
