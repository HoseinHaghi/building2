import { defineConfig,devices } from '@playwright/test';
export default defineConfig({
  testDir:'./e2e',testMatch:'*.spec.js',fullyParallel:false,workers:1,timeout:60000,
  expect:{timeout:10000},reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:5190',trace:'retain-on-failure',screenshot:'only-on-failure'},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:{command:'node e2e/server.js',url:'http://127.0.0.1:5190/api/health',reuseExistingServer:false,timeout:60000},
});
