#!/usr/bin/env node
/* Baseline security regression suite. It intentionally asserts the desired secure behavior.
 * Run with: node security-audit.test.js
 * On the pre-remediation baseline, failures are expected and are recorded in the audit report.
 */
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const port = 8810 + Math.floor(Math.random() * 100);
const base = `http://127.0.0.1:${port}`;
const failures = [];
const checks = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function req(p, options = {}) { const r = await fetch(base + p, options); const text = await r.text(); let body; try { body = JSON.parse(text); } catch { body = { text }; } return { status: r.status, headers: r.headers, body }; }
function cookieFrom(r) { return r.headers.get('set-cookie')?.split(';')[0] || ''; }
async function expect(name, fn) { try { const ok = await fn(); checks.push({ name, ok: Boolean(ok) }); if (!ok) failures.push(name); } catch (e) { checks.push({ name, ok: false, error: e.message }); failures.push(name); } }
async function main() {
  const child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env: { ...process.env, NODE_ENV: 'production', PORT: String(port), SUPERADMIN_PASSWORD: 'Audit-Admin-Password-2026!', SUPERADMIN_IDENTIFIER: 'audit-admin@example.test', BOOTSTRAP_SHOPKEEPER_PASSWORD: 'Audit-Shopkeeper-Password-2026!', BOOTSTRAP_SHOPKEEPER_IDENTIFIER: 'audit-shopkeeper@example.test', PAYMENT_WEBHOOK_SECRET: 'audit-secret', CASHFREE_CLIENT_ID: 'audit-client', CASHFREE_CLIENT_SECRET: 'audit-secret' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let ready = false; child.stdout.on('data', d => { if (String(d).includes('running')) ready = true; });
  child.stderr.on('data', d => process.stderr.write(String(d)));
  for (let i = 0; i < 60 && !ready; i++) { await sleep(100); try { if ((await req('/api/shops/demo-shop')).status === 200) ready = true; } catch {} }
  if (!ready) throw new Error('server did not start');
  const login = await req('/api/shopkeeper/login', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ identifier: 'audit-shopkeeper@example.test', password: 'Audit-Shopkeeper-Password-2026!' }) });
  const shopCookie = cookieFrom(login);
  await expect('public order endpoint does not disclose private order data', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const form = new FormData(); form.append('shopId', 'demo-shop'); form.append('file', new Blob([png], { type: 'image/png' }), 'audit.png');
    const up = await req('/api/uploads', { method: 'POST', body: form });
    const order = await req('/api/orders', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ shopId:'demo-shop', uploadRef:up.body.uploadRef, printType:'bw', copies:1, pageSelection:{mode:'all'}, paymentMethod:'cash' }) });
    const publicRead = await req('/api/orders/' + order.body.order.id);
    return publicRead.status === 401 || publicRead.status === 403 || publicRead.status === 404;
  });
  await expect('payment callback ignores client-supplied verified flag', async () => {
    const started = await req('/api/shopkeeper/payment/connect', { method:'POST', headers:{'content-type':'application/json', cookie:shopCookie}, body:JSON.stringify({provider:'cashfree'}) });
    if (started.status !== 202) return true; // safe if provider cannot start
    const callback = await req('/api/shopkeeper/payment/callback', { method:'POST', headers:{'content-type':'application/json', cookie:shopCookie}, body:JSON.stringify({ onboardingId: started.body.onboardingId, merchantAccountId:'attacker-account', verified:true }) });
    return callback.status >= 400;
  });
  await expect('webhook with missing amount is rejected', async () => {
    const payload = JSON.stringify({ eventId:'audit-missing-amount-' + Date.now(), orderId:'ord_nonexistent', status:'PAID' });
    const signature = crypto.createHmac('sha256','audit-secret').update(payload).digest('hex');
    const r = await req('/api/webhooks/cashfree', {method:'POST', headers:{'content-type':'application/json','x-webhook-signature':signature}, body:payload});
    return r.status >= 400;
  });
  await expect('CORS does not reflect arbitrary origins', async () => {
    const r = await req('/api/shops/demo-shop', {headers:{origin:'https://attacker.example'}});
    return r.headers.get('access-control-allow-origin') !== 'https://attacker.example';
  });
  await expect('production server does not accept public demo credentials', async () => {
    const r = await req('/api/superadmin/login', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({identifier:'admin@printerauto.local', password:'Admin123!'})});
    return r.status !== 200;
  });
  child.kill('SIGTERM');
  await new Promise(r => child.once('exit', r));
  console.log(JSON.stringify({ checks, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
}
main().catch(e => { console.error(e.stack); process.exitCode = 2; });
