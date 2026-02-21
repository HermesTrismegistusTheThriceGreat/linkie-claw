# Quick Start Tutorial

Railway is a deployment platform enabling infrastructure provisioning, local development, and cloud deployment. This guide covers getting started through two main approaches.

## Overview

The tutorial addresses two key topics:

1. **Project Deployment** - Three deployment methods are available:
   - GitHub repository integration
   - Command-line interface (CLI)
   - Docker image deployment

2. **Template Deployment** - Pre-configured software solutions requiring minimal setup effort

## Deployment Methods

### GitHub Deployment

Users can deploy directly from GitHub repositories through the Railway dashboard. The process involves:
- Creating a new project in the dashboard
- Selecting the GitHub repository option
- Choosing between immediate deployment or adding variables first

### CLI Deployment

For local code deployment, users can:
- Run `railway init` to scaffold a new project
- Execute `railway up` to compress and upload project files
- Use `railway open` to access the project canvas

### Docker Image Deployment

Railway supports images from multiple registries including Docker Hub, GitHub Container Registry, RedHat Container Registry, and GitLab Container Registry. Users create an empty project, add a service, specify the Docker image name, and deploy.

> "Private Docker registry deployments require the Pro plan"

## The Project Canvas

After deployment completes, users access the project canvas—described as the "mission control" for managing infrastructure, environments, and deployments. Domain generation is available through service settings once deployment finishes.

## Template Deployment

The template marketplace offers over 650 community and Railway-created templates. Deployment involves searching for a desired template, configuring any required settings, and clicking deploy.

## Next Steps

Recommended exploration areas include environments, observability dashboards, project member management, and staged changes functionality. Community support is available through Discord.
