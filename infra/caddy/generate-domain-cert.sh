#!/usr/bin/env sh
# Self-signed cert for origin behind Cloudflare (use CF SSL mode: Full).
# For Full (strict) / public trust without Cloudflare, use Caddy Let's Encrypt instead.
set -eu
HOST="${1:?Usage: $0 <hostname>}"
DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)/certs"
mkdir -p "$DIR"
openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
  -keyout "$DIR/key.pem" \
  -out "$DIR/cert.pem" \
  -subj "/CN=$HOST" \
  -addext "subjectAltName=DNS:$HOST"
chmod 644 "$DIR/cert.pem"
chmod 600 "$DIR/key.pem"
echo "Wrote $DIR/cert.pem and $DIR/key.pem for $HOST"
