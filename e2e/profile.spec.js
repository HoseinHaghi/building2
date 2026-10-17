import {test,expect} from '@playwright/test';
import {register,password} from './helpers';
test('username-only signup and renewed password sessions use the original login form',async({page})=>{
 const username=await register(page);
 const me=await (await page.request.get('/api/auth/me')).json();
 expect(me.user.email).toBeNull();
 const next='updated-original-password';
 const changed=await page.request.post('/api/auth/password',{headers:{'X-CSRF-Token':me.csrfToken},data:{currentPassword:password,password:next}});
 expect(changed.status()).toBe(200);
 const account=await changed.json();
 await page.request.post('/api/auth/logout',{headers:{'X-CSRF-Token':account.csrfToken}});
 await page.goto('/login');
 await page.getByLabel('نام کاربری',{exact:true}).fill(username);
 await page.getByLabel('رمز عبور',{exact:true}).fill(next);
 await page.getByRole('button',{name:'وارد شوید',exact:true}).click();await expect(page).toHaveURL(/\/dashboard/);
});
