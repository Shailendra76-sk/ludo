#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const build = fs.readFileSync(path.join(__dirname, 'build-windows.ps1'), 'utf8');
const iss = fs.readFileSync(path.join(__dirname, 'PrinterAutoConnector.iss'), 'utf8');
const verify = fs.readFileSync(path.join(__dirname, 'verify-release.ps1'), 'utf8');
const workflow = fs.readFileSync(path.join(root, '.github', 'workflows', 'windows-connector-build.yml'), 'utf8');
const requirements = fs.readFileSync(path.join(root, 'requirements-windows.txt'), 'utf8');
const agent = fs.readFileSync(path.join(root, 'connector', 'agent.py'), 'utf8');
assert.match(requirements, /pyinstaller==6\.22\.3/);
assert.ok((requirements.match(/--hash=sha256:/g) || []).length >= 5);
assert.match(build, /--require-hashes/);
assert.match(build, /signtool verify/);
assert.match(build, /Get-FileHash/);
assert.match(build, /AllowUnsignedTestBuild/);
assert.match(build, /productionEligible/);
assert.match(verify, /SHA-256 mismatch/);
assert.match(verify, /signtool verify/);
assert.match(iss, /PrivilegesRequired=lowest/);
assert.match(iss, /Uninstallable=yes/);
assert.match(iss, /PrinterAutoConnector-\{#AppVersion\}-Setup/);
assert.match(iss, /UninstallDelete/);
for (const secret of ['OPENAI_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PAYMENT_WEBHOOK_SECRET', 'ADMIN_PASSWORD']) {
  assert.ok(!iss.includes(secret), `installer embeds forbidden secret name: ${secret}`);
}
assert.match(agent, /--pairing-id/);
assert.match(agent, /secure_config_file/);
assert.match(agent, /--health-check/);
assert.match(agent, /--version/);
assert.match(workflow, /runs-on: windows-2022/);
assert.match(workflow, /python-version: '3\.11\.9'/);
assert.match(workflow, /innosetup --version=6\.2\.2/);
assert.match(workflow, /AllowUnsignedTestBuild/);
assert.match(workflow, /verify-release\.ps1/);
assert.match(workflow, /upload-artifact@v4/);
assert.ok(!workflow.includes('actions: write'), 'workflow must not request write permissions');
console.log(JSON.stringify({ ok: true, assertions: ['pinned hashed Windows dependencies', 'fail-closed build checks', 'signature and SHA-256 verification', 'least-privilege installer', 'versioned upgrade filename', 'uninstall definition', 'no embedded secrets', 'first-run pairing', 'health-check and version commands', 'Windows hosted CI workflow', 'pinned CI tool versions', 'unsigned test-only artifact gate', 'signed candidate verification gate'] }, null, 2));
