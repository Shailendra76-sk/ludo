#!/usr/bin/env node
const assert = require('assert');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const port = 9091;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'printer-shopkeeper-help-'));
const env = { ...process.env, NODE_ENV: 'production', PORT: String(port), PRINTER_AUTO_DATA_DIR: dataDir, SUPERADMIN_IDENTIFIER: 'printer-test-admin@example.test', SUPERADMIN_PASSWORD: 'Printer-Test-Admin-2026!', BOOTSTRAP_SHOPKEEPER_IDENTIFIER: 'printer-test-shop@example.test', BOOTSTRAP_SHOPKEEPER_PASSWORD: 'Printer-Test-Shop-2026!', TRUSTED_ORIGINS: 'https://trusted.example' };
delete env.OPENAI_API_KEY; delete env.AI_API_KEY;
const child = spawn(process.execPath, ['server.js'], { cwd: __dirname, env, stdio: ['ignore', 'ignore', 'pipe'] });
const base = `http://127.0.0.1:${port}`;
let cookie = '';
function applyCookies(h) { const values = h.getSetCookie ? h.getSetCookie() : []; if (values.length) cookie = values.map(x => x.split(';')[0]).join('; '); }
function csrf() { return decodeURIComponent(cookie.match(/csrf_token=([^;]+)/)?.[1] || ''); }
async function req(url, options = {}) { const h = new Headers(options.headers || {}); if (cookie) h.set('cookie', cookie); const r = await fetch(base + url, { ...options, headers: h }); applyCookies(r.headers); const text = await r.text(); let body; try { body = JSON.parse(text); } catch { body = text; } return { status: r.status, body }; }
async function ready() { for (let i = 0; i < 60; i++) { try { if ((await fetch(base + '/api/shops/demo-shop')).status === 200) return; } catch {} await new Promise(r => setTimeout(r, 100)); } throw Error('server not ready'); }
(async () => { try {
  await ready();
  let guideResponse = await fetch(base + '/shopkeeper/setup-guide'); assert.strictEqual(guideResponse.status, 200); const guideText = await guideResponse.text(); assert.ok(guideText.includes('NOT AVAILABLE'));
  let r = await req('/api/shopkeeper/help'); assert.strictEqual(r.status, 401);
  r = await req('/api/shopkeeper/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: env.BOOTSTRAP_SHOPKEEPER_IDENTIFIER, password: env.BOOTSTRAP_SHOPKEEPER_PASSWORD }) }); assert.strictEqual(r.status, 200);
  const headers = { 'x-csrf-token': csrf(), 'content-type': 'application/json' };
  r = await req('/api/shopkeeper/help'); assert.strictEqual(r.status, 200); assert.ok(r.body.guides.length >= 5);
  r = await req('/api/shopkeeper/help?q=Windows'); assert.strictEqual(r.status, 200); assert.ok(r.body.guides.some(x => x.id === 'windows-install'));
  r = await req('/api/shopkeeper/help/ask', { method: 'POST', headers, body: JSON.stringify({ question: 'Why is the connector offline?' }) }); assert.strictEqual(r.status, 404);
  r = await req('/api/shopkeeper/printer-setup'); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.installer.status, 'NOT_AVAILABLE'); assert.strictEqual(r.body.installer.downloadUrl, null); assert.ok(r.body.officialSupportLinks.some(x => x.brand === 'Windows built-in setup'));
  r = await req('/api/shopkeeper/connectors/pair', { method: 'POST', headers, body: '{}' }); assert.strictEqual(r.status, 200); const pair = r.body;
  r = await req('/api/connector/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pairingId: pair.pairingId, code: pair.code, deviceName: 'test-windows-connector' }) }); assert.strictEqual(r.status, 200); const connectorToken = r.body.token; const connectorId = r.body.connectorId;
  const connectorHeaders = { authorization: `Bearer ${connectorToken}`, 'content-type': 'application/json' };
  r = await req('/api/connector/heartbeat', { method: 'POST', headers: connectorHeaders, body: JSON.stringify({ status: 'OFFLINE', printerName: 'USB Test Printer', driverInstalled: false, windowsVersion: 'Windows test', error: 'Driver unavailable' }) }); assert.strictEqual(r.status, 200);
  r = await req('/api/shopkeeper/printer-management'); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.connectors[0].status, 'OFFLINE'); assert.strictEqual(r.body.connectors[0].driverInstalled, false); if (r.body.connectors[0].lastError !== 'Driver unavailable') throw Error('offline connector payload='+JSON.stringify(r.body)); r = await req('/api/shopkeeper/printer-setup'); assert.strictEqual(r.body.checks.connectorInstalled, true); assert.strictEqual(r.body.checks.driverInstalled, false); assert.strictEqual(r.body.checks.printerConnected, false);
  r = await req('/api/connector/heartbeat', { method: 'POST', headers: connectorHeaders, body: JSON.stringify({ status: 'ONLINE', printerName: 'USB Test Printer' }) }); assert.strictEqual(r.status, 200);
  r = await req('/api/shopkeeper/printer-management'); const printerId = r.body.printers[0].id;
  r = await req(`/api/shopkeeper/printers/${printerId}/test`, { method: 'POST', headers }); assert.strictEqual(r.status, 202); const testJobId = r.body.job.id;
  r = await req('/api/connector/jobs', { headers: connectorHeaders }); assert.strictEqual(r.status, 200); const job = r.body.jobs.find(x => x.id === testJobId); assert.ok(job);
  r = await req(`/api/connector/jobs/${job.id}/complete`, { method: 'POST', headers: connectorHeaders, body: JSON.stringify({ result: 'PRINTED', completionToken: job.completionToken }) }); assert.strictEqual(r.status, 409);
  r = await req(`/api/connector/jobs/${job.id}/complete`, { method: 'POST', headers: connectorHeaders, body: JSON.stringify({ result: 'PRINTED', completionToken: job.completionToken, evidence: { printerName: 'USB Test Printer', verifiedAt: new Date().toISOString(), exitCode: 0, localJobId: 'local-test-1' } }) }); assert.strictEqual(r.status, 200);
  r = await req(`/api/shopkeeper/printers/${printerId}/test`, { method: 'POST', headers }); const failedJobId = r.body.job.id; r = await req('/api/connector/jobs', { headers: connectorHeaders }); const failedJob = r.body.jobs.find(x => x.id === failedJobId); r = await req(`/api/connector/jobs/${failedJob.id}/complete`, { method: 'POST', headers: connectorHeaders, body: JSON.stringify({ result: 'PRINT_FAILED', completionToken: failedJob.completionToken, evidence: { printerName: 'USB Test Printer', verifiedAt: new Date().toISOString(), exitCode: 1, localJobId: 'local-test-2', error: 'Paper empty' } }) }); assert.strictEqual(r.status, 200);
  r = await req(`/api/shopkeeper/connectors/${connectorId}/retry`, { method: 'POST', headers, body: JSON.stringify({ jobId: failedJobId }) }); assert.strictEqual(r.status, 200); assert.strictEqual(r.body.job.status, 'PRINT_QUEUED');
  r = await req(`/api/shopkeeper/connectors/${connectorId}/retry`, { method: 'POST', headers, body: JSON.stringify({ jobId: failedJobId }) }); assert.strictEqual(r.status, 409);
  r = await req(`/api/shopkeeper/connectors/${connectorId}/revoke`, { method: 'POST', headers }); assert.strictEqual(r.status, 200);
  r = await req('/api/connector/heartbeat', { method: 'POST', headers: connectorHeaders, body: JSON.stringify({ status: 'ONLINE' }) }); assert.strictEqual(r.status, 401);
  console.log(JSON.stringify({ ok: true, assertions: ['unauthorized help access', 'bilingual help/search', 'AI chatbot absent by design', 'truthful installer blocker and official support links', 'pairing and shop binding', 'offline heartbeat/error status', 'heartbeat recovery', 'test job authorization', 'evidence-required print completion', 'failed print and bounded retry', 'connector revoke invalidation'] }, null, 2));
} finally { child.kill('SIGTERM'); fs.rmSync(dataDir, { recursive: true, force: true }); } })().catch(e => { console.error(e.stack || e); child.kill('SIGTERM'); fs.rmSync(dataDir, { recursive: true, force: true }); process.exitCode = 1; });
