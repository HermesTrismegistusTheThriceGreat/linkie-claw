#!/bin/sh
echo "=== n8n Startup Diagnostics ==="
echo "Waiting 5s for private networking..."
sleep 5

echo ""
echo "--- Environment ---"
echo "DB_POSTGRESDB_HOST=$DB_POSTGRESDB_HOST"
echo "DB_POSTGRESDB_PORT=$DB_POSTGRESDB_PORT"
echo "DB_POSTGRESDB_SSL_ENABLED=$DB_POSTGRESDB_SSL_ENABLED"
echo "NODE_OPTIONS=$NODE_OPTIONS"

echo ""
echo "--- DNS Resolution ---"
echo "Resolving $DB_POSTGRESDB_HOST..."
node -e "
const dns = require('dns');
const host = process.env.DB_POSTGRESDB_HOST || 'localhost';
dns.resolve4(host, (err, addrs) => {
  console.log('IPv4:', err ? err.code : addrs);
});
dns.resolve6(host, (err, addrs) => {
  console.log('IPv6:', err ? err.code : addrs);
});
dns.lookup(host, (err, addr, family) => {
  console.log('Default lookup:', err ? err.code : addr, 'family:', family);
});
dns.lookup(host, { family: 4 }, (err, addr) => {
  console.log('Forced IPv4 lookup:', err ? err.code : addr);
});
"

echo ""
echo "--- TCP Connection Test ---"
node -e "
const net = require('net');
const host = process.env.DB_POSTGRESDB_HOST || 'localhost';
const port = process.env.DB_POSTGRESDB_PORT || 5432;
console.log('Connecting to', host + ':' + port, '...');
const sock = new net.Socket();
sock.setTimeout(10000);
sock.connect(parseInt(port), host, () => {
  console.log('TCP CONNECTED to', sock.remoteAddress + ':' + sock.remotePort);
  sock.destroy();
});
sock.on('error', (e) => {
  console.log('TCP ERROR:', e.message);
});
sock.on('timeout', () => {
  console.log('TCP TIMEOUT after 10s');
  sock.destroy();
});
"

echo ""
echo "--- Also testing internal hostname directly ---"
node -e "
const net = require('net');
console.log('Connecting to postgres.railway.internal:5432 ...');
const sock = new net.Socket();
sock.setTimeout(10000);
sock.connect(5432, 'postgres.railway.internal', () => {
  console.log('INTERNAL TCP CONNECTED to', sock.remoteAddress + ':' + sock.remotePort);
  sock.destroy();
});
sock.on('error', (e) => {
  console.log('INTERNAL TCP ERROR:', e.message);
});
sock.on('timeout', () => {
  console.log('INTERNAL TCP TIMEOUT after 10s');
  sock.destroy();
});
"

# Wait for diagnostics to complete
sleep 3

echo ""
echo "=== Starting n8n ==="
exec n8n
