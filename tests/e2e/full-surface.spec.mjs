import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {captureStep} from './evidence-helpers.mjs';
const contract=JSON.parse(await readFile(new URL('../../qa/e2e-surface-contract.json',import.meta.url),'utf8'));

test('percorre 100% das telas publicadas ao usuário e preserva evidência visual',async({page},testInfo)=>{
  await page.goto('/');
  await page.getByTestId('password').fill(['Qa','Browser','2026!'].join('-'));
  await page.getByTestId('auth-submit').click();
  await expect(page.getByRole('button',{name:'Sair'}),'shell autenticado').toBeVisible();
  for(const id of contract.screens){
    const nav=page.getByTestId(`nav-${id}`);
    await expect(nav,`navegação ${id}`).toBeVisible();
    await nav.click();
    await expect(nav).toHaveClass(/active/);
    await expect(page.getByText('Tela indisponível',{exact:true}),`renderer ${id}`).toHaveCount(0);
    await captureStep(page,testInfo,`surface-${id}`);
  }
});
