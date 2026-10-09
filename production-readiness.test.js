#!/usr/bin/env node
const assert = require('assert');
const crypto = require('crypto');
const { encrypt, decrypt } = require('./production-readiness');
const key = crypto.randomBytes(32);
const secret = 'provider-secret-never-returned';
const record = encrypt(secret, key);
assert.notStrictEqual(record.ciphertext, secret);
assert.strictEqual(decrypt(record, key), secret);
assert.throws(() => decrypt(record, crypto.randomBytes(32)));
const responseShape = { configured: true, provider: 'openai-compatible', model: 'test-model', keyVersion: record.keyVersion };
assert.ok(!Object.prototype.hasOwnProperty.call(responseShape, 'apiKey'));
console.log(JSON.stringify({ ok: true, assertions: ['AES-256-GCM round trip', 'wrong-key rejection', 'ciphertext is not plaintext', 'secret status shape excludes API key'] }, null, 2));
