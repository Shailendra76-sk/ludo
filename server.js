const express = require('express');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const QRCode = require('qrcode');

const app = express();
const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const STORAGE = path.join(ROOT, 'storage');
const TMP = path.join(STORAGE, 'tmp');
const DATA_FILE = path.join(STORAGE, 'phase2-data.json');
fs.mkdirSync(TMP, { recursive: true });

const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_SIZE = 10 * 1024 * 1024;
const ORDER_STATES = new Set(['CREATED', 'FILE_UPLOADED', 'PAYMENT_PENDING', 'CASH_PENDING', 'PAID', 'PRINT_QUEUED', 'PRINTING', 'PRINTED', 'FAILED', 'EXPIRED']);
const shops = {
  'paperlane-central': { id: 'paperlane-central', name: 'Paperlane Central', area: 'MG Road', currency: 'INR', ownerName: 'Paperlane Owner', mobile: '', email: 'paperlane@example.local', address: 'MG Road', openingHours: '09:00–20:00', active: true, pricing: { bw: 2, color: 10, minimumOrder: 0, serviceCharge: 0, currencySymbol: '₹' }, acceptedPaymentMethods: ['cash', 'online'], openingStatus: 'open' },
  'demo-shop': { id: 'demo-shop', name: 'Demo Print Shop', area: 'Your neighbourhood', currency: 'INR', ownerName: 'Demo Owner', mobile: '', email: 'demo@printerauto.local', address: 'Your neighbourhood', openingHours: '09:00–20:00', active: true, pricing: { bw: 2, color: 10, minimumOrder: 0, serviceCharge: 0, currencySymbol: '₹' }, acceptedPaymentMethods: ['cash', 'online'], openingStatus: 'open' }
};
const uploads = new Map();
const orders = new Map();
const rate = new Map();
const sessions = new Map();
const printers = new Map();
const activityLogs = [];
const shopUsers = new Map();

function id(prefix) { return `${prefix}_${crypto.randomBytes(12).toString('hex')}`; }
function now() { return new Date().toISOString(); }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') }; }
function verifyPassword(password, record) { return crypto.timingSafeEqual(Buffer.from(hashPassword(password, record.salt).hash, 'hex'), Buffer.from(record.hash, 'hex')); }
function safeUser(user) { return { id: user.id, identifier: user.identifier, shopId: user.shopId, role: 'SHOPKEEPER' }; }
function publicShop(shop) { return { id: shop.id, name: shop.name, area: shop.area, currency: shop.currency, pricing: shop.pricing }; }
function publicOrder(o) { return { id: o.id, shopId: o.shopId, fileName: o.fileName, pageCount: o.pageCount, printType: o.printType, copies: o.copies, pageSelection: o.pageSelection, amount: o.amount, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, status: o.status, createdAt: o.createdAt, updatedAt: o.updatedAt, message: o.message }; }
function publicPrinter(p) { return { id: p.id, shopId: p.shopId, name: p.name, type: p.type, status: p.status, lastSeen: p.lastSeen, currentJob: p.currentJob, errorStatus: p.errorStatus, isDefault: p.isDefault }; }
function allowedRate(req, bucket, max = 20) { const key = `${req.ip}:${bucket}`; const t = Date.now(); const hit = rate.get(key) || { start: t, count: 0 }; if (t - hit.start > 60_000) { hit.start = t; hit.count = 0; } hit.count += 1; rate.set(key, hit); return hit.count <= max; }
function isJpeg(b) { return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; }
function isPng(b) { return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47; }
function isPdf(b) { return b.slice(0, 5).toString() === '%PDF-'; }
function countPdfPages(file) { try { const out = execFileSync('pdfinfo', [file], { timeout: 3000, encoding: 'utf8' }); const m = out.match(/^Pages:\s+(\d+)/m); return m ? Math.max(1, Number(m[1])) : 1; } catch { return 1; } }
function pagesFromFile(file, mime) { return mime === 'application/pdf' ? countPdfPages(file) : 1; }
function selectionCount(selection, total) { if (!selection || selection.mode === 'all') return total; const pages = Array.isArray(selection.pages) ? selection.pages : []; const valid = [...new Set(pages.filter(p => Number.isInteger(p) && p >= 1 && p <= total))]; return valid.length ? valid.length : null; }
function calcAmount(shop, printType, pages, copies) { const p = shop.pricing; return Math.max(Number(p.minimumOrder) || 0, (Number(p[printType]) || 0) * pages * copies + (Number(p.serviceCharge) || 0)); }
function parseCookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(v => { const i = v.indexOf('='); return [v.slice(0, i).trim(), decodeURIComponent(v.slice(i + 1))]; })); }
function auth(req, res, next) { const token = parseCookies(req).shopkeeper_session; const session = token && sessions.get(token); const user = session && shopUsers.get(session.userId); if (!user) return res.status(401).json({ error: 'UNAUTHORIZED' }); req.shopkeeper = user; next(); }
function logActivity(user, action, metadata = {}) { activityLogs.push({ id: id('log'), action, at: now(), shopId: user.shopId, userId: user.id, metadata }); if (activityLogs.length > 5000) activityLogs.shift(); }
function persist() { const data = { shops, printers: Object.fromEntries(printers), shopUsers: [...shopUsers.values()].map(u => ({ ...u })), activityLogs: activityLogs.slice(-5000) }; fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function loadPersisted() { try { const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); Object.assign(shops, data.shops || {}); for (const [k, v] of Object.entries(data.printers || {})) printers.set(k, v); for (const u of data.shopUsers || []) shopUsers.set(u.id, u); activityLogs.push(...(data.activityLogs || [])); } catch {} }
loadPersisted();
for (const shop of Object.values(shops)) { if (![...printers.values()].some(p => p.shopId === shop.id)) { const p = { id: id('prn'), shopId: shop.id, name: 'Local Mock Printer', type: 'Mock connector', status: 'Online', lastSeen: now(), currentJob: null, errorStatus: null, isDefault: true }; printers.set(p.id, p); } }
if (!shopUsers.size) { const p = hashPassword(process.env.DEMO_SHOPKEEPER_PASSWORD || 'demo1234'); const u = { id: 'usr_demo_shopkeeper', identifier: process.env.DEMO_SHOPKEEPER_IDENTIFIER || 'demo@printerauto.local', shopId: 'demo-shop', salt: p.salt, hash: p.hash }; shopUsers.set(u.id, u); persist(); }

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(ROOT, 'public')));
app.use((req, res, next) => {
  if (app.locals.platformMaintenance && (req.path.startsWith('/print/') || req.path.startsWith('/api/shops') || req.path.startsWith('/api/uploads') || req.path.startsWith('/api/orders'))) {
    if (req.path.startsWith('/print/')) return res.status(503).send('Service temporarily unavailable.');
    return res.status(503).json({ error: 'MAINTENANCE_MODE' });
  }
  next();
});

const storage = multer.diskStorage({ destination: TMP, filename: (_, file, cb) => cb(null, `${id('file')}${path.extname(file.originalname).toLowerCase()}`) });
const upload = multer({ storage, limits: { fileSize: MAX_SIZE, files: 1 }, fileFilter: (_, file, cb) => cb(null, ALLOWED.has(file.mimetype)) });

app.get('/api/shops/:shopId', (req, res) => { const shop = shops[req.params.shopId]; if (!shop || !shop.id || !shop.active || app.locals.shopBlocked?.(req.params.shopId)) return res.status(404).json({ error: 'SHOP_NOT_FOUND' }); res.json({ shop: publicShop(shop) }); });
app.post('/api/uploads', (req, res) => { if (!allowedRate(req, 'upload', 10)) return res.status(429).json({ error: 'RATE_LIMITED' }); upload.single('file')(req, res, err => { if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UNSUPPORTED_FILE' }); if (!req.file) return res.status(400).json({ error: 'FILE_REQUIRED' }); const head = Buffer.alloc(8); const fd = fs.openSync(req.file.path, 'r'); fs.readSync(fd, head, 0, 8, 0); fs.closeSync(fd); const valid = (req.file.mimetype === 'application/pdf' && isPdf(head)) || (req.file.mimetype === 'image/jpeg' && isJpeg(head)) || (req.file.mimetype === 'image/png' && isPng(head)); if (!valid) { fs.rmSync(req.file.path, { force: true }); return res.status(400).json({ error: 'INVALID_FILE_SIGNATURE' }); } const pageCount = pagesFromFile(req.file.path, req.file.mimetype); const ref = id('upl'); uploads.set(ref, { ref, path: req.file.path, fileName: path.basename(req.file.originalname).slice(0, 120), mimeType: req.file.mimetype, size: req.file.size, pageCount, createdAt: Date.now() }); res.status(201).json({ uploadRef: ref, fileName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size, pageCount }); }); });

app.post('/api/orders', (req, res) => { if (!allowedRate(req, 'order', 20)) return res.status(429).json({ error: 'RATE_LIMITED' }); const { shopId, uploadRef, printType, copies, pageSelection, paymentMethod } = req.body || {}; const shop = shops[shopId]; const file = uploads.get(uploadRef); if (!shop || shop.status !== 'ACTIVE' || shop.active === false || app.locals.shopBlocked?.(shopId)) return res.status(400).json({ error: 'SHOP_UNAVAILABLE' }); if (!file) return res.status(400).json({ error: 'UPLOAD_EXPIRED' }); if (!['bw', 'color'].includes(printType)) return res.status(400).json({ error: 'INVALID_PRINT_TYPE' }); const copyCount = Number(copies); if (!Number.isInteger(copyCount) || copyCount < 1 || copyCount > 20) return res.status(400).json({ error: 'INVALID_COPIES' }); const selectedPages = selectionCount(pageSelection, file.pageCount); if (!selectedPages) return res.status(400).json({ error: 'INVALID_PAGE_SELECTION' }); if (!['online', 'cash'].includes(paymentMethod) || !shop.acceptedPaymentMethods.includes(paymentMethod)) return res.status(400).json({ error: 'INVALID_PAYMENT_METHOD' }); const amount = calcAmount(shop, printType, selectedPages, copyCount); const order = { id: id('ord'), shopId, uploadRef, fileName: file.fileName, pageCount: file.pageCount, printType, copies: copyCount, pageSelection: pageSelection?.mode === 'selected' ? { mode: 'selected', pages: pageSelection.pages } : { mode: 'all' }, amount, paymentMethod, paymentStatus: paymentMethod === 'cash' ? 'CASH_PENDING' : 'PAYMENT_PENDING', status: paymentMethod === 'cash' ? 'CASH_PENDING' : 'PAYMENT_PENDING', createdAt: now(), updatedAt: now(), message: paymentMethod === 'cash' ? 'Cash order is waiting for shop approval.' : 'Online payment gateway is not configured yet; no print job was released.' }; orders.set(order.id, order); file.orderId = order.id; res.status(201).json({ order: publicOrder(order) }); });
app.get('/api/orders/:orderId', (req, res) => { const o = orders.get(req.params.orderId); if (!o) return res.status(404).json({ error: 'ORDER_NOT_FOUND' }); res.json({ order: publicOrder(o) }); });
app.delete('/api/uploads/:ref', (req, res) => { cleanupUpload(req.params.ref); res.status(204).end(); });

// Shopkeeper auth: password hashes use scrypt; sessions are opaque, httpOnly and server-side.
app.post('/api/shopkeeper/login', (req, res) => { if (!allowedRate(req, 'login', 10)) return res.status(429).json({ error: 'RATE_LIMITED' }); const identifier = String(req.body?.identifier || '').trim().toLowerCase(); const password = String(req.body?.password || ''); const user = [...shopUsers.values()].find(u => u.identifier.toLowerCase() === identifier); if (!user || user.status === 'SUSPENDED' || shops[user.shopId]?.status !== 'ACTIVE' || app.locals.shopkeeperBlocked?.(user.shopId) || !password || !verifyPassword(password, user)) return res.status(401).json({ error: 'INVALID_CREDENTIALS' }); const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, { userId: user.id, createdAt: Date.now() }); const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''; res.setHeader('Set-Cookie', `shopkeeper_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`); logActivity(user, 'LOGIN'); persist(); res.json({ user: safeUser(user), shop: publicShop(shops[user.shopId]) }); });
app.post('/api/shopkeeper/logout', auth, (req, res) => { const token = parseCookies(req).shopkeeper_session; sessions.delete(token); logActivity(req.shopkeeper, 'LOGOUT'); res.setHeader('Set-Cookie', 'shopkeeper_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.status(204).end(); });
app.get('/api/shopkeeper/me', auth, (req, res) => res.json({ user: safeUser(req.shopkeeper), shop: publicShop(shops[req.shopkeeper.shopId]) }));
function shopOrders(shopId) { return [...orders.values()].filter(o => o.shopId === shopId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
function filterOrders(list, q) { const date = String(q.date || 'all'); const today = new Date(); const iso = d => d.toISOString().slice(0, 10); return list.filter(o => { const d = new Date(o.createdAt); const dateOk = date === 'all' || (date === 'today' && iso(d) === iso(today)) || (date === 'yesterday' && iso(d) === iso(new Date(today - 86400000))) || (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && iso(d) === date); const payOk = !q.paymentStatus || o.paymentStatus === q.paymentStatus; const printOk = !q.printStatus || o.status === q.printStatus; const typeOk = !q.printType || o.printType === q.printType; return dateOk && payOk && printOk && typeOk; }); }
app.get('/api/shopkeeper/dashboard', auth, (req, res) => { const list = shopOrders(req.shopkeeper.shopId); const today = new Date().toISOString().slice(0, 10); const todayList = list.filter(o => o.createdAt.slice(0, 10) === today); const revenue = todayList.filter(o => o.paymentStatus === 'PAID' || o.status === 'PRINTED').reduce((s, o) => s + o.amount, 0); const shopPrinters = [...printers.values()].filter(p => p.shopId === req.shopkeeper.shopId); res.json({ summary: { todayOrders: todayList.length, todayPrints: todayList.filter(o => o.status === 'PRINTED').length, todayRevenue: revenue, pendingPayments: list.filter(o => o.paymentStatus === 'CASH_PENDING' || o.paymentStatus === 'PAYMENT_PENDING').length, pendingPrintJobs: list.filter(o => ['PAID', 'PRINT_QUEUED', 'PRINTING'].includes(o.status)).length, failedPrintJobs: list.filter(o => o.status === 'FAILED').length }, printers: shopPrinters.map(publicPrinter), recentOrders: list.slice(0, 12).map(publicOrder) }); });
app.get('/api/shopkeeper/orders', auth, (req, res) => res.json({ orders: filterOrders(shopOrders(req.shopkeeper.shopId), req.query).map(publicOrder) }));
app.get('/api/shopkeeper/orders/:orderId', auth, (req, res) => { const order = orders.get(req.params.orderId); if (!order || order.shopId !== req.shopkeeper.shopId) return res.status(404).json({ error: 'ORDER_NOT_FOUND' }); res.json({ order: publicOrder(order) }); });

const PaymentProvider = { isVerified: order => order.paymentStatus === 'PAID' };
const PrintConnector = { release: async order => { if (!PaymentProvider.isVerified(order)) throw new Error('PAYMENT_NOT_VERIFIED'); const printer = [...printers.values()].find(p => p.shopId === order.shopId && p.isDefault) || [...printers.values()].find(p => p.shopId === order.shopId); if (!printer || ['Offline', 'Error'].includes(printer.status)) throw new Error('PRINTER_UNAVAILABLE'); printer.status = 'Busy'; printer.currentJob = order.id; printer.lastSeen = now(); return { connectorJobId: id('job'), printerId: printer.id }; } };
async function queuePaidOrder(order, user) { order.status = 'PRINT_QUEUED'; order.updatedAt = now(); order.message = 'Payment verified; print job queued.'; try { const job = await PrintConnector.release(order); order.connectorJobId = job.connectorJobId; order.status = 'PRINTING'; order.updatedAt = now(); const printer = printers.get(job.printerId); setTimeout(() => { order.status = 'PRINTED'; order.updatedAt = now(); order.message = 'Print completed.'; if (printer) { printer.status = 'Online'; printer.currentJob = null; printer.lastSeen = now(); } persist(); }, 800); } catch (e) { order.status = 'FAILED'; order.updatedAt = now(); order.message = e.message === 'PRINTER_UNAVAILABLE' ? 'No available printer connector.' : 'Print connector rejected the job.'; } if (user) logActivity(user, 'PRINT_JOB_RELEASED', { orderId: order.id }); persist(); }
app.post('/api/shopkeeper/orders/:orderId/cash-collected', auth, async (req, res) => { const order = orders.get(req.params.orderId); if (!order || order.shopId !== req.shopkeeper.shopId) return res.status(404).json({ error: 'ORDER_NOT_FOUND' }); if (order.paymentMethod !== 'cash' || order.paymentStatus !== 'CASH_PENDING' || order.status !== 'CASH_PENDING') return res.status(409).json({ error: 'CASH_ALREADY_COLLECTED_OR_NOT_ELIGIBLE' }); order.paymentStatus = 'PAID'; order.status = 'PAID'; order.updatedAt = now(); order.message = 'Cash collected by shopkeeper.'; logActivity(req.shopkeeper, 'CASH_PAYMENT_MARKED_COLLECTED', { orderId: order.id, amount: order.amount }); await queuePaidOrder(order, req.shopkeeper); res.json({ order: publicOrder(order) }); });

app.get('/api/shopkeeper/printers', auth, (req, res) => res.json({ printers: [...printers.values()].filter(p => p.shopId === req.shopkeeper.shopId).map(publicPrinter) }));
app.post('/api/shopkeeper/printers', auth, (req, res) => { const name = String(req.body?.name || '').trim().slice(0, 80); const type = String(req.body?.type || 'Mock connector').trim().slice(0, 80); if (!name) return res.status(400).json({ error: 'PRINTER_NAME_REQUIRED' }); const p = { id: id('prn'), shopId: req.shopkeeper.shopId, name, type, status: 'Offline', lastSeen: null, currentJob: null, errorStatus: null, isDefault: ![...printers.values()].some(x => x.shopId === req.shopkeeper.shopId && x.isDefault) }; printers.set(p.id, p); logActivity(req.shopkeeper, 'PRINTER_ADDED', { printerId: p.id }); persist(); res.status(201).json({ printer: publicPrinter(p) }); });
app.delete('/api/shopkeeper/printers/:printerId', auth, (req, res) => { const p = printers.get(req.params.printerId); if (!p || p.shopId !== req.shopkeeper.shopId) return res.status(404).json({ error: 'PRINTER_NOT_FOUND' }); if (p.currentJob) return res.status(409).json({ error: 'PRINTER_BUSY' }); printers.delete(p.id); logActivity(req.shopkeeper, 'PRINTER_REMOVED', { printerId: p.id }); persist(); res.status(204).end(); });
app.post('/api/shopkeeper/printers/:printerId/default', auth, (req, res) => { const p = printers.get(req.params.printerId); if (!p || p.shopId !== req.shopkeeper.shopId) return res.status(404).json({ error: 'PRINTER_NOT_FOUND' }); for (const x of printers.values()) if (x.shopId === req.shopkeeper.shopId) x.isDefault = x.id === p.id; logActivity(req.shopkeeper, 'DEFAULT_PRINTER_CHANGED', { printerId: p.id }); persist(); res.json({ printer: publicPrinter(p) }); });
app.post('/api/shopkeeper/printers/:printerId/test', auth, (req, res) => { const p = printers.get(req.params.printerId); if (!p || p.shopId !== req.shopkeeper.shopId) return res.status(404).json({ error: 'PRINTER_NOT_FOUND' }); if (p.status === 'Offline') return res.status(409).json({ error: 'PRINTER_OFFLINE' }); p.status = 'Busy'; p.currentJob = 'TEST_JOB'; p.lastSeen = now(); setTimeout(() => { p.status = 'Online'; p.currentJob = null; p.lastSeen = now(); persist(); }, 500); persist(); res.json({ ok: true, printer: publicPrinter(p) }); });

app.get('/api/shopkeeper/pricing', auth, (req, res) => res.json({ pricing: shops[req.shopkeeper.shopId].pricing }));
app.put('/api/shopkeeper/pricing', auth, (req, res) => { const input = req.body || {}; const values = ['bw', 'color', 'minimumOrder', 'serviceCharge']; const next = { ...shops[req.shopkeeper.shopId].pricing }; for (const key of values) { if (input[key] !== undefined) { const v = Number(input[key]); if (!Number.isFinite(v) || v < 0 || v > 100000) return res.status(400).json({ error: 'INVALID_PRICING' }); next[key] = v; } } shops[req.shopkeeper.shopId].pricing = next; logActivity(req.shopkeeper, 'PRICE_CHANGED', { pricing: next }); persist(); res.json({ pricing: next }); });
app.get('/api/shopkeeper/profile', auth, (req, res) => res.json({ profile: shops[req.shopkeeper.shopId] }));
app.put('/api/shopkeeper/profile', auth, (req, res) => { const shop = shops[req.shopkeeper.shopId]; for (const key of ['name', 'ownerName', 'mobile', 'email', 'address', 'openingHours', 'openingStatus']) if (req.body?.[key] !== undefined) shop[key] = String(req.body[key]).slice(0, 160); logActivity(req.shopkeeper, 'SETTINGS_CHANGED'); persist(); res.json({ profile: shop }); });
app.get('/api/shopkeeper/qr', auth, async (req, res) => { const shop = shops[req.shopkeeper.shopId]; const url = `${req.protocol}://${req.get('host')}/print/shop/${encodeURIComponent(shop.id)}`; const dataUrl = await QRCode.toDataURL(url, { width: 360, margin: 2, color: { dark: '#101b2d', light: '#ffffff' } }); res.json({ shopId: shop.id, url, dataUrl }); });
app.get('/api/shopkeeper/reports', auth, (req, res) => { const list = filterOrders(shopOrders(req.shopkeeper.shopId), req.query); const report = { orders: list.length, prints: list.filter(o => o.status === 'PRINTED').length, totalPages: list.reduce((s, o) => s + o.pageCount * o.copies, 0), bwPages: list.filter(o => o.printType === 'bw').reduce((s, o) => s + o.pageCount * o.copies, 0), colorPages: list.filter(o => o.printType === 'color').reduce((s, o) => s + o.pageCount * o.copies, 0), revenue: list.filter(o => o.paymentStatus === 'PAID').reduce((s, o) => s + o.amount, 0), cash: list.filter(o => o.paymentMethod === 'cash' && o.paymentStatus === 'PAID').reduce((s, o) => s + o.amount, 0), online: list.filter(o => o.paymentMethod === 'online' && o.paymentStatus === 'PAID').reduce((s, o) => s + o.amount, 0) }; if (req.query.format === 'csv') { const csv = ['metric,value', ...Object.entries(report).map(([k, v]) => `${k},${v}`)].join('\n'); res.type('text/csv').send(csv); } else res.json({ report }); });

require('./phase3')({ app, ROOT, shops, shopUsers, printers, orders, activityLogs, id, now, hashPassword, verifyPassword, publicShop, publicOrder, publicPrinter, persist });

function cleanupUpload(ref) { const file = uploads.get(ref); if (!file) return; try { fs.rmSync(file.path, { force: true }); } catch {} uploads.delete(ref); }
function cleanup() { const cutoff = Date.now() - 5 * 60 * 1000; for (const [ref, f] of uploads) if (f.createdAt < cutoff) { const o = f.orderId && orders.get(f.orderId); if (!o || !['PRINTED', 'FAILED'].includes(o.status)) { if (o && o.status !== 'PRINTED') { o.status = 'EXPIRED'; o.paymentStatus = o.paymentStatus === 'PAID' ? 'REFUND_REVIEW' : o.paymentStatus; o.updatedAt = now(); } cleanupUpload(ref); } } }
setInterval(cleanup, 60_000).unref();
app.get('/print/shop/:shopId', (_, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
app.get('/shopkeeper/login', (_, res) => res.sendFile(path.join(ROOT, 'public', 'shopkeeper.html')));
app.get('/shopkeeper', (_, res) => res.sendFile(path.join(ROOT, 'public', 'shopkeeper.html')));
app.get('/superadmin/login', (_, res) => res.sendFile(path.join(ROOT, 'public', 'superadmin.html')));
app.get('/superadmin', (_, res) => res.sendFile(path.join(ROOT, 'public', 'superadmin.html')));
app.use((_, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
const server = app.listen(PORT, '0.0.0.0', () => console.log(`Printer Auto running on http://0.0.0.0:${PORT}`));
process.on('SIGTERM', () => { for (const ref of uploads.keys()) cleanupUpload(ref); server.close(() => process.exit(0)); });
