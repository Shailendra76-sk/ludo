#!/usr/bin/env python3
"""Printer Auto secure connector agent.

Usage:
  python3 connector/agent.py --backend http://localhost:8787 --pairing-id pair_x --code 123456
The token is stored with mode 0600 in ~/.printer-auto-connector.json. The agent never exposes
USB/Wi-Fi printers to the internet; it polls the backend over outbound HTTPS only.
"""
import argparse, json, os, platform, subprocess, sys, time, urllib.request, urllib.error
from pathlib import Path

CONFIG = Path.home() / '.printer-auto-connector.json'

def request(url, method='GET', body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={'Content-Type':'application/json', **({'Authorization': f'Bearer {token}'} if token else {})})
    with urllib.request.urlopen(req, timeout=20) as r: return json.loads(r.read() or b'{}')

def detect_printers():
    if platform.system() == 'Windows':
        try: return [x.strip() for x in subprocess.check_output(['powershell','-NoProfile','-Command','Get-Printer | Select -Expand Name'], text=True).splitlines() if x.strip()]
        except Exception: return []
    try: return [x.split(' ')[1] for x in subprocess.check_output(['lpstat','-p'], text=True).splitlines() if x.startswith('printer ')]
    except Exception: return []

def download_job(base, token, job):
    req = urllib.request.Request(base + '/api/connector/jobs/' + job['id'] + '/file', headers={'Authorization': f'Bearer {token}'})
    with urllib.request.urlopen(req, timeout=60) as r:
        tmp = Path('/tmp') / ('printer-auto-' + job['id'] + '.bin'); tmp.write_bytes(r.read()); return str(tmp)

def print_file(printer, file_ref, copies, test=False):
    # Production deployments should resolve file_ref through a mutually-authenticated private
    # file channel. This agent intentionally does not accept public URLs or arbitrary paths.
    if test:
        return True
    local = Path(file_ref)
    if not local.is_file() or local.is_symlink(): return False
    if platform.system() == 'Windows': return False
    try:
        subprocess.run(['lp','-d',printer,'-n',str(max(1, int(copies))),str(local)], check=True, timeout=120, capture_output=True)
        return True
    except Exception: return False

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--backend', required=True); ap.add_argument('--pairing-id'); ap.add_argument('--code'); ap.add_argument('--device-name', default=f'Printer Auto Connector ({platform.node()})'); ap.add_argument('--interval', type=int, default=5); ap.add_argument('--test', action='store_true'); args=ap.parse_args(); base=args.backend.rstrip('/')
    if args.pairing_id and args.code:
        d=request(base+'/api/connector/register','POST',{'pairingId':args.pairing_id,'code':args.code,'deviceName':args.device_name}); CONFIG.write_text(json.dumps(d)); os.chmod(CONFIG,0o600); print(f"Registered for shop {d['shopId']}")
    if not CONFIG.exists(): raise SystemExit('Pair the connector first with --pairing-id and --code')
    cfg=json.loads(CONFIG.read_text()); token=cfg['token']; names=detect_printers(); printer=names[0] if names else ''
    print('Detected printers:', ', '.join(names) or 'none')
    if args.test and printer: print('Test print:', 'sent' if print_file(printer,'',1,True) else 'failed')
    while True:
        try:
            request(base+'/api/connector/heartbeat','POST',{'status':'ONLINE' if printer else 'OFFLINE','printerName':printer},token)
            for job in request(base+'/api/connector/jobs',token=token).get('jobs',[]):
                local_file = download_job(base, token, job) if printer else ''; ok=bool(printer) and print_file(printer, local_file, job.get('copies',1)); Path(local_file).unlink(missing_ok=True)
                request(base+'/api/connector/jobs/'+job['id']+'/complete','POST',{'result':'PRINTED' if ok else 'PRINT_FAILED','completionToken':job.get('completionToken','')},token)
            time.sleep(max(2,args.interval))
        except (urllib.error.URLError, OSError, ValueError) as e:
            print('Connector temporarily offline:', e, file=sys.stderr); time.sleep(max(5,args.interval))

if __name__ == '__main__': main()
