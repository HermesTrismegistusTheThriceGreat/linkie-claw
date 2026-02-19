#!/bin/sh
set -e

echo "=== n8n Database Connection Diagnostics ==="
echo "DB_TYPE: $DB_TYPE"
echo "DB_POSTGRESDB_HOST: $DB_POSTGRESDB_HOST"
echo "DB_POSTGRESDB_PORT: $DB_POSTGRESDB_PORT"
echo "DB_POSTGRESDB_DATABASE: $DB_POSTGRESDB_DATABASE"
echo "DB_POSTGRESDB_USER: $DB_POSTGRESDB_USER"
echo "DB_POSTGRESDB_SSL_ENABLED: $DB_POSTGRESDB_SSL_ENABLED"
echo "PGSSLMODE: $PGSSLMODE"
echo ""

echo "Testing DNS resolution..."
nslookup "$DB_POSTGRESDB_HOST" 2>&1 || echo "nslookup failed"
echo ""

echo "Testing pg_isready..."
pg_isready -h "$DB_POSTGRESDB_HOST" -p "$DB_POSTGRESDB_PORT" -U "$DB_POSTGRESDB_USER" 2>&1 || echo "pg_isready failed (exit: $?)"
echo ""

echo "Testing with PGSSLMODE=require..."
PGSSLMODE=require pg_isready -h "$DB_POSTGRESDB_HOST" -p "$DB_POSTGRESDB_PORT" -U "$DB_POSTGRESDB_USER" 2>&1 || echo "pg_isready with SSL failed (exit: $?)"
echo ""

echo "Testing internal hostname..."
pg_isready -h "postgres.railway.internal" -p 5432 -U postgres 2>&1 || echo "internal pg_isready failed (exit: $?)"
echo ""

echo "=== Starting n8n ==="
exec n8n
