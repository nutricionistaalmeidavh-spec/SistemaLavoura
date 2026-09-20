import {test,expect} from '@playwright/test';
import {captureStep,createInput,enterProduct} from './evidence-helpers.mjs';

const password=['Purchase','Journey','2026!'].join('-');

test('purchase-lifecycle: fornecedor, pedido, recebimento e entrada no estoque',async({page},testInfo)=>{
  await enterProduct(page,{password});
  await createInput(page,{name:'Insumo Compras E2E',unit:'kg',category:'Fertilizante',unitCost:'10.50'});
  await page.getByTestId('nav-finance').click();

  await page.getByRole('button',{name:'Fornecedor',exact:true}).click();
  let dialog=page.getByRole('dialog');
  await dialog.getByLabel('Nome',{exact:true}).fill('Fornecedor Compras E2E');
  await dialog.getByLabel('CPF/CNPJ',{exact:true}).fill('DOC-E2E-01');
  await dialog.getByLabel('Telefone',{exact:true}).fill('0000000000');
  await dialog.getByLabel('E-mail',{exact:true}).fill('fornecedor@example.test');
  await dialog.getByRole('button',{name:'Novo fornecedor',exact:true}).click();
  await expect(page.getByText(/1 fornecedor/).first()).toBeVisible();
  await captureStep(page,testInfo,'fornecedor-criado');

  await page.getByRole('button',{name:'Pedido de compra',exact:true}).click();
  dialog=page.getByRole('dialog');
  await dialog.locator('#field-supplierId').selectOption({label:'Fornecedor Compras E2E'});
  await dialog.getByLabel('Itens do pedido',{exact:true}).fill('Insumo Compras E2E | 15 | 10,50');
  await dialog.getByRole('button',{name:'Novo pedido de compra',exact:true}).click();
  await expect(page.getByText(/1 pedido/).first()).toBeVisible();
  await captureStep(page,testInfo,'pedido-criado');

  await page.getByRole('button',{name:'Receber pedido',exact:true}).click();
  dialog=page.getByRole('dialog');
  await dialog.locator('#field-id').selectOption({label:/Fornecedor Compras E2E/});
  await dialog.getByLabel('Armazém',{exact:true}).fill('Principal');
  await dialog.getByRole('button',{name:'Receber pedido',exact:true}).click();
  await captureStep(page,testInfo,'pedido-recebido');

  await page.getByTestId('nav-inventory').click();
  const row=page.getByRole('row').filter({hasText:'Insumo Compras E2E'}).first();
  await expect(row).toBeVisible();
  await expect(row.getByText('15',{exact:true}).first()).toBeVisible();
  await captureStep(page,testInfo,'estoque-pos-recebimento');
});
