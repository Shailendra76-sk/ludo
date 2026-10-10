const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SupabaseRest {
  constructor(url, serviceKey) { this.url = String(url).replace(/\/$/, ''); this.serviceKey = serviceKey; }
  async request(resource, options = {}) { const headers = { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, ...(options.headers || {}) }; const init = { ...options, headers }; if (options.body && typeof options.body.pipe === 'function') init.duplex = 'half'; const r = await fetch(`${this.url}${resource}`, init); const text = await r.text(); let body; try { body = JSON.parse(text); } catch { body = text; } if (!r.ok) throw Object.assign(new Error('SUPABASE_REQUEST_FAILED'), { status: r.status, body }); return body; }
  rpc(name, args) { return this.request(`/rest/v1/rpc/${encodeURIComponent(name)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) }); }
  upload(bucket, objectKey, filePath, mimeType) { const body = fs.createReadStream(filePath); return this.request(`/storage/v1/object/${encodeURIComponent(bucket)}/${objectKey.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', headers: { 'Content-Type': mimeType, 'x-upsert': 'false' }, body }); }
  sign(bucket, objectKey, expiresIn = 120) { return this.request(`/storage/v1/object/sign/${encodeURIComponent(bucket)}/${objectKey.split('/').map(encodeURIComponent).join('/')}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn }) }); }
  remove(bucket, objectKey) { return this.request(`/storage/v1/object/${encodeURIComponent(bucket)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [objectKey] }) }); }
}

function encryptionKey() {
  const raw = process.env.APP_ENCRYPTION_KEY || '';
  if (!raw) return null;
  try { if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex'); const b = Buffer.from(raw, 'base64'); return b.length === 32 ? b : null; } catch { return null; }
}
function encrypt(value, key) { const nonce = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce); const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return { ciphertext: ciphertext.toString('base64'), nonce: nonce.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), keyVersion: process.env.APP_ENCRYPTION_KEY_VERSION || 'v1' }; }
function decrypt(record, key) { const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(record.nonce, 'base64')); decipher.setAuthTag(Buffer.from(record.authTag, 'base64')); return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]).toString('utf8'); }

module.exports = function registerProductionReadiness(ctx) {
  const { app, ROOT, id, now, logActivity } = ctx;
  const DATA_DIR = path.join(ROOT, 'storage');
  const VAULT_FILE = path.join(DATA_DIR, 'secret-vault.json');
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const persistenceBackend = String(process.env.PERSISTENCE_BACKEND || 'local').toLowerCase();
  const storageBucket = String(process.env.SUPABASE_STORAGE_BUCKET || 'print-files');
  const durableRequired = process.env.REQUIRE_DURABLE_PERSISTENCE === 'true';
  const runtimeMigrationComplete = process.env.SUPABASE_RUNTIME_MIGRATION_COMPLETE === 'true';
  if (durableRequired && (!supabaseConfigured || persistenceBackend !== 'supabase' || !runtimeMigrationComplete)) throw new Error('DURABLE_SUPABASE_PERSISTENCE_REQUIRED');
  const supabase = supabaseConfigured ? new SupabaseRest(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY) : null;
  const CLEANUP_FILE = path.join(DATA_DIR, 'storage-cleanup-jobs.json'); let cleanupJobs = {}; try { cleanupJobs = JSON.parse(fs.readFileSync(CLEANUP_FILE, 'utf8')); } catch {} const saveCleanup = () => { fs.writeFileSync(CLEANUP_FILE, JSON.stringify(cleanupJobs, null, 2), { mode: 0o600 }); }; app.locals.recordStorageDeletionFailure = (uploadReference, error) => { const item = cleanupJobs[uploadReference] || { uploadReference, attempts: 0, status: 'RETRY' }; item.attempts += 1; item.status = item.attempts >= 10 ? 'FAILED' : 'RETRY'; item.lastError = String(error?.message || 'REMOTE_DELETE_FAILED').slice(0, 160); item.updatedAt = now(); cleanupJobs[uploadReference] = item; saveCleanup(); }; app.locals.recordStorageDeletionSuccess = uploadReference => { if (cleanupJobs[uploadReference]) { cleanupJobs[uploadReference].status = 'DELETED'; cleanupJobs[uploadReference].updatedAt = now(); saveCleanup(); } };
  const key = encryptionKey();
  let vault = {};
  try { vault = JSON.parse(fs.readFileSync(VAULT_FILE, 'utf8')); } catch {}
  const saveVault = () => { fs.writeFileSync(VAULT_FILE, JSON.stringify(vault, null, 2), { mode: 0o600 }); try { fs.chmodSync(VAULT_FILE, 0o600); } catch {} };
  const activeSecret = purpose => vault[purpose]?.status === 'ACTIVE' ? vault[purpose] : null;
  const secretStatus = purpose => { const s = activeSecret(purpose); return { configured: Boolean(s), provider: s?.provider || null, model: s?.model || null, keyVersion: s?.keyVersion || null, updatedAt: s?.updatedAt || null }; };
  const getSecret = purpose => { const s = activeSecret(purpose); if (!s || !key) return null; try { return decrypt(s, key); } catch { return null; } };
  const setSecret = (purpose, value, metadata) => { if (!key) throw Error('SECRET_MANAGER_UNCONFIGURED'); const record = { ...encrypt(value, key), purpose, provider: metadata.provider, model: metadata.model, status: 'ACTIVE', updatedAt: now() }; vault[purpose] = record; saveVault(); return secretStatus(purpose); };
  const revokeSecret = purpose => { if (vault[purpose]) { vault[purpose].status = 'REVOKED'; vault[purpose].revokedAt = now(); saveVault(); } return secretStatus(purpose); };
  const providerBase = () => String(process.env.AI_API_BASE || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, '');
  async function verifyAiProvider(apiKey, provider) { if (!apiKey || !provider) throw Error('AI_PROVIDER_FIELDS_REQUIRED'); const r = await fetch(`${providerBase()}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(Number(process.env.AI_VERIFY_TIMEOUT_MS || 10000)) }); if (!r.ok) throw Error('AI_PROVIDER_VERIFICATION_FAILED'); return true; }
  const admin = app.locals.superAdminAuth;
  const adminOnly = (req, res, next) => admin(req, res, next);
  app.locals.getAIKey = () => getSecret('ai-provider') || process.env.AI_API_KEY || process.env.OPENAI_API_KEY || null;
  app.locals.aiSecretConfigured = () => Boolean(activeSecret('ai-provider') || process.env.AI_API_KEY || process.env.OPENAI_API_KEY);
  app.locals.productionStorage = { enabled: Boolean(supabase && process.env.SUPABASE_STORAGE_BUCKET), provider: supabase ? 'supabase-storage' : 'local', bucket: storageBucket, upload: (objectKey, filePath, mimeType) => supabase ? supabase.upload(storageBucket, objectKey, filePath, mimeType) : Promise.reject(Error('REMOTE_STORAGE_UNCONFIGURED')), sign: objectKey => supabase ? supabase.sign(storageBucket, objectKey, Number(process.env.SUPABASE_SIGNED_URL_SECONDS || 120)) : Promise.reject(Error('REMOTE_STORAGE_UNCONFIGURED')), remove: objectKey => supabase ? supabase.remove(storageBucket, objectKey) : Promise.reject(Error('REMOTE_STORAGE_UNCONFIGURED')) };
  app.locals.productionReadiness = () => ({ persistence: { backend: persistenceBackend, durable: persistenceBackend === 'supabase' && supabaseConfigured, configured: supabaseConfigured }, storage: { provider: supabase ? 'supabase-storage' : 'local', private: Boolean(supabase), bucket: supabase ? storageBucket : null }, ai: secretStatus('ai-provider'), durableRequired, runtimeMigrationComplete, runtimePersistence: runtimeMigrationComplete ? 'SUPABASE_RUNTIME_ENABLED_BY_DEPLOYMENT' : 'LOCAL_MAPS_NOT_PRODUCTION_READY', encryptionKeyConfigured: Boolean(key), externalChecks: { supabaseRls: 'NOT_RUN', storagePolicies: 'NOT_RUN', paymentSandbox: 'NOT_RUN', secretManager: key ? 'LOCAL_ENCRYPTED_VAULT' : 'NOT_CONFIGURED' } });
  app.get('/api/superadmin/production-readiness', adminOnly, (req, res) => res.json({ readiness: app.locals.productionReadiness() }));
  app.get('/api/superadmin/ai-control/secret-status', adminOnly, (req, res) => res.json({ secret: secretStatus('ai-provider') }));
  app.post('/api/superadmin/ai-control/secret', adminOnly, async (req, res) => { const apiKey = String(req.body?.apiKey || ''); const provider = String(req.body?.provider || 'openai-compatible').slice(0, 80); const model = String(req.body?.model || process.env.AI_MODEL || 'gpt-4o-mini').slice(0, 120); if (apiKey.length < 20 || apiKey.length > 500) return res.status(400).json({ error: 'AI_KEY_INVALID' }); try { await verifyAiProvider(apiKey, provider); const result = setSecret('ai-provider', apiKey, { provider, model }); if (req.superAdmin) logActivity({ id: req.superAdmin.id, shopId: null }, 'AI_SECRET_REPLACED', { provider, model }); res.status(201).json({ secret: result, verified: true }); } catch (e) { if (e.message === 'SECRET_MANAGER_UNCONFIGURED') return res.status(503).json({ error: e.message }); return res.status(502).json({ error: 'AI_PROVIDER_VERIFICATION_FAILED' }); } });
  app.delete('/api/superadmin/ai-control/secret', adminOnly, (req, res) => { const result = revokeSecret('ai-provider'); if (req.superAdmin) logActivity({ id: req.superAdmin.id, shopId: null }, 'AI_SECRET_REVOKED', {}); res.json({ secret: result }); });
  app.locals.claimIdempotency = async (scope, idempotencyKey, requestHash) => { if (!supabase || !durableRequired) throw Error('DURABLE_PERSISTENCE_NOT_ENABLED'); if (!scope || !idempotencyKey || !requestHash) throw Error('IDEMPOTENCY_FIELDS_REQUIRED'); return supabase.rpc('claim_idempotency', { p_scope: String(scope).slice(0, 120), p_key: String(idempotencyKey).slice(0, 160), p_request_hash: String(requestHash).slice(0, 128) }); };
};
module.exports.SupabaseRest = SupabaseRest;
module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;
