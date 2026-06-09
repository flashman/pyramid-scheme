#!/usr/bin/env python3
"""
Generate QR code data for frontend/game/payment.js.

Usage:
  pip install qrcode
  python3 scripts/gen-qr.py 'https://venmo.com/...'

Prints a compact flat string (1s and 0s) representing the QR matrix.
Set the output as the PAYMENT_QR_DATA environment variable in Render.
"""
import sys
import qrcode

if len(sys.argv) < 2:
    print("Usage: python3 scripts/gen-qr.py '<URL>'", file=sys.stderr)
    sys.exit(1)

url = sys.argv[1]
qr  = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=1, border=0)
qr.add_data(url)
qr.make(fit=True)

matrix = qr.get_matrix()
flat   = ''.join('1' if c else '0' for row in matrix for c in row)

print(f"# URL:    {url}")
print(f"# Size:   {len(matrix)}x{len(matrix)} ({len(flat)} chars)")
print(f"# Set as PAYMENT_QR_DATA env var in Render:")
print(flat)
