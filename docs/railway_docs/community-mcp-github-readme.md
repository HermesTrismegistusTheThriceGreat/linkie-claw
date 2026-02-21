# Railway MCP Server - Complete Documentation

## Project Overview

Railway MCP is an unofficial, community-built Model Context Protocol server enabling Claude and other MCP clients to manage Railway.app infrastructure through natural language commands.

**Key Tagline:** "Let Claude and other MCP clients manage your Railway.app infrastructure. Deploy services, manage variables, and monitor deployments - all through natural language."

## Core Features

### Completed Functionality (✅)
- Authentication via Railway API tokens
- Project operations (listing, retrieval, deletion)
- Deployment management including restart capabilities
- Service creation from GitHub repositories or Docker images
- Variable management (creation, updates, deletion)
- Service network and volume management

### In Development (🚧)
- Database template support with automated workflows
- Common workflow implementations
- Service configuration updates

### Not Yet Available (❌)
- Full template support across all types
- Automatic GitHub repository linking

## Installation Guide

### Prerequisites
- Node.js 18+ (native fetch API support)
- Active Railway account
- Railway API token (obtainable at railway.app/account/tokens)

### Installation Methods

**Via Smithery (Recommended for Claude Desktop):**
```
npx -y @smithery/cli install @jason-tan-swe/railway-mcp --client claude
```

**Manual Configuration (Claude Desktop):**

Users modify their configuration file at `~/Library/Application\ Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows) to include the server settings with their API token.

## Compatible MCP Clients

- **Claude for Desktop** - Battle-tested ✅
- **Cursor** - Needs testing ✅
- **Cline, Windsurf, Others** - Under evaluation 🚧

## Available Tools

### Authentication
- `configure` - Set Railway API token if not provided via environment variables

### Project Management
- `project-list` - Retrieve all projects
- `project-info` - Detailed project information
- `project-create` - New project creation
- `project-delete` - Project removal
- `project-environments` - List project environments

### Service Operations
- `service-list` - View all services in a project
- `service-info` - Detailed service information
- `service-create-from-repo` - GitHub repository integration
- `service-create-from-image` - Docker image deployment
- `service-delete` - Service removal
- `service-restart` - Service restart capability
- `service-update` - Configuration modifications

### Deployment Management
- `deployment-list` - Recent deployment history
- `deployment-trigger` - Initiate new deployments
- `deployment-logs` - Access deployment logs
- `deployment-health-check` - Status verification

### Variable Configuration
- `variable-list` - Environment variable retrieval
- `variable-set` - Variable creation/updates
- `variable-delete` - Variable removal
- `variable-bulk-set` - Multiple variable updates
- `variable-copy` - Cross-environment variable transfer

### Database Services
- `database-list-types` - Available database options
- `database-deploy` - Database service deployment

## Security Considerations

The documentation emphasizes several security practices:

- API tokens grant complete account access and require secure handling
- Token storage in configuration files remains within dedicated areas
- Sensitive values display masking automatically
- All communications use HTTPS encryption
- Tokens remain in system memory rather than written externally

## Recommended Companion MCP Servers

- Git (official implementation)
- GitHub (official or Smithery versions)

## Client-Specific Recommendations

**For Claude Desktop:** Service creation and monitoring represent optimal use cases, as terminal access limitations prevent direct deployment triggering.

**For Cursor:** Pair with GitHub MCP to leverage complete integration; users should verify Git commits are pushed before deployment requests.

## Troubleshooting

Common issues and solutions include:

- **Authentication problems:** Verify token validity and configuration file formatting
- **Connection failures:** Confirm Node.js version compatibility and restart applications
- **API errors:** Validate resource IDs and check Railway service status

## Contributing

The project welcomes community contributions. Developers should consult the Contributing Guidelines file for development standards and debugging procedures.

## Project Statistics

- **Repository Language:** TypeScript (98.7%)
- **License:** MIT
- **Stars:** 70
- **Forks:** 28
- **Contributors:** 6
- **Latest Release:** v1.3.0 (June 7, 2025)

## Usage Workflows

**Service Setup:**
1. List projects to obtain project ID
2. Create service from template
3. Configure environment variables
4. Monitor deployment status

**Variable Management:**
1. Identify target project
2. Review current variables
3. Create or modify as needed
4. Remove obsolete entries
