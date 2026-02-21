# Railway MCP - Stateful, Serverful, Pay-per-use Infrastructure

## Overview

Railway has developed a Model Context Protocol (MCP) server enabling AI coding agents to deploy applications and manage infrastructure directly from code editors. The server provides tools for continuous deployment, environment management, and resource configuration.

## Key Features

The Railway MCP server offers several capabilities for coding agents:

- **deploy**: Deploy services with support for repeated calls, allowing agents to apply continuous changes
- **deploy-template**: Deploy complex collections of services from the Railway Template Library
- **Environment management**: `create-environment` and `link-environment` tools for isolated workspaces
- **Configuration**: `list-variables` and `set-variables` for resource management
- **Debugging**: `get-logs` for retrieving build and deployment logs

## Why Railway for AI Agents

### Pricing and Autoscaling

The platform charges only for active compute time and actual resource usage. As noted in the article: "If an agent spins up resources that go idle shortly after, you don't get stuck with a big bill." All deployed services support vertical autoscaling automatically.

### Environments

Railway supports isolated environments, allowing multiple agents to operate in parallel without affecting other deployments.

## Design Decisions

### No Destructive Actions

The MCP server intentionally excludes deletion tools to reduce the risk of agents accidentally destroying resources, though agents can still execute arbitrary CLI commands.

### Local MCP Implementation

Rather than using remote HTTP-based transport, Railway chose a local stdio-based approach because:

- Most users work within code editors (VS Code, Cursor, Claude Code)
- Railway lacks OAuth support for secure remote authentication
- The Railway CLI provides seamless local authentication

### CLI Integration

The server executes Railway CLI commands under the hood, leveraging existing authentication flows and providing fallback capabilities when agents encounter edge cases.

## Getting Started

Setup requires three steps:
1. Install the Railway CLI
2. Run `railway login`
3. Install the MCP server

The complete implementation details are available on the project's GitHub repository.
