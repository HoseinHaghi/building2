import {expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
export const password='original-ui-test-password';
export async function register(page){
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
