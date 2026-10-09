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
    """Print locally and return evidence; never claim success from a browser assertion."""
    evidence = {'printerName': printer, 'verifiedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'exitCode': 1, 'localJobId': f'{platform.node()}-{int(time.time()*1000)}'}
    if not printer or not file_ref or not Path(file_ref).is_file() or Path(file_ref).is_symlink():
        evidence['error'] = 'Local printer or private job file unavailable.'
        return {'ok': False, 'evidence': evidence}
    try:
        if platform.system() == 'Windows':
            ps = "Start-Process -FilePath $args[0] -Verb PrintTo -ArgumentList $args[1] -PassThru | Out-Null; Start-Sleep -Seconds 2"
            subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', ps, str(file_ref), printer], check=True, timeout=120, capture_output=True)
        else:
            subprocess.run(['lp', '-d', printer, '-n', str(max(1, int(copies))), str(file_ref)], check=True, timeout=120, capture_output=True)
        evidence['exitCode'] = 0
        return {'ok': True, 'evidence': evidence}
    except Exception as exc:
        evidence['error'] = 'Local print command failed.'
        return {'ok': False, 'evidence': evidence}

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--backend', required=True); ap.add_argument('--pairing-id'); ap.add_argument('--code'); ap.add_argument('--device-name', default=f'Printer Auto Connector ({platform.node()})'); ap.add_argument('--interval', type=int, default=5); ap.add_argument('--test', action='store_true'); args=ap.parse_args(); base=args.backend.rstrip('/')
    if args.pairing_id and args.code:
        d=request(base+'/api/connector/register','POST',{'pairingId':args.pairing_id,'code':args.code,'deviceName':args.device_name}); CONFIG.write_text(json.dumps(d)); os.chmod(CONFIG,0o600); print(f"Registered for shop {d['shopId']}")
    if not CONFIG.exists(): raise SystemExit('Pair the connector first with --pairing-id and --code')
    cfg=json.loads(CONFIG.read_text()); token=cfg['token']; names=detect_printers(); printer=names[0] if names else ''
    print('Detected printers:', ', '.join(names) or 'none')
    while True:
        try:
            request(base+'/api/connector/heartbeat','POST',{'status':'ONLINE' if printer else 'OFFLINE','printerName':printer,'error':None if printer else 'No local printer detected.'},token)
            for job in request(base+'/api/connector/jobs',token=token).get('jobs',[]):
                local_file = download_job(base, token, job) if printer else ''; result = print_file(printer, local_file, job.get('copies',1), bool(job.get('test'))) if printer else {'ok': False, 'evidence': {'printerName': '', 'verifiedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'exitCode': 1, 'localJobId': f'{platform.node()}-{int(time.time()*1000)}', 'error': 'No local printer detected.'}}; Path(local_file).unlink(missing_ok=True) if local_file else None
                request(base+'/api/connector/jobs/'+job['id']+'/complete','POST',{'result':'PRINTED' if result['ok'] else 'PRINT_FAILED','completionToken':job.get('completionToken',''),'evidence':result['evidence']},token)
            time.sleep(max(2,args.interval))
        except (urllib.error.URLError, OSError, ValueError) as e:
            print('Connector temporarily offline:', e, file=sys.stderr); time.sleep(max(5,args.interval))

if __name__ == '__main__': main()
