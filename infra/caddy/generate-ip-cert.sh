#!/usr/bin/env sh
# Generate self-signed TLS cert for a bare public IP (browser warning expected).
set -eu
IP="${1:?Usage: $0 <PUBLIC_IP>}"
DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)/certs"
mkdir -p "$DIR"
openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
  -keyout "$DIR/key.pem" \
  -out "$DIR/cert.pem" \
  -subj "/CN=$IP" \
  -addext "subjectAltName=IP:$IP"
chmod 644 "$DIR/cert.pem"
chmod 600 "$DIR/key.pem"
echo "Wrote $DIR/cert.pem and $DIR/key.pem for IP $IP"
