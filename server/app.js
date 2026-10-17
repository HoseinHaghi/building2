import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { openDatabase } from './db.js';
import { configuration } from './config.js';
import { digest,cookieToken,safeEqual } from './security.js';
import { fail,accessWork,HttpError } from './domain.js';
import { authRoutes } from './routes/auth.js';
import { projectRoutes } from './routes/projects.js';
import { workRoutes } from './routes/works.js';

export function createApp(options={}) {
  const config=configuration(options),db=openDatabase(config.databasePath),app=express();
  fs.mkdirSync(config.uploadsDir,{recursive:true,mode:0o700});
  app.locals.config=config; app.locals.db=db;
  app.disable('x-powered-by'); app.set('trust proxy',config.trustProxy);
  app.use((req,res,next)=>{ req.requestId=randomUUID(); res.setHeader('X-Request-Id',req.requestId); next(); });
  app.use(helmet({ contentSecurityPolicy:{ directives:{
    defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],
    imgSrc:["'self'","data:","blob:"],fontSrc:["'self'"],connectSrc:["'self'"],
    objectSrc:["'none'"],frameAncestors:["'none'"],upgradeInsecureRequests:config.production ? [] : null,
  } },strictTransportSecurity:config.production ? undefined : false }));
  app.use(compression());
  app.use('/api',(req,res,next)=>{
    res.setHeader('Cache-Control','no-store');
    const origin=req.get('Origin');
    if(origin && origin!==config.origin) return next(Object.assign(new Error('مبدأ درخواست مجاز نیست.'),{status:403}));
    // Origin validation also protects anonymous login and registration from cross-site submissions.
    if(!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('Sec-Fetch-Site')==='cross-site')
      return next(Object.assign(new Error('درخواست از سایت دیگر مجاز نیست.'),{status:403}));
    next();
  });
  app.use('/api',rateLimit({ windowMs:60000,limit:300,standardHeaders:'draft-8',legacyHeaders:false,
    message:{error:'تعداد درخواست‌ها زیاد است. یک دقیقه دیگر تلاش کنید.'} }));
  app.use(express.json({limit:'64kb'}));
  app.use((req,_res,next)=>{req.body ??= {}; next();});
  const requireAuth=(req,res,next)=>{
    const token=cookieToken(req);
    if(!token) fail(401,'برای ادامه وارد حساب شوید.');
    const session=db.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_at>?').get(digest(token),Date.now());
    if(!session) fail(401,'نشست شما منقضی شده است. دوباره وارد شوید.');
    req.session=session; req.user=db.prepare('SELECT * FROM users WHERE id=?').get(session.user_id);
    if(!req.user) fail(401,'برای ادامه وارد حساب شوید.');
    next();
  };
  const csrf=(req,res,next)=>{
    if(!['GET','HEAD','OPTIONS'].includes(req.method) && !safeEqual(req.get('X-CSRF-Token'),req.session.csrf))
      fail(403,'درخواست معتبر نیست. صفحه را تازه‌سازی کنید.');
    next();
  };
  app.get('/api/health',(_req,res)=>{ db.prepare('SELECT 1').get(); res.json({ok:true}); });
  app.use('/api/auth',authRoutes(db,config,requireAuth,csrf));
  app.use('/api',requireAuth,csrf,projectRoutes(db),workRoutes(db,config));
  app.get('/api/files/:id',(req,res)=>{
    const file=db.prepare('SELECT * FROM files WHERE id=?').get(req.params.id);
    if(!file) fail(404,'فایل یافت نشد.');
    accessWork(db,file.work_id,req.user.id);
    const filename=path.join(config.uploadsDir,file.filename);
    if(!fs.existsSync(filename)) fail(404,'فایل در فضای ذخیره‌سازی موجود نیست.');
    res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
    if(file.kind==='attachment') { res.attachment(file.original_name); res.type('application/octet-stream'); }
    else { res.type(file.mime); res.setHeader('Content-Disposition','inline'); }
    res.sendFile(filename);
  });
  app.use('/api',(_req,res)=>res.status(404).json({error:'مسیر API یافت نشد.'}));
  if(fs.existsSync(path.join(config.distDir,'index.html'))) {
    app.use('/assets',express.static(path.join(config.distDir,'assets'),{immutable:true,maxAge:'1y',fallthrough:false}));
    app.use(express.static(config.distDir,{index:false,maxAge:0}));
    app.get('/{*path}',(req,res,next)=>{
      if(req.path.startsWith('/uploads/') || path.extname(req.path)) return next();
      res.setHeader('Cache-Control','no-cache'); res.sendFile(path.join(config.distDir,'index.html'));
    });
  }
  app.use((_req,res)=>res.status(404).json({error:'مسیر یافت نشد.'}));
  app.use((error,req,res,_next)=>{
    let status=error.status || 500,message=error.message;
    if(error instanceof multer.MulterError) { status=400; message=error.code==='LIMIT_FILE_SIZE' ? 'حجم هر فایل باید حداکثر ۱۰ مگابایت باشد.' : 'فایل‌ها یا فیلدهای ارسال‌شده معتبر نیستند.'; }
    if(error.type==='entity.parse.failed') { status=400; message='بدنه‌ی درخواست JSON معتبر نیست.'; }
    if(status>=500) { console.error(JSON.stringify({requestId:req.requestId,message:error.message})); if(!(error instanceof HttpError))message='خطای سرور. دوباره تلاش کنید.'; }
    if(res.headersSent) return _next(error);
    res.status(status).json({error:message,requestId:req.requestId});
  });
  return app;
}
