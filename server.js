const express = require('express');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const app = express();
const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const TMP = path.join(ROOT, 'storage', 'tmp');
fs.mkdirSync(TMP, { recursive: true });

const shops = {
  'paperlane-central': {
    id: 'paperlane-central', name: 'Paperlane Central', area: 'MG Road', currency: 'INR',
    pricing: { bw: 2, color: 10, currencySymbol: '₹' }
  },
  'demo-shop': {
    id: 'demo-shop', name: 'Demo Print Shop', area: 'Your neighbourhood', currency: 'INR',
    pricing: { bw: 2, color: 10, currencySymbol: '₹' }
  }
};
const uploads = new Map();
const orders = new Map();
const rate = new Map();
const ALLOWED = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_SIZE = 10 * 1024 * 1024;

app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(ROOT, 'public')));

function id(prefix) { return `${prefix}_${crypto.randomBytes(12).toString('hex')}`; }
function now() { return new Date().toISOString(); }
function allowedRate(req, bucket, max = 20) {
  const key = `${req.ip}:${bucket}`; const t = Date.now(); const hit = rate.get(key) || { start: t, count: 0 };
  if (t - hit.start > 60_000) { hit.start = t; hit.count = 0; }
  hit.count += 1; rate.set(key, hit); return hit.count <= max;
}
function isJpeg(b) { return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff; }
function isPng(b) { return b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47; }
function isPdf(b) { return b.slice(0, 5).toString() === '%PDF-'; }
function countPdfPages(file) {
  try { const out = execFileSync('pdfinfo', [file], { timeout: 3000, encoding: 'utf8' }); const m = out.match(/^Pages:\s+(\d+)/m); return m ? Math.max(1, Number(m[1])) : 1; }
  catch { return 1; }
}
function pagesFromFile(file, mime) { return mime === 'application/pdf' ? countPdfPages(file) : 1; }
function selectionCount(selection, total) {
  if (!selection || selection.mode === 'all') return total;
  const pages = Array.isArray(selection.pages) ? selection.pages : [];
  const valid = [...new Set(pages.filter(p => Number.isInteger(p) && p >= 1 && p <= total))];
  return valid.length ? valid.length : null;
}
function publicShop(shop) { return { id: shop.id, name: shop.name, area: shop.area, currency: shop.currency, pricing: shop.pricing }; }
function publicOrder(o) { return { id: o.id, shopId: o.shopId, fileName: o.fileName, pageCount: o.pageCount, printType: o.printType, copies: o.copies, pageSelection: o.pageSelection, amount: o.amount, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, status: o.status, createdAt: o.createdAt, updatedAt: o.updatedAt, message: o.message }; }

const storage = multer.diskStorage({ destination: TMP, filename: (_, file, cb) => cb(null, `${id('file')}${path.extname(file.originalname).toLowerCase()}`) });
const upload = multer({ storage, limits: { fileSize: MAX_SIZE, files: 1 }, fileFilter: (_, file, cb) => cb(null, ALLOWED.has(file.mimetype)) });

app.get('/api/shops/:shopId', (req, res) => {
  const shop = shops[req.params.shopId]; if (!shop || !shop.id) return res.status(404).json({ error: 'SHOP_NOT_FOUND' });
  res.json({ shop: publicShop(shop) });
});

app.post('/api/uploads', (req, res) => {
  if (!allowedRate(req, 'upload', 10)) return res.status(429).json({ error: 'RATE_LIMITED' });
  upload.single('file')(req, res, err => {
    if (err) return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UNSUPPORTED_FILE' });
    if (!req.file) return res.status(400).json({ error: 'FILE_REQUIRED' });
    const head = Buffer.alloc(8); const fd = fs.openSync(req.file.path, 'r'); fs.readSync(fd, head, 0, 8, 0); fs.closeSync(fd);
    const valid = (req.file.mimetype === 'application/pdf' && isPdf(head)) || (req.file.mimetype === 'image/jpeg' && isJpeg(head)) || (req.file.mimetype === 'image/png' && isPng(head));
    if (!valid) { fs.rmSync(req.file.path, { force: true }); return res.status(400).json({ error: 'INVALID_FILE_SIGNATURE' }); }
    const pageCount = pagesFromFile(req.file.path, req.file.mimetype); const ref = id('upl');
    uploads.set(ref, { ref, path: req.file.path, fileName: path.basename(req.file.originalname).slice(0, 120), mimeType: req.file.mimetype, size: req.file.size, pageCount, createdAt: Date.now() });
    res.status(201).json({ uploadRef: ref, fileName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size, pageCount });
  });
});

app.post('/api/orders', (req, res) => {
  if (!allowedRate(req, 'order', 20)) return res.status(429).json({ error: 'RATE_LIMITED' });
  const { shopId, uploadRef, printType, copies, pageSelection, paymentMethod } = req.body || {};
  const shop = shops[shopId]; const file = uploads.get(uploadRef);
  if (!shop) return res.status(400).json({ error: 'SHOP_NOT_FOUND' });
  if (!file) return res.status(400).json({ error: 'UPLOAD_EXPIRED' });
  if (!['bw', 'color'].includes(printType)) return res.status(400).json({ error: 'INVALID_PRINT_TYPE' });
  const copyCount = Number(copies); if (!Number.isInteger(copyCount) || copyCount < 1 || copyCount > 20) return res.status(400).json({ error: 'INVALID_COPIES' });
  const selectedPages = selectionCount(pageSelection, file.pageCount); if (!selectedPages) return res.status(400).json({ error: 'INVALID_PAGE_SELECTION' });
  if (!['online', 'cash'].includes(paymentMethod)) return res.status(400).json({ error: 'INVALID_PAYMENT_METHOD' });
  const amount = shop.pricing[printType] * selectedPages * copyCount;
  const order = { id: id('ord'), shopId, uploadRef, fileName: file.fileName, pageCount: file.pageCount, printType, copies: copyCount, pageSelection: pageSelection?.mode === 'selected' ? { mode: 'selected', pages: pageSelection.pages } : { mode: 'all' }, amount, paymentMethod, paymentStatus: paymentMethod === 'cash' ? 'CASH_PENDING' : 'PAYMENT_PENDING', status: paymentMethod === 'cash' ? 'CASH_PENDING' : 'PAYMENT_PENDING', createdAt: now(), updatedAt: now(), message: paymentMethod === 'cash' ? 'Cash order is waiting for shop approval.' : 'Online payment gateway is not configured yet; no print job was released.' };
  orders.set(order.id, order); file.orderId = order.id;
  res.status(201).json({ order: publicOrder(order) });
});

app.get('/api/orders/:orderId', (req, res) => { const o = orders.get(req.params.orderId); if (!o) return res.status(404).json({ error: 'ORDER_NOT_FOUND' }); res.json({ order: publicOrder(o) }); });
app.delete('/api/uploads/:ref', (req, res) => { cleanupUpload(req.params.ref); res.status(204).end(); });

// Replace this adapter with a real verified payment provider in Phase 2.
const PaymentProvider = { isVerified: order => order.paymentStatus === 'PAID' };
// Replace this mock with a signed, outbound shop-agent connector. It never accepts unpaid jobs.
const PrintConnector = { release: async order => { if (!PaymentProvider.isVerified(order)) throw new Error('PAYMENT_NOT_VERIFIED'); return { connectorJobId: id('job') }; } };

function cleanupUpload(ref) { const file = uploads.get(ref); if (!file) return; try { fs.rmSync(file.path, { force: true }); } catch {} uploads.delete(ref); }
function cleanup() { const cutoff = Date.now() - 5 * 60 * 1000; for (const [ref, f] of uploads) if (f.createdAt < cutoff) { const o = f.orderId && orders.get(f.orderId); if (!o || !['PRINTED', 'FAILED'].includes(o.status)) { if (o && o.status !== 'PRINTED') { o.status = 'EXPIRED'; o.paymentStatus = o.paymentStatus === 'PAID' ? 'REFUND_REVIEW' : o.paymentStatus; o.updatedAt = now(); } cleanupUpload(ref); } } }
setInterval(cleanup, 60_000).unref();
app.get('/print/shop/:shopId', (_, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
app.use((_, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
const server = app.listen(PORT, '0.0.0.0', () => console.log(`Printer Auto running on http://0.0.0.0:${PORT}`));
process.on('SIGTERM', () => { for (const ref of uploads.keys()) cleanupUpload(ref); server.close(() => process.exit(0)); });
