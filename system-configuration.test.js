#!/usr/bin/env node
const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const port = 9077;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'printer-system-config-'));
const env = { ...process.env, NODE_ENV: 'production', PORT: String(port), PRINTER_AUTO_DATA_DIR: dataDir, SUPERADMIN_IDENTIFIER: 'config-admin@example.test', SUPERADMIN_PASSWORD: 'Config-Admin-Password-2026!', TRUSTED_ORIGINS: 'https://admin.example.test', AI_API_KEY: 'fake-secret-must-not-leak', PERSISTENCE_BACKEND: 'local' };
const child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore', 'ignore', 'pipe'] });
const base = `http://127.0.0.1:${port}`;
let cookie = '';
function applyCookies(headers) { const values = headers.getSetCookie ? headers.getSetCookie() : []; if (values.length) cookie = values.map(x => x.split(';')[0]).join('; '); }
async function request(url, options = {}) { const headers = new Headers(options.headers || {}); if (cookie) headers.set('cookie', cookie); const r = await fetch(base + url, { ...options, headers }); applyCookies(r.headers); const text = await r.text(); let body; try { body = JSON.parse(text); } catch { body = text; } return { status: r.status, body, headers }; }
async function waitReady() { for (let i = 0; i < 50; i++) { try { const r = await fetch(base + '/api/shops/demo-shop'); if (r.status) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw Error('server did not start'); }
(async () => {
  try {
    await waitReady();
    let r = await request('/api/superadmin/system-config'); assert.strictEqual(r.status, 401, 'configuration overview must be protected');
    r = await request('/api/superadmin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: env.SUPERADMIN_IDENTIFIER, password: env.SUPERADMIN_PASSWORD }) }); assert.strictEqual(r.status, 200);
    const csrf = decodeURIComponent(cookie.match(/csrf_token=([^;]+)/)[1]);
    r = await request('/api/superadmin/system-config'); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.categories.length, 12); assert.ok(!JSON.stringify(r.body).includes('fake-secret-must-not-leak')); assert.ok(r.body.categories.some(x => x.id === 'database')); assert.ok(r.body.categories.some(x => x.id === 'setup'));
    r = await request('/api/superadmin/system-config/guide?q=storage'); assert.strictEqual(r.status, 200); assert.ok(r.body.guide.some(x => x.id === 'storage'));
    r = await request('/api/superadmin/system-config/test', { method: 'POST', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ target: 'database' }) }); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.result.status, 'BLOCKED_EXTERNAL_SETUP');
    r = await request('/api/superadmin/system-config/runtime', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ uploadMaxMb: 9999 }) }); assert.strictEqual(r.status, 400);
    r = await request('/api/superadmin/system-config/runtime', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-csrf-token': csrf }, body: JSON.stringify({ TRUSTED_ORIGINS: '*' }) }); assert.strictEqual(r.status, 400);
    r = await request('/api/superadmin/system-config/audit'); assert.strictEqual(r.status, 200); assert.ok(r.body.changes.some(x => x.action === 'TEST_DATABASE'));
    r = await request('/api/superadmin/system-config/unknown'); assert.strictEqual(r.status, 404);
    console.log(JSON.stringify({ ok: true, assertions: ['admin authorization', '12-category overview', 'guide search', 'secret redaction', 'blocked database test status', 'runtime bounds', 'security setting immutability', 'configuration audit history'] }, null, 2));
  } finally { child.kill('SIGTERM'); fs.rmSync(dataDir, { recursive: true, force: true }); }
})().catch(error => { console.error(error.stack || error); child.kill('SIGTERM'); fs.rmSync(dataDir, { recursive: true, force: true }); process.exitCode = 1; });
