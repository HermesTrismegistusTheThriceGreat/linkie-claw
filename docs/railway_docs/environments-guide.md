# Railway Environments: Complete Overview

Railway enables sophisticated development workflows through **isolated environment instances** that allow teams to manage multiple copies of their projects with separate services and configurations.

## Creating Environments

Users can establish new environments via the environment dropdown menu or Settings panel. Two options exist:

- **Duplicate Environment**: "creates a copy of the selected environment, including services, variables, and configuration." All components stage for deployment review before going live.

- **Empty Environment**: Launches with no pre-configured services, providing a blank slate for development.

## Syncing Between Environments

The sync feature lets developers transfer services across environment instances. After selecting a source environment, modified service cards receive status tags ("New", "Edited", "Removed"). Changes appear as staged deployments requiring approval before activation.

## Pull Request Environments

When activated, Railway automatically provisions temporary environments for each PR. These instances automatically delete upon PR closure or merge. The system requires that PR authors be team members or project invitees to prevent unauthorized deployments.

Domain provisioning occurs automatically in PR environments when corresponding base services use Railway-provided domains.

### Bot Support

Automatic PR environments can be enabled for supported automation tools including Dependabot, Renovate, Devin AI, GitHub Actions, GitHub Copilot, Jules, Roo Code, and Claude Code.

## Access Control (Enterprise)

"Restrict access to sensitive environments like production" through role-based controls. Admins manage restrictions while Members and Deployers cannot access restricted environment resources, though they can trigger deployments via git.

## Legacy Considerations

Forked environments are deprecated; teams should transition to the sync workflow for managing environment changes.
