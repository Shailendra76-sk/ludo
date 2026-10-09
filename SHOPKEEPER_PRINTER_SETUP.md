# Shopkeeper Printer Setup Guide

This guide covers the secure connector flow. The panel does **not** claim that a printer is connected or that a print succeeded without a fresh authenticated heartbeat and connector evidence.

## Prerequisites / आवश्यकताएँ

- Windows 10/11 shop computer (or a supported Linux host for the Python agent).
- Official printer driver from the manufacturer.
- USB cable or reachable local network printer.
- Outbound HTTPS access to the PrinterAuto backend.
- Shopkeeper access to `/shopkeeper`.
- Paper and ink/toner loaded.

## 1. Windows driver setup / Windows driver लगाना

1. Download the driver only from the printer manufacturer.
2. Install the driver and add the printer in **Settings → Bluetooth & devices → Printers & scanners**.
3. Open the printer queue and print a Windows test page.
4. Confirm the printer is not paused or offline.
5. Keep the exact printer name visible; the connector uses the local Windows printer name.
6. If detection fails, restart **Print Spooler** and reinstall the official driver.

## 2. USB printer / USB printer

1. Connect the printer directly to the connector computer.
2. Wait for driver setup to finish.
3. Print a local Windows test page before pairing.
4. Do not expose USB printer administration or the connector token to the internet.

## 3. Network printer / Network printer

1. Give the printer a stable local IP or DHCP reservation.
2. Add it using the manufacturer utility or Windows TCP/IP printer workflow.
3. Verify the local computer can print a test page.
4. Permit only the local network traffic required by the printer; the connector itself uses outbound HTTPS to the backend.

## 4. Install and pair the connector / Connector pair करना

1. Install Python 3.11+ or the approved packaged connector on the shop computer.
2. In **Shopkeeper → Printer Management**, select **Pair connector**.
3. Run the connector with the backend URL, pairing ID and one-time code:

```bash
python connector/agent.py \
  --backend https://YOUR-BACKEND.example \
  --pairing-id pair_... \
  --code 123456 \
  --device-name "Shop Windows Connector"
```

4. The code expires after ten minutes and can be used once. The bearer token is stored locally with restrictive permissions; never paste it into chat, tickets or browser code.
5. Confirm the panel shows a fresh heartbeat and the expected local printer name.
6. If a connector is compromised, select **Revoke**. Re-pair only after revocation; **Rotate** displays a replacement token once.

## 5. Verified test print / Verified test print

1. Wait until the connector status is `ONLINE`.
2. Select **Verified test print** for the intended printer.
3. The connector receives only a shop-authorized test job through its bearer token.
4. The panel shows `PRINTED` only after evidence contains the printer name, verification timestamp and successful command exit code.
5. A browser action alone can never mark a print successful.

## 6. Failed prints and retry / Failed print retry

- `PRINT_FAILED` includes a safe error only; private file paths and document contents are never shown.
- Fix paper, driver, queue, power or network problems before retrying.
- Use **Retry** only on a failed job and within the displayed bounded retry limit.
- A verified `PRINTED` job cannot be retried as a duplicate print.
- If no fresh connector heartbeat exists, retry is rejected rather than queued blindly.

## 7. Troubleshooting / समस्या समाधान

| Symptom | Check |
|---|---|
| Connector offline | Shop computer power/network, outbound HTTPS, token not revoked, connector process and heartbeat time |
| Printer not detected | Official driver, exact Windows printer name, Print Spooler, USB/network connection |
| Print failed | Paper, ink/toner, paused queue, default paper size, driver and local Windows test page |
| Pairing rejected | Code expired/used, wrong pairing ID, five failed attempts, or connector already revoked |
| Test result not verified | Wait for connector evidence; the server will not accept a browser assertion |
| File expired | Follow the configured retention policy; do not disable cleanup to recover a document |

## Hindi quick guide / हिन्दी quick guide

- **Pair:** Printer Management → Pair connector → code को केवल shop PC के connector में डालें।
- **Connected:** केवल fresh authenticated heartbeat पर `ONLINE` दिखेगा।
- **Printed:** केवल connector evidence मिलने पर `PRINTED` दिखेगा।
- **Retry:** पहले local समस्या ठीक करें; verified print को दोबारा queue नहीं किया जा सकता।
- **Security:** token, password, customer document और private file path किसी से share न करें।

## Privacy and retention

Customer documents stay in private storage and are accessed by a connector only through an authenticated, shop-scoped job route. Completed, failed and abandoned files follow the configured retention lifecycle. Help Center and AI help receive only curated instructions and aggregate printer state; they do not receive customer document contents, tokens, passwords or arbitrary order data.

## Production manual gates

Before launch, complete and record:

1. Staging Supabase migration and real RLS cross-shop tests.
2. Private Storage signed-stream and cleanup-retry tests.
3. Windows test print on every supported driver/printer family.
4. Connector token rotation/revocation drill.
5. Multi-instance queue/idempotency test with the configured durable backend.
6. Cashfree/Razorpay sandbox webhook verification and reconciliation.
7. Secret-manager, backup/restore and retention-policy review.
