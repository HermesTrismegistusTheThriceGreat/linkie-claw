# Config as Code

Railway supports defining configuration for deployments in files alongside your code. The platform looks for `railway.toml` or `railway.json` files by default.

## Overview

"Everything in the build and deploy sections of the service settings can be specified in this configuration file." When deployments are triggered, Railway combines values from config files with dashboard settings, with code-based configuration always taking precedence.

## How It Works

The resulting build and deploy config applies "only for the current deployment." Dashboard settings remain unchanged, and "Configuration defined in code will always override values from the dashboard."

## Config Source Location

The deployment details page displays all settings used. Settings from configuration files show a file icon; hovering reveals the exact file source.

## Build Configuration Options

**Builder Selection** - Specify `RAILPACK` (default), `DOCKERFILE`, or `NIXPACKS` (deprecated).

**Watch Patterns** - Define deployment triggers with patterns like `["src/**"]`.

**Build Command** - Pass custom build commands to Nixpacks builder; can be `null`.

**Dockerfile Path** - Point to non-standard Dockerfiles; supports `null` values.

**Railpack Version** - Must be a valid release version; can be `null`.

## Deploy Configuration Options

**Start Command** - The container startup command; nullable.

**Pre-deploy Command** - Commands executing before container start.

**Healthcheck Configuration** - Set paths and timeout values (in seconds).

**Restart Policy** - Choose from `ON_FAILURE`, `ALWAYS`, or `NEVER`; optionally set max retries.

**Multi-region Configuration** - Deploy replicas across regions with specified replica counts.

**Cron Schedule** - Define job scheduling using standard cron syntax.

## Environment-Specific Overrides

Configuration can be customized per environment using `environments.[name]` blocks. For PR deployments, use the special `pr` environment name, which applies to ephemeral environments only.

## Deployment Teardown Settings

**Overlap Seconds** - Duration previous deployment overlaps with new one.

**Draining Seconds** - Time between SIGTERM and SIGKILL signals.
