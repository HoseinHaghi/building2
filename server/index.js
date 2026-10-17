import { createApp } from './app.js';
const app=createApp(),config=app.locals.config;
const server=app.listen(config.port,config.host,()=>console.log(`Building listening on ${config.host}:${config.port}`));
server.requestTimeout=30000; server.headersTimeout=15000;
const cleanup=setInterval(()=>app.locals.db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now()),3600000);
cleanup.unref();
let stopping=false;
function stop() {
  if(stopping) return; stopping=true; clearInterval(cleanup);
  server.close(()=>{ app.locals.db.close(); process.exit(0); });
  server.closeIdleConnections();
  setTimeout(()=>process.exit(1),10000).unref();
}
process.on('SIGTERM',stop); process.on('SIGINT',stop);
