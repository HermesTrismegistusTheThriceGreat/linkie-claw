# Environments

Railway environments provide isolated instances of all services within a project.

## Overview

All Railway projects include a `production` environment by default. Additional environments can be created afterward to support various development workflows.

## Environment Categories

**Persistent Environments**
These remain isolated from production while maintaining their own configurations. A common implementation involves a `staging` environment that automatically deploys from a designated branch with staging-specific variables.

**PR Environments**
These temporary environments are automatically generated when pull requests are opened and removed once the PR is merged or closed.

## Isolation Benefits

Service modifications are contained within a single environment, preventing unintended impacts on other environments or production systems.

## Common Applications

Development teams typically use environments to keep production separate from testing and iteration:

- Create individual development environments for team members that mirror the production setup
- Maintain distinct staging and production environments with automatic deployments tied to different repository branches

## Additional Resources

Detailed guidance on managing and configuring environments is available in the Environments guide.
