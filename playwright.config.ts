import { defineConfig, devices } from '@playwright/test';
import { randomUUID } from 'node:crypto';
const e2ePort=process.env.E2E_PORT??'3000';
const e2eOrigin=`http://127.0.0.1:${e2ePort}`;
if(process.env.RUN_AUTHENTICATED_E2E==='true'){
 if(!process.env.TEST_DATABASE_URL)throw new Error('Authenticated E2E needs a separate migrated TEST_DATABASE_URL.');
 process.env.E2E_DIST_DIR='.next-e2e';
 process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;
 process.env.E2E_AUTH_SECRET??=randomUUID()+randomUUID();
 process.env.NEXTAUTH_SECRET=process.env.E2E_AUTH_SECRET;
 process.env.NEXTAUTH_URL=e2eOrigin;
 process.env.E2E_SIGNING_SECRET??=randomUUID()+randomUUID();
 process.env.E2E_BUDGET_ID??=`e2e-${randomUUID()}`;
 process.env.AI_MODE='mock';process.env.AI_SIGNING_SECRET=process.env.E2E_SIGNING_SECRET;
 process.env.AI_BUDGET_ID=process.env.E2E_BUDGET_ID;
}
export default defineConfig({
 testDir: './tests/e2e', fullyParallel: false, workers:1,
 use: { baseURL: e2eOrigin, trace: 'retain-on-failure', screenshot:'only-on-failure', launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ['--no-sandbox','--disable-dev-shm-usage'] } : {} },
 projects: [{name:'chromium', use:{...devices['Desktop Chrome']}}],
 webServer: { command: `npm run dev -- --port ${e2ePort}`, url: e2eOrigin, reuseExistingServer: !process.env.CI&&process.env.RUN_AUTHENTICATED_E2E!=='true', timeout: 120000 }
});
