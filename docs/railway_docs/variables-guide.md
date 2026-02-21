# Using Variables in Railway

This guide explains how to manage configuration and secrets across services in Railway through environment variables.

## Overview

Variables become available to applications during:
- Build processes for service deployments
- Running service deployments
- Commands invoked via `railway run`
- Local shell access through `railway shell`

"Adding, updating, or removing variables, results in a set of staged changes that you must review and deploy, in order to apply them."

## Service Variables

Individual service variables are configured through each service's "Variables" tab. Users can either enter variables individually via "New Variable" or bulk-import using the "RAW Editor" to paste `.env` or JSON-formatted content.

Railway automatically detects and suggests variables from `.env` files in repository root directories, supporting patterns like `.env`, `.env.example`, `.env.local`, `.env.production`, and custom `.env.<suffix>` formats.

## Shared Variables

"Shared variables help reduce duplication of variables across multiple services within the same project." These are defined in Project Settings → Shared Variables, then linked to services individually or batch-shared across multiple services.

## Reference Variables

Reference variables point to other variables using Railway's template syntax. The three types include:

**Shared variables:** `${{ shared.VARIABLE_KEY }}`

**Other services:** `${{SERVICE_NAME.VAR }}` or `${{ service.RAILWAY_PUBLIC_DOMAIN }}`

**Same service:** `${{ VARIABLE_NAME }}`

The dashboard provides autocomplete dropdowns to simplify creating reference variables.

## Sealed Variables

"When a variable is sealed, its value is provided to builds and deployments but is never visible in the UI." Sealed variables cannot be unsealed, and they're excluded from CLI output, PR environments, duplicated environments, diffs, and external integrations.

## Railway-Provided Variables

Common platform-supplied variables include `RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_PRIVATE_DOMAIN`, and `RAILWAY_TCP_PROXY_PORT`.

## Practical Usage

Variables are accessible through language-specific environment variable interfaces (e.g., `process.env.VARIABLE_NAME` in Node.js). Local development uses the CLI command `railway run <command>`.

Additional integrations support importing from Heroku and syncing Doppler secrets.
