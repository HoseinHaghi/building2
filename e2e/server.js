import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'building-browser-'));
const app=createApp({databasePath:path.join(directory,'app.sqlite'),uploadsDir:path.join(directory,'uploads'),
  // Each browser context supplies a distinct client IP through this loopback-only test server.
  origin:'http://127.0.0.1:5190',production:false,secureCookies:false,trustProxy:'loopback'});
const server=app.listen(5190,'127.0.0.1',()=>console.log('Browser test server ready'));
let stopping=false;
function stop(){if(stopping)return;stopping=true;server.close(()=>{app.locals.db.close();fs.rmSync(directory,{recursive:true,force:true});process.exit(0);});server.closeIdleConnections();}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
