import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { id,now,text,fail } from '../domain.js';
import { hashPassword,verifyPassword,digest,randomToken,cookieToken,publicUser } from '../security.js';

export function authRoutes(db,config,requireAuth,csrf) {
  const router=Router();
  const limiter=rateLimit({ windowMs:15*60*1000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,
    message:{ error:'تعداد تلاش‌ها زیاد است. چند دقیقه دیگر دوباره تلاش کنید.' } });
  const dummyHash=hashPassword(randomToken());
  const cookieName=config.secureCookies ? '__Host-building_session' : 'building_session';
  const cookieOptions={ httpOnly:true,secure:config.secureCookies,sameSite:'lax',path:'/' };
  const session=(req,res,user) => {
    const previous=cookieToken(req);
    if (previous) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(previous));
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    const token=randomToken(),csrfToken=randomToken();
    db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),user.id,csrfToken,Date.now()+config.sessionMs);
    res.cookie(cookieName,token,{ ...cookieOptions,maxAge:config.sessionMs });
    res.json({ user:publicUser(user),csrfToken });
  };
  const validPassword=password=>{
    if (typeof password !== 'string' || password.length<10 || password.length>128) fail(400,'رمز عبور باید بین ۱۰ تا ۱۲۸ نویسه باشد.');
    return password;
  };
  router.post('/register',limiter,async(req,res)=>{
    if (!config.registration) fail(403,'ثبت‌نام عمومی غیرفعال است.');
    const name=text(req.body.name,'نام',100);
    const username=text(req.body.username,'نام کاربری',40).toLowerCase();
    const email=req.body.email == null || req.body.email === '' ? null : text(req.body.email,'ایمیل',254).toLowerCase();
    if (!/^[a-z0-9_]{3,40}$/.test(username)) fail(400,'نام کاربری باید ۳ تا ۴۰ حرف انگلیسی، عدد یا زیرخط باشد.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400,'ایمیل معتبر نیست.');
    const password=validPassword(req.body.password);
    const hash=await hashPassword(password);
    // The unique database constraints handle concurrent registration too.
    try { db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(id(),name,username,email,hash,now()); }
    catch(error) { if (error.errcode===19 || error.errcode===2067) fail(409,'نام کاربری یا ایمیل قبلاً ثبت شده است.'); throw error; }
    const user=db.prepare('SELECT * FROM users WHERE username=?').get(username);
    res.status(201); session(req,res,user);
  });
  router.post('/login',limiter,async(req,res)=>{
    const identifier=text(req.body.identifier ?? req.body.email,'نام کاربری یا ایمیل',254).toLowerCase();
    const password=typeof req.body.password==='string' && req.body.password.length<=128 ? req.body.password : '';
    const user=db.prepare('SELECT * FROM users WHERE email=? OR username=?').get(identifier,identifier);
    const valid=await verifyPassword(password,user?.password_hash || await dummyHash);
    if (!user || !valid) fail(401,'نام کاربری یا رمز عبور اشتباه است.');
    session(req,res,user);
  });
  router.get('/me',requireAuth,(req,res)=>res.json({ user:publicUser(req.user),csrfToken:req.session.csrf }));
  router.post('/logout',requireAuth,csrf,(req,res)=>{
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(req.session.token_hash);
    res.clearCookie(cookieName,cookieOptions); res.status(204).end();
  });
  router.patch('/profile',requireAuth,csrf,(req,res)=>{
    const name=text(req.body.name,'نام',100);
    db.prepare('UPDATE users SET name=? WHERE id=?').run(name,req.user.id);
    res.json({ user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
  });
  router.post('/password',limiter,requireAuth,csrf,async(req,res)=>{
    if (typeof req.body.currentPassword!=='string' || req.body.currentPassword.length>128 ||
        !await verifyPassword(req.body.currentPassword,req.user.password_hash)) fail(400,'رمز فعلی اشتباه است.');
    const hash=await hashPassword(validPassword(req.body.password));
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash,req.user.id);
    db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.user.id);
    session(req,res,db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id));
  });
  return router;
}
