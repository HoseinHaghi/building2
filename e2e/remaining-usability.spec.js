import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {register,password,isolateClient} from './helpers';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2uoAAAAASUVORK5CYII=','base64');
async function fileDraftCount(page) {
  return page.evaluate(()=>new Promise((resolve,reject)=>{
    const request=indexedDB.open('building-work-drafts');
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const db=request.result,read=db.transaction('files').objectStore('files').getAll();
      read.onsuccess=()=>{resolve(read.result.length);db.close();};
      read.onerror=()=>reject(read.error);
    };
  }));
}
async function setup(page) {
  const username=await register(page);
  const me=await (await page.request.get('/api/auth/me')).json();
  const headers={Origin:'http://127.0.0.1:5190','X-CSRF-Token':me.csrfToken};
  const project=async(name,parentId=null)=>{
    const response=await page.request.post('/api/projects',{headers,data:{name,parentId}});
    expect(response.status()).toBe(201);return response.json();
  };
  const work=async(projectId,title,withFile=false)=>{
    const multipart={projectId,title,floorNum:'1',summary:'شرح '+title};
    if(withFile)multipart.cover={name:'cover.png',mimeType:'image/png',buffer:png};
    const response=await page.request.post('/api/works',{headers,multipart});
    expect(response.status()).toBe(201);return response.json();
  };
  return {username,user:me.user,headers,project,work};
}

test('project selection, task view and floor survive reload and browser navigation',async({page})=>{
  const data=await setup(page),root=await data.project('پروژه تاریخچه'),child=await data.project('زیرپروژه تاریخچه',root.id);
  await data.work(child.id,'کار زیرپروژه');
  await page.goto('/dashboard');
  await page.getByRole('button',{name:'پروژه‌ها',exact:true}).click();
  await page.getByText(root.name,{exact:true}).click();
  await expect(page).toHaveURL(new RegExp('projectId='+root.id));
  await page.getByText(child.name,{exact:true}).click();
  await expect(page).toHaveURL(new RegExp('projectId='+child.id));
  await page.reload();
  await expect(page.getByRole('button',{name:'کار زیرپروژه',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'پروژه‌ها',exact:true}).click();
  const historyLength=await page.evaluate(()=>history.length);
  await page.getByText(child.name,{exact:true}).click();
  expect(await page.evaluate(()=>history.length)).toBe(historyLength);
  await page.getByRole('button').filter({has:page.locator('svg[data-testid="CloseRoundedIcon"]')}).click();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp('projectId='+root.id));
  await page.goForward();
  await expect(page).toHaveURL(new RegExp('projectId='+child.id));
  await page.getByRole('button',{name:'کارهای شما',exact:true}).click();
  await expect(page).toHaveURL(/view=tasks/);await page.reload();
  await expect(page.getByText('کارهای در دست انجام',{exact:true})).toBeVisible();
  await page.goto('/dashboard?projectId='+child.id+'&floor=1');
  await expect(page.getByText('کارهای در دست انجام',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/floor=1/);
  await page.goBack();await expect(page).toHaveURL(/view=tasks/);
});

test('failed work and report requests show a retry action instead of an empty section',async({page})=>{
  const data=await setup(page),root=await data.project('پروژه خطا'),work=await data.work(root.id,'کار موجود');
  const workUrl='/api/works/'+encodeURIComponent(work.id);
  await page.request.post(workUrl+'/reports',{headers:data.headers,data:{text:'گزارش موجود'}});
  let failWorks=true;
  await page.route('**/api/works?**',route=>failWorks ? route.fulfill({status:503,json:{error:'دریافت اطلاعات موقتاً ممکن نیست.'}}) : route.continue());
  await page.goto('/dashboard?projectId='+root.id);
  await expect(page.getByRole('alert')).toContainText('به معنی خالی‌بودن پروژه نیست');
  await expect(page.getByRole('button',{name:work.title,exact:true})).toHaveCount(0);
  await page.screenshot({path:'test-results/remaining-work-fetch-error.png',animations:'disabled'});
  failWorks=false;await page.getByRole('button',{name:'تلاش دوباره',exact:true}).click();
  await expect(page.getByRole('button',{name:work.title,exact:true})).toBeVisible();
  let failReports=true;
  await page.route('**/reports',route=>failReports ? route.fulfill({status:503,json:{error:'گزارش‌ها دریافت نشدند.'}}) : route.continue());
  await page.goto('/works/'+encodeURIComponent(work.id));
  await expect(page.getByRole('alert')).toContainText('دریافت گزارش‌ها انجام نشد');
  failReports=false;await page.getByRole('button',{name:'تلاش دوباره',exact:true}).click();
  await expect(page.getByText('گزارش موجود',{exact:true})).toBeVisible();
  expect((await (await page.request.get(workUrl+'/reports')).json()).length).toBe(1);
});

test('new and edited report drafts survive reload and leaving the page without duplicate reports',async({page})=>{
  const data=await setup(page),root=await data.project('پروژه پیش‌نویس گزارش');
  const first=await data.work(root.id,'کار اول گزارش'),second=await data.work(root.id,'کار دوم گزارش');
  const firstPath='/works/'+encodeURIComponent(first.id),secondPath='/works/'+encodeURIComponent(second.id);
  await page.goto(firstPath);
  await page.getByRole('button',{name:'اضافه کردن گزارش',exact:true}).click();
  await page.getByLabel('متن گزارش کار',{exact:true}).fill('گزارش طولانی ارسال‌نشده');
  await page.reload();
  await expect(page.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true})).toHaveValue('گزارش طولانی ارسال‌نشده');
  expect((await (await page.request.get('/api'+firstPath+'/reports')).json()).length).toBe(0);
  await page.goto(secondPath);await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(firstPath);
  await expect(page.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true})).toHaveValue('گزارش طولانی ارسال‌نشده');
  await page.getByRole('dialog').getByRole('button',{name:'ایجاد',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('گزارش طولانی ارسال‌نشده',{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'ویرایش گزارش: گزارش طولانی ارسال‌نشده',exact:true}).click();
  await page.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true}).fill('ویرایش حفظ‌شده بعد از رفرش');
  await page.reload();
  await expect(page.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true})).toHaveValue('ویرایش حفظ‌شده بعد از رفرش');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'ویرایش گزارش: گزارش طولانی ارسال‌نشده',exact:true}).click();
  await expect(page.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true})).toHaveValue('ویرایش حفظ‌شده بعد از رفرش');
  await page.getByRole('dialog').getByRole('button',{name:'ذخیره',exact:true}).click();
  await expect(page.getByText('ویرایش حفظ‌شده بعد از رفرش',{exact:true})).toBeVisible();
  const reports=await (await page.request.get('/api'+firstPath+'/reports')).json();
  expect(reports.length).toBe(1);expect(reports[0].text).toBe('ویرایش حفظ‌شده بعد از رفرش');
  await page.getByRole('button',{name:'ویرایش گزارش: ویرایش حفظ‌شده بعد از رفرش',exact:true}).click();
  await page.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true}).fill('ویرایش لغوشده');
  await page.getByRole('dialog').getByRole('button',{name:'انصراف',exact:true}).click();
  await page.getByRole('button',{name:'ویرایش گزارش: ویرایش حفظ‌شده بعد از رفرش',exact:true}).click();
  await expect(page.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true})).toHaveValue('ویرایش حفظ‌شده بعد از رفرش');
});

test('successful report saves clear drafts before a delayed background refresh finishes',async({page})=>{
  const data=await setup(page),root=await data.project('Report refresh regression');
  const work=await data.work(root.id,'Report refresh work');
  await page.goto('/works/'+encodeURIComponent(work.id));
  await page.getByRole('button',{name:'اضافه کردن گزارش',exact:true}).click();
  await page.getByLabel('متن گزارش کار',{exact:true}).fill('Saved report');
  let pausedRefresh=null;
  await page.route('**/reports',async route=>{
    const refresh=pausedRefresh;
    if(route.request().method()==='GET' && refresh) {
      refresh.started();
      await refresh.gate;
    }
    await route.continue();
  });
  const saveDuringRefresh=async button=>{
    let started,release;
    const requested=new Promise(resolve=>{started=resolve;});
    const gate=new Promise(resolve=>{release=resolve;});
    pausedRefresh={started,gate};
    try {
      await button.click();
      await requested;
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(key=>/^report(Draft|Dialog):/.test(key)))).toEqual([]);
    } finally {pausedRefresh=null;release();}
  };
  await saveDuringRefresh(page.getByRole('dialog').getByRole('button',{name:'ایجاد',exact:true}));
  await page.getByRole('button',{name:'ویرایش گزارش: Saved report',exact:true}).click();
  await page.getByRole('dialog').getByLabel('متن گزارش کار',{exact:true}).fill('Updated report');
  await saveDuringRefresh(page.getByRole('dialog').getByRole('button',{name:'ذخیره',exact:true}));
  await expect(page.getByText('Updated report',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Updated report',{exact:true})).toBeVisible();
  expect((await (await page.request.get('/api/works/'+encodeURIComponent(work.id)+'/reports')).json()).length).toBe(1);
});

test('selected files survive full reload and invalid replacements are rejected before submission',async({page})=>{
  test.setTimeout(120000);
  const data=await setup(page),root=await data.project('پروژه فایل موقت');
  await page.goto('/dashboard?projectId='+root.id);
  await page.getByRole('button',{name:'ایجاد کار',exact:true}).click();
  await page.getByLabel(/^عنوان کار/).fill('کار با فایل بازیابی‌شده');
  await page.getByLabel(/^شرح مختصر کار/).fill('شرح فایل');
  await page.getByRole('combobox',{name:/انتخاب طبقه/}).click();await page.getByRole('option',{name:'طبقه اول',exact:true}).click();
  await page.getByLabel('تصویر شاخص کار',{exact:true}).setInputFiles({name:'persisted.png',mimeType:'image/png',buffer:png});
  await expect(page.getByText('persisted.png',{exact:true})).toBeVisible();
  await page.getByLabel('فایل پیوست',{exact:true}).setInputFiles({name:'persisted.txt',mimeType:'text/plain',buffer:Buffer.from('persisted attachment contents')});
  await expect(page.getByText('persisted.txt',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('persisted.png',{exact:true})).toBeVisible();
  await expect(page.getByText('persisted.txt',{exact:true})).toBeVisible();
  await page.getByLabel('تصویر شاخص کار',{exact:true}).setInputFiles({name:'fake.png',mimeType:'image/png',buffer:Buffer.from('this is not an image')});
  await expect(page.getByRole('alert')).toContainText('PNG، JPEG یا WebP');
  await expect(page.getByText('persisted.png',{exact:true})).toBeVisible();
  await page.getByLabel('فایل پیوست',{exact:true}).setInputFiles({name:'too-large.txt',mimeType:'text/plain',buffer:Buffer.alloc(10*1024*1024+1,65)});
  await expect(page.getByRole('alert')).toContainText('حداکثر ۱۰ مگابایت');
  expect((await (await page.request.get('/api/works')).json()).total).toBe(0);
  await page.reload();
  await expect(page.getByText('persisted.txt',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'ایجاد',exact:true}).click();
  await expect(page).toHaveURL(/\/works\//);
  const saved=await (await page.request.get('/api'+new URL(page.url()).pathname)).json();
  expect(await (await page.request.get(saved.cover.url)).body()).toEqual(png);
  expect(await (await page.request.get(saved.attachment.url)).text()).toBe('persisted attachment contents');
  expect(await fileDraftCount(page)).toBe(0);
  await page.goto('/create-work');
  await page.getByLabel('فایل پیوست',{exact:true}).setInputFiles({name:'logout-draft.txt',mimeType:'text/plain',buffer:Buffer.from('discard on logout')});
  await expect(page.getByText('logout-draft.txt',{exact:true})).toBeVisible();
  expect(await fileDraftCount(page)).toBe(1);
  await page.goto('/dashboard');await page.getByRole('button',{name:'خروج از حساب',exact:true}).click();
  await expect(page).toHaveURL(/\/login$/);expect(await fileDraftCount(page)).toBe(0);
  await page.getByLabel('نام کاربری',{exact:true}).fill(data.username);await page.getByLabel('رمز عبور',{exact:true}).fill(password);
  await page.getByLabel('رمز عبور',{exact:true}).press('Enter');await expect(page).toHaveURL(/\/dashboard/);
  await page.goto('/create-work');await expect(page.getByLabel('فایل پیوست',{exact:true})).toBeEnabled();
  await expect(page.getByText('logout-draft.txt',{exact:true})).toHaveCount(0);
});

test('unavailable local file storage shows a warning and still allows an immediate upload',async({page})=>{
  const data=await setup(page),root=await data.project('پروژه بدون ذخیره مرورگر');
  await page.addInitScript(()=>Object.defineProperty(window,'indexedDB',{configurable:true,get(){throw new Error('Storage unavailable for this check');}}));
  await page.goto('/dashboard?projectId='+root.id);await page.getByRole('button',{name:'ایجاد کار',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('بازیابی فایل‌های موقت انجام نشد');
  await page.getByLabel(/^عنوان کار/).fill('کار با ارسال مستقیم');await page.getByLabel(/^شرح مختصر کار/).fill('شرح کار');
  await page.getByRole('combobox',{name:/انتخاب طبقه/}).click();await page.getByRole('option',{name:'طبقه اول',exact:true}).click();
  await page.getByLabel('تصویر شاخص کار',{exact:true}).setInputFiles({name:'direct.png',mimeType:'image/png',buffer:png});
  await expect(page.getByText('direct.png',{exact:true})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('ذخیره موقت فایل در مرورگر انجام نشد');
  await page.getByRole('button',{name:'ایجاد',exact:true}).click();await expect(page).toHaveURL(/\/works\//);
  const saved=await (await page.request.get('/api'+new URL(page.url()).pathname)).json();
  expect(await (await page.request.get(saved.cover.url)).body()).toEqual(png);
});

test('removing a responsibility retains access and explicit revocation removes subtree and file access',async({page,browser})=>{
  const owner=await setup(page),root=await owner.project('پروژه دسترسی'),child=await owner.project('زیرپروژه دسترسی',root.id);
  const work=await owner.work(child.id,'کار دارای مسئول',true),workPath='/api/works/'+encodeURIComponent(work.id);
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5190'}),member=await context.newPage();
  try {
    await register(member);
    const me=await (await member.request.get('/api/auth/me')).json();
    const memberHeaders={Origin:'http://127.0.0.1:5190','X-CSRF-Token':me.csrfToken};
    expect((await page.request.post('/api/projects/'+root.id+'/members',{headers:owner.headers,data:{identifier:me.user.username}})).status()).toBe(201);
    await page.request.put(workPath+'/assignees',{headers:owner.headers,data:{userIds:[me.user.id]}});
    await member.request.post(workPath+'/reports',{headers:memberHeaders,data:{text:'گزارش عضو پیش از لغو دسترسی'}});
    expect((await member.request.get(work.cover.url)).status()).toBe(200);
    await page.goto('/works/'+encodeURIComponent(work.id));
    await page.getByRole('button',{name:'ویرایش مسئولین',exact:true}).click();
    await expect(page.getByRole('dialog')).toContainText('دسترسی او به پروژه را قطع نمی‌کند');
    await page.getByRole('button',{name:'حذف مسئولیت '+me.user.name,exact:true}).click();
    await expect(page.getByRole('list',{name:'مسئولان این کار'}).getByText(me.user.name,{exact:true})).toHaveCount(0);
    expect((await member.request.get(workPath)).status()).toBe(200);
    expect((await member.request.get(work.cover.url)).status()).toBe(200);
    await page.getByRole('button',{name:'لغو دسترسی '+me.user.name,exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'انصراف',exact:true}).click();
    expect((await member.request.get(workPath)).status()).toBe(200);
    await page.getByRole('button',{name:'لغو دسترسی '+me.user.name,exact:true}).click();
    await expect(page.getByRole('dialog')).toContainText('همه زیرپروژه‌های آن');
    await page.screenshot({path:'test-results/remaining-revoke-access.png',animations:'disabled'});
    await page.getByRole('dialog').getByRole('button',{name:'لغو دسترسی',exact:true}).click();
    await expect(page.getByRole('button',{name:'لغو دسترسی '+me.user.name,exact:true})).toHaveCount(0);
    for(const url of ['/api/projects/'+root.id,'/api/projects/'+child.id,workPath,work.cover.url])expect((await member.request.get(url)).status()).toBe(404);
    const preserved=await (await page.request.get(workPath+'/reports')).json();expect(preserved.length).toBe(1);
  } finally {await context.close();}
});

test('login and signup submit with Enter and errors remain until dismissal or another attempt',async({page})=>{
  await isolateClient(page);
  await page.goto('/login');
  await page.clock.install();
  await page.route('**/api/auth/login',route=>route.fulfill({status:401,json:{error:'نام کاربری یا رمز عبور اشتباه است.'}}));
  await page.getByLabel('نام کاربری',{exact:true}).fill('wrong_username');
  await page.getByLabel('رمز عبور',{exact:true}).fill('wrong-password');
  await page.getByLabel('رمز عبور',{exact:true}).press('Enter');
  await expect(page.getByRole('alert')).toContainText('نام کاربری یا رمز عبور اشتباه است.');
  await page.clock.fastForward(12000);
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button',{name:'بستن پیام خطا',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.unroute('**/api/auth/login');
  const username='enter_'+randomUUID().slice(0,8);
  await page.getByRole('button',{name:'ثبت نام',exact:true}).click();
  await page.getByLabel('نام',{exact:true}).fill('کاربر');await page.getByLabel('نام خانوادگی',{exact:true}).fill('کلید ورود');
  await page.getByLabel('نام کاربری',{exact:true}).fill(username);
  await page.getByLabel('رمز عبور',{exact:true}).fill(password);
  await page.getByLabel('تکرار رمز عبور',{exact:true}).fill('mismatched-password');
  await page.getByLabel('تکرار رمز عبور',{exact:true}).press('Enter');
  await page.clock.fastForward(12000);await expect(page.getByRole('alert')).toContainText('تکرار رمز عبور');
  await page.getByLabel('تکرار رمز عبور',{exact:true}).fill(password);
  await page.getByLabel('تکرار رمز عبور',{exact:true}).press('Enter');
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole('button',{name:'خروج از حساب',exact:true}).click();await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('نام کاربری',{exact:true}).fill(username);await page.getByLabel('رمز عبور',{exact:true}).fill(password);
  await page.getByLabel('رمز عبور',{exact:true}).press('Enter');
  await expect(page).toHaveURL(/\/dashboard/);
});
