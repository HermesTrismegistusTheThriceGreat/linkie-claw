# Managing Services

A Railway Service functions as a deployment target for your application. As you create and modify services, changes accumulate in [staged changes](/guides/staged-changes) requiring review before deployment.

## Creating a Service

Launch a new service via the `New` button in your project canvas's top right, or access the command palette with `CMD + K` (Mac) or `Ctrl + K` (Windows) and type "new service."

Services on Railway support deployment from GitHub repositories, local directories, or Docker images.

## Accessing Service Settings

Click the service tile on your project canvas and navigate to the Settings tab.

## Defining a Deployment Source

For empty services or updating existing sources, access the Service settings and locate the **Service Source** option.

### Deploying From a GitHub Repo

Choose `Connect Repo` and select your target repository. "When a new commit is pushed to the linked branch, Railway will automatically build and deploy the new code."

Link your Railway account to GitHub first via the Railway App configuration.

### Deploying a Public Docker Image

Specify the image path during creation. Railway supports Docker Hub, GitHub Container Registry, Quay.io, GitLab Container Registry, and Microsoft Container Registry.

Example paths include `bitnami/redis`, `ghcr.io/railwayapp-templates/postgres-ssl:latest`, and `quay.io/username/repo:tag`.

### Updating Docker Images

"Railway automatically monitors Docker images for new versions." Manual update buttons appear in service settings. "For tags without versions (e.g., `nginx:latest`), Railway redeploys the existing tag to pull the latest image digest."

Configure automatic updates with scheduled maintenance windows in service settings.

### Deploying a Private Docker Image

Private registry deployments require the Pro plan. Provide image path and authentication credentials during creation.

For GitHub Container Registry, supply a personal access token (classic).

## Deploying From a Local Directory

Using the CLI requires:

1. Create an Empty Service
2. Navigate to your directory in Terminal
3. Execute `railway link` to connect to your project
4. Run `railway up` and select your empty service

## Deploying a Monorepo

Refer to the [monorepo guide](/guides/monorepo) for detailed instructions.

## Monitoring

Access logs, metrics, and usage data through the [monitoring guides](/guides/monitoring).

## Changing the Service Icon

1. Right-click the service
2. Select `Update Info`
3. Choose `Icon`
4. Type to filter from available icons via the devicons service

## Approving a Deployment

When GitHub repo members lack linked Railway accounts, deployments require approval. "Deploy the queued deployment by clicking the "Approve" button."

## Storing Data

Services include 10GB ephemeral storage. For persistent data or additional capacity, add a [volume](/guides/volumes).

## Deleting a Service

Access project settings and scroll to the danger section to delete a service.
