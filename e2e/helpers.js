import {expect} from '@playwright/test';
import {randomInt,randomUUID} from 'node:crypto';
export const password='original-ui-test-password';
export const clientHeaders=()=>({'X-Forwarded-For':`10.${randomInt(256)}.${randomInt(256)}.${randomInt(1,255)}`});
const clients=new WeakSet();
export async function isolateClient(page) {
 const context=page.context();
 if(clients.has(context))return;
 // Keep real rate limits enabled, with a separate budget for each simulated client.
 await context.setExtraHTTPHeaders(clientHeaders());
 clients.add(context);
}
export async function register(page){
 await isolateClient(page);
 const username='original_'+randomUUID().slice(0,8);
 await page.goto('/login');
 await page.getByRole('button',{name:'ثبت نام',exact:true}).click();
 await expect(page.locator('input[type=email]')).toHaveCount(0);
 await page.getByLabel('نام',{exact:true}).fill('کاربر');
 await page.getByLabel('نام خانوادگی',{exact:true}).fill('آزمون');
 await page.getByLabel('نام کاربری',{exact:true}).fill(username);
 await page.getByLabel('رمز عبور',{exact:true}).fill(password);
 await page.getByLabel('تکرار رمز عبور',{exact:true}).fill(password);
 await page.getByRole('button',{name:'ثبت نام',exact:true}).last().click();
 await expect(page).toHaveURL(/\/dashboard/);
 await expect(page.getByRole('banner')).toHaveCount(0);
 return username;
}
