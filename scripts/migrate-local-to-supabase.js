#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const [phase2, phase3] = [path.join(process.cwd(), 'storage/phase2-data.json'), path.join(process.cwd(), 'storage/phase3-data.json')].map(f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return {}; } });
const shops = Object.values(phase2.shops || {}); const users = phase2.shopUsers || []; const printers = Object.values(phase2.printers || {}); const plans = Object.values(phase3.plans || {}); const subscriptions = Object.values(phase3.subscriptions || {});
const tables = { shops, shop_users: users.map(u => ({ id:u.id, shop_id:u.shopId, email:u.identifier, password_hash:`${u.salt}:${u.hash}`, role:'SHOPKEEPER', status:u.status || 'ACTIVE' })), printers, plans, subscriptions };
console.log(`Prepared idempotent migration: ${shops.length} shops, ${users.length} users, ${printers.length} printers, ${plans.length} plans, ${subscriptions.length} subscriptions.`);
const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.log('Dry run only. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server to apply upserts.'); process.exit(0); }
(async()=>{ for (const [table, rows] of Object.entries(tables)) { if (!rows.length) continue; const r = await fetch(`${url.replace(/\/$/,'')}/rest/v1/${table}`, { method:'POST', headers:{ apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify(rows) }); if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`); console.log(`Upserted ${rows.length} ${table}`); } })().catch(e=>{ console.error(e.message); process.exit(1); });
