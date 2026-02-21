# Deployments

Learn how to configure deployments on Railway.

Now that you understand how to tailor your builds if necessary, let's get into the various ways you can control how your services are deployed and run. Like builds, when you deploy a service, Railway will apply some defaults that can easily be overridden when necessary.

## Deployment Concepts

| Concept | Description |
|---------|-------------|
| **Deployment Controls** | Deployments are attempts to build and run your code. Railway provides controls for changing the default run behavior and managing existing deployments through rollbacks or restarts. |
| **Auto Deploys** | When you connect your GitHub repository, Railway will automatically build and deploy your code when you push a change to the connected branch. |
| **Regional Deployments** | Services deploy to your preferred region by default, with regional deployment options available to enhance performance for geographically dispersed users. |
| **Scaling** | The platform supports vertical auto-scaling automatically and horizontal scaling through replicas, making application expansion straightforward. |
| **Healthchecks** | Healthchecks can be configured on your services to control when a new deployment is deemed healthy and ready for connections. |
| **Monorepos** | Support for monorepo deployments requires configuration to specify your repository structure using available options. |
| **Scheduled Jobs** | Scheduled Jobs, or Cron Jobs, are pieces of code that are executed on a schedule with easy configuration options available. |
| **Usage Optimization** | Tools are provided to manage resource consumption, including usage limits and auto-sleep functionality for inactive deployments. |

Dive into the next pages to learn how to configure these items.

## Railway Deployments Overview

This page covers eight key deployment concepts on Railway:

1. **Deployment Controls** - Deployments are attempts to build and run your code. Railway lets you modify run behavior and manage existing deployments through rollbacks or restarts.

2. **Auto Deploys** - When connected to GitHub, Railway automatically builds and deploys code updates pushed to the linked branch.

3. **Regional Deployments** - Services default to your preferred region, but Railway supports regional deployment options for better global performance.

4. **Scaling** - The platform handles vertical auto-scaling automatically. Horizontal scaling is available through replicas.

5. **Healthchecks** - These can be configured to determine when deployments are healthy and ready to receive traffic.

6. **Monorepos** - Railway supports monorepo deployments using configuration options to define repository structure.

7. **Scheduled Jobs** - Cron jobs execute code on a schedule, with simple configuration through Railway's Cron Schedule settings.

8. **Usage Optimization** - Tools are available to control usage, including usage limits and auto-sleep features for inactive deployments.
