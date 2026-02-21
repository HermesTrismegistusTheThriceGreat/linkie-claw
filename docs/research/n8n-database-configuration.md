# n8n Database Configuration Reference

**Date:** 2026-02-20
**n8n Version:** 2.8.x
**Sources:** n8n docs, GitHub source code, community forums

---

## PostgreSQL Environment Variables

n8n does NOT support `DATABASE_URL`. It requires individual variables:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DB_TYPE` | String | `sqlite` | Must be `postgresdb` for PostgreSQL |
| `DB_POSTGRESDB_HOST` | String | `localhost` | PostgreSQL host |
| `DB_POSTGRESDB_PORT` | Number | `5432` | PostgreSQL port |
| `DB_POSTGRESDB_DATABASE` | String | `n8n` | Database name |
| `DB_POSTGRESDB_USER` | String | `postgres` | Database user |
| `DB_POSTGRESDB_PASSWORD` | String | | Database password |
| `DB_POSTGRESDB_SCHEMA` | String | `public` | Schema name |

## SSL Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DB_POSTGRESDB_SSL_ENABLED` | Boolean | `false` | Enable SSL (auto-enabled if CA/cert/key defined) |
| `DB_POSTGRESDB_SSL_CA` | String | | PEM certificate authority content |
| `DB_POSTGRESDB_SSL_CERT` | String | | PEM client certificate content |
| `DB_POSTGRESDB_SSL_KEY` | String | | PEM client private key content |
| `DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED` | Boolean | `true` | Reject self-signed/invalid certs |

All variables support `_FILE` suffix to read from files (e.g., `DB_POSTGRESDB_SSL_CA_FILE`).

## How n8n Configures SSL Internally

From `packages/cli/src/Db.ts`:

```typescript
let ssl: TlsOptions | undefined;
if (sslCa !== '' || sslCert !== '' || sslKey !== '' || !sslRejectUnauthorized) {
    ssl = {
        ca: sslCa || undefined,
        cert: sslCert || undefined,
        key: sslKey || undefined,
        rejectUnauthorized: sslRejectUnauthorized,
    };
}
```

This object is passed to TypeORM → node-postgres → Node.js TLSSocket.

## Known Bugs

### Bug #17723: System Trust Store Ignored
n8n ignores system trust store and `PGSSLROOTCERT` env var. Custom CA certificates require `/opt/custom-certificates` to be writable.

### Bug: PGSSLMODE vs rejectUnauthorized
`PGSSLMODE=no-verify` and `{ ssl: { rejectUnauthorized: false } }` are NOT equivalent in node-postgres. The config object may not be respected properly.

**Source:** [node-postgres Issue #2607](https://github.com/brianc/node-postgres/issues/2607)

## Railway-Specific Configuration

For Railway private networking (`postgres.railway.internal`):
```env
DB_POSTGRESDB_SSL_ENABLED=false
```
SSL is NOT required on Railway's private network — it's already Wireguard-encrypted.

For Railway public proxy (`turntable.proxy.rlwy.net:PORT`):
```env
DB_POSTGRESDB_SSL_ENABLED=true
DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false
```
The public proxy requires SSL. Railway uses self-signed certs, so reject must be false.

## Other Important n8n Variables

| Variable | Description |
|----------|-------------|
| `N8N_LISTEN_ADDRESS` | Set to `::` for IPv6 support (required on Railway) |
| `N8N_PORT` | HTTP port (default 5678) |
| `N8N_HOST` | Public hostname for webhook URLs |
| `N8N_PROTOCOL` | `https` for production |
| `N8N_ENCRYPTION_KEY` | Encryption key for credentials storage |
| `WEBHOOK_URL` | Base URL for webhooks (include trailing slash) |

## Sources

- [n8n Database Environment Variables](https://docs.n8n.io/hosting/configuration/environment-variables/database/)
- [n8n Supported Databases](https://docs.n8n.io/hosting/configuration/supported-databases-settings/)
- [n8n Source: Db.ts](https://github.com/n8n-io/n8n/blob/n8n@0.150.0/packages/cli/src/Db.ts)
- [n8n Issue #17723](https://github.com/n8n-io/n8n/issues/17723)
- [n8n Issue #15584](https://github.com/n8n-io/n8n/issues/15584)
- [node-postgres SSL docs](https://node-postgres.com/features/ssl)
