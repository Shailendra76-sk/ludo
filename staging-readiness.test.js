#!/usr/bin/env node
const required = ['STAGING_SUPABASE_URL', 'STAGING_SUPABASE_ANON_KEY', 'STAGING_SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.log(JSON.stringify({ status: 'NOT_RUN', reason: 'Missing real Supabase staging credentials', missing }, null, 2));
  if (process.argv.includes('--require-staging')) process.exitCode = 2;
  process.exit();
}
(async () => {
  const base = process.env.STAGING_SUPABASE_URL.replace(/\/$/, '');
  const serviceHeaders = { apikey: process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY}` };
  const tables = ['shops', 'orders', 'print_jobs', 'storage_objects', 'idempotency_keys', 'secret_references'];
  const results = {};
  for (const table of tables) {
    const r = await fetch(`${base}/rest/v1/${table}?select=*&limit=0`, { headers: serviceHeaders });
    results[table] = { status: r.status, ok: r.ok };
    if (!r.ok) throw Error(`STAGING_SCHEMA_CHECK_FAILED:${table}`);
  }
  console.log(JSON.stringify({ status: 'PARTIAL', note: 'Service-role schema checks passed; anonymous/authenticated/shopkeeper/staff RLS identity checks require configured test identities and are not claimed here.', results }, null, 2));
})().catch(error => { console.error(JSON.stringify({ status: 'FAILED', error: error.message }, null, 2)); process.exitCode = 1; });
