# CLI Reference

The Railway Command Line Interface enables users to manage Railway projects from the terminal. This reference documents all available commands.

For installation instructions and usage examples, consult the [CLI guide](/guides/cli).

## Add

Incorporates a service into your project.

```txt
~ railway add --help
Add a service to your project

Usage: railway add [OPTIONS]

Options:
  -d, --database <DATABASE>
          The name of the database to add
          [possible values: postgres, mysql, redis, mongo]

  -s, --service [<SERVICE>]
          The name of the service to create (leave blank for randomly generated)

  -r, --repo <REPO>
          The repo to link to the service

  -i, --image <IMAGE>
          The docker image to link to the service

  -v, --variables <VARIABLES>
          The "{key}={value}" environment variable pair to set the service variables. Example:
          railway add --service --variables "MY_SPECIAL_ENV_VAR=1" --variables "BACKEND_PORT=3000"

      --json
          Output in JSON format

  -h, --help
          Print help (see a summary with '-h')

  -V, --version
          Print version
```

## Completion

Produces shell completion scripts for `bash`, `elvish`, `fish`, `powershell`, and `zsh`.

```txt
~ railway completion --help
Generate completion script

Usage: railway completion [OPTIONS] <SHELL>

Arguments:
  <SHELL>  [possible values: bash, elvish, fish, powershell, zsh]

Options:
      --json     Output in JSON format
  -h, --help     Print help
  -V, --version  Print version
```

## Connect

Establishes a connection to a database's shell interface (such as `psql` for Postgres or `mongosh` for MongoDB).

```txt
~ railway connect --help
Connect to a database's shell (psql for Postgres, mongosh for MongoDB, etc.)

Usage: railway connect [OPTIONS] [SERVICE_NAME]

Arguments:
  [SERVICE_NAME]  The name of the database to connect to

Options:
  -e, --environment <ENVIRONMENT>  Environment to pull variables from (defaults to linked environment)
      --json                       Output in JSON format
  -h, --help                       Print help
  -V, --version                    Print version
```

This requires the appropriate database client installed in your `$PATH`:

- Postgres: `psql` (https://www.postgresql.org/docs/current/app-psql.html)
- Redis: `redis-cli` (https://redis.io/docs/ui/cli/)
- MongoDB: `mongosh` (https://www.mongodb.com/docs/mongodb-shell/)
- MySQL: `mysql` (https://dev.mysql.com/doc/refman/8.0/en/mysql.html)

## Deploy

Provisions a template into your project.

```txt
railway deploy --help
Provisions a template into your project

Usage: railway deploy [OPTIONS]

Options:
  -t, --template <TEMPLATE>  The code of the template to deploy
  -v, --variable <VARIABLE>  The "{key}={value}" environment variable pair to set the template variables
          To specify the variable for a single service prefix it with "{service}." Example:
          bash railway deploy -t postgres -v "MY_SPECIAL_ENV_VAR=1" -v "Backend.Port=3000"

      --json                 Output in JSON format
  -h, --help                 Print help (see a summary with '-h')
  -V, --version              Print version
```

## Domain

Establishes a domain for a service, either custom or Railway-generated.

```txt
~ railway domain --help
Add a custom domain or generate a railway provided domain for a service

Usage: railway domain [OPTIONS] [DOMAIN]

Arguments:
  [DOMAIN]  Optionally, specify a custom domain to use. If not specified, a domain will be generated

Options:
  -p, --port <PORT>        The port to connect to the domain
  -s, --service <SERVICE>  The name of the service to generate the domain for
      --json               Output in JSON format
  -h, --help               Print help (see more with '--help')
  -V, --version            Print version
```

## Docs

Opens the Railway documentation website in your default browser.

```txt
~ railway docs --help
Open Railway Documentation in default browser

Usage: railway docs [OPTIONS]

Options:
      --json     Output in JSON format
  -h, --help     Print help
  -V, --version  Print version
```

## Down

Eliminates the most recent deployment.

```txt
~ railway down --help
Remove the most recent deployment

Usage: railway down [OPTIONS]

Options:
  -y, --yes      Skip confirmation dialog
      --json     Output in JSON format
  -h, --help     Print help
  -V, --version  Print version
```

## Environment

Manages environment creation, deletion, and linking.

```txt
~ railway [env]ironment --help
Create, delete or link an environment

Usage: railway environment [OPTIONS] [ENVIRONMENT] [COMMAND]

Commands:
  new     Create a new environment
  delete  Delete an environment [aliases: remove, rm]
  help    Print this message or the help of the given subcommand(s)

Arguments:
  [ENVIRONMENT]  The environment to link to

Options:
      --json     Output in JSON format
  -h, --help     Print help
  -V, --version  Print version
```

Refer to [environment documentation](/reference/environments) for additional details.

Running `railway environment` without arguments prompts selection from available project environments.

### railway environment new

Creates a new environment.

```txt
~ railway [env]ironment new --help
Create a new environment

Usage: railway environment new [OPTIONS] [NAME]

Arguments:
  [NAME]
          The name of the environment to create

Options:
  -d, --duplicate <DUPLICATE>
          The name of the environment to duplicate

          [aliases: copy]
          [short aliases: c]

  -v, --service-variable <SERVICE> <VARIABLE>
          Variables to assign in the new environment

          Note: This will only work if the environment is being duplicated, and that the service specified is present in the original environment

          Examples:

          railway environment new foo --duplicate bar --service-variable <service name/service uuid> BACKEND_PORT=3000

      --json
          Output in JSON format

  -h, --help
          Print help (see a summary with '-h')

  -V, --version
          Print version
```

### railway environment delete

Removes an environment.

```txt
~ railway [env]ironment delete --help
Delete an environment

Usage: railway environment delete [OPTIONS] [ENVIRONMENT]

Arguments:
  [ENVIRONMENT]  The environment to delete

Options:
  -y, --yes      Skip confirmation dialog
      --json     Output in JSON format
  -h, --help     Print help
  -V, --version  Print version
```

**Note**: This command is incompatible with accounts using two-factor authentication in non-interactive terminal sessions.

## Init

Generates a new Project via the CLI.

```txt
~ railway init --help
Create a new project

Usage: railway init [OPTIONS]

Options:
  -n, --name <NAME>          Project name
  -w, --workspace <NAME|ID>  Workspace to create the project in
      --json                 Output in JSON format
  -h, --help                 Print help
  -V, --version              Print version
```

## Link

Associates the current directory with an existing Railway project.

```txt
~ railway link --help
Associate existing project with current directory, may specify projectId as an argument

Usage: railway link [OPTIONS]

Options:
  -e, --environment <ENVIRONMENT>  Environment to link to
  -p, --project <PROJECT>          Project to link to
  -s, --service <SERVICE>          The service to link to
  -t, --team <TEAM>                The team to link to. Use "personal" for your personal account
      --json                       Output in JSON format
  -h, --help                       Print help
  -V, --version                    Print version
```

Executing `link` without specifying a project prompts team and project selection.

## List

Displays all projects in your Railway account.

```txt
~ railway list --help
List all projects in your Railway account

Usage: railway list [OPTIONS]

Options:
      --json     Output in JSON format
  -h, --help     Print help
  -V, --version  Print version
```

## Login

Authenticates your Railway account.

```txt
~ railway login --help
Login to your Railway account

Usage: railway login [OPTIONS]

Options:
  -b, --browserless  Browserless login
      --json         Output in JSON format
  -h, --help         Print help
  -V, --version      Print version
```

This directs to `https://railway.com/cli-login` in your browser.

### Browserless

In environments without browser access (such as SSH sessions or [Codespaces](https://github.com/features/codespaces)), perform a browserless login instead.

```txt
~ railway login --browserless
Browserless Login
Please visit:
  https://railway.com/cli-login?d=SGVsbG8sIGtpbmQgc3RyYW5nZXIhIFRoYW5rcyBmb3IgcmVhZGluZyB0aGUgZG9jdW1lbnRhdGlvbiEgSSBob3BlIHlvdSdyZSBoYXZpbmcgYSB3b25kZXJmdWwgZGF5IDopCg==
Your pairing code is: friendly-malicious-electric-soup

Logged in as Nebula (nebula@railway.com)
```

You'll receive a URL to visit and a 4-word verification code. Once codes match, select "Verify" to complete authentication.

## Logout

Terminates your Railway account session.

```txt
~ railway logout --help
Logout of your Railway account

Usage: railway logout [OPTIONS]

Options:
      --json     Output in JSON format
  -h, --help     Print help
  -V, --version  Print version
```

## Logs

Retrieves logs from the most recent deployment.

```txt
~ railway logs --help
View the most-recent deploy's logs

Usage: railway logs [OPTIONS]

Options:
  -d, --deployment  Show deployment logs
  -b, --build       Show build logs
      --json        Output in JSON format
  -h, --help        Print help
  -V, --version     Print version
```

## Open

Launches your Railway project dashboard in the browser.

```txt
~ railway open --help
Open your project dashboard

Usage: railway open [OPTIONS]

Options:
      --json     Output in JSON format
  -h, --help     Print help
  -V, --version  Print version
```

## Run

Executes a command with Railway environment variables applied.

```txt
~ railway run --help
Run a local command using variables from the active environment

Usage: railway run [OPTIONS] [ARGS]...

Arguments:
  [ARGS]...  Args to pass to the command

Options:
  -s, --service <SERVICE>          Service to pull variables from (defaults to linked service)
  -e, --environment <ENVIRONMENT>  Environment to pull variables from (defaults to linked environment)
      --json                       Output in JSON format
  -h, --help                       Print help
  -V, --version                    Print version
```

This automatically injects environment variables associated with all installed databases.

## Service

Links a service to the current project.

```txt
~ railway service --help
Link a service to the current project

Usage: railway service [OPTIONS] [SERVICE]

Arguments:
  [SERVICE]  The service to link

Options:
      --json     Output in JSON format
  -h, --help     Print help
  -V, --version  Print version
```

## Shell

Launches a subshell with Railway variables from your project, environment, and service accessible.

```txt
~ railway shell --help
Open a subshell with Railway variables available

Usage: railway shell [OPTIONS]

Options:
  -s, --service <SERVICE>  Service to pull variables from (defaults to linked service)
      --json               Output in JSON format
  -h, --help               Print help
  -V, --version            Print version
```

## SSH

Connects to a project or service via SSH.

```txt
~ railway ssh --help
Connect to a service via SSH

Usage: railway ssh [OPTIONS] [COMMAND]...

Arguments:
  [COMMAND]...  Command to execute instead of starting an interactive shell

Options:
  -p, --project <PROJECT>
          Project to connect to (defaults to linked project)
  -s, --service <SERVICE>
          Service to connect to (defaults to linked service)
  -e, --environment <ENVIRONMENT>
          Environment to connect to (defaults to linked environment)
  -d, --deployment-instance <deployment-instance-id>
          Deployment instance ID to connect to (defaults to first active instance)
      --json
          Output in JSON format
  -h, --help
          Print help
  -V, --version
          Print version
```

## Status

Displays information about your Railway project and user account.

```txt
~ railway status --help
Show information about the current project

Usage: railway status [OPTIONS]

Options:
      --json     Output in JSON format
  -h, --help     Print help
  -V, --version  Print version
```

## Unlink

Severs the current directory's connection to Railway.

```txt
~ Disassociate project from current directory

Usage: railway unlink [OPTIONS]

Options:
  -s, --service  Unlink a service
      --json     Output in JSON format
  -h, --help     Print help
  -V, --version  Print version
```

Re-run `railway link` to restore functionality in this directory.

## Up

Uploads and deploys a directory to your Railway project.

```txt
~ railway up --help
Upload and deploy project from the current directory

Usage: railway up [OPTIONS] [PATH]

Arguments:
  [PATH]

Options:
  -d, --detach                     Don't attach to the log stream
  -c, --ci                         Only stream build logs and exit after it's done
  -s, --service <SERVICE>          Service to deploy to (defaults to linked service)
  -e, --environment <ENVIRONMENT>  Environment to deploy to (defaults to linked environment)
      --no-gitignore               Don't ignore paths from .gitignore
      --verbose                    Verbose output
      --json                       Output in JSON format
  -h, --help                       Print help
  -V, --version                    Print version
```

Without a path argument, the top linked directory is deployed using the currently selected environment.

## Variables

Presents all environment variables associated with your project and environment.

```txt
~ railway variables --help
Show variables for active environment

Usage: railway variables [OPTIONS]

Options:
  -s, --service <SERVICE>          The service to show/set variables for
  -e, --environment <ENVIRONMENT>  The environment to show/set variables for
  -k, --kv                         Show variables in KV format
      --set <SET>                  The "{key}={value}" environment variable pair to set the service variables. Example:
                                      railway variables --set "MY_SPECIAL_ENV_VAR=1" --set "BACKEND_PORT=3000"
      --json                       Output in JSON format
  -h, --help                       Print help (see a summary with '-h')
  -V, --version                    Print version
```

## Whoami

Reveals the currently authenticated Railway user.

```txt
~ railway whoami --help
Get the current logged in user

Usage: railway whoami [OPTIONS]

Options:
      --json     Output in JSON format
  -h, --help     Print help
  -V, --version  Print version
```

## Volume

Manages project volumes, including listing, adding, removing, updating, attaching, and detaching operations.

```txt
~ railway volume --help
Manage project volumes

Usage: railway volume [OPTIONS] <COMMAND>

Commands:
  list    List volumes
  add     Add a new volume
  delete  Delete a volume
  update  Update a volume
  detach  Detach a volume from a service
  attach  Attach a volume to a service
  help    Print this message or the help of the given subcommand(s)

Options:
  -s, --service <SERVICE>          Service ID
  -e, --environment <ENVIRONMENT>  Environment ID
      --json                       Output in JSON format
  -h, --help                       Print help
  -V, --version                    Print version
```

## Redeploy

Redeployes the current version of a service.

```txt
~ railway redeploy --help
Redeploy the latest deployment of a service

Usage: railway redeploy [OPTIONS]

Options:
  -s, --service <SERVICE>  The service ID/name to redeploy from
  -y, --yes                Skip confirmation dialog
      --json               Output in JSON format
  -h, --help               Print help
  -V, --version            Print version
```

## Help

Provides command reference information.

```txt
~ railway help
Interact with Railway via CLI

Usage: railway [OPTIONS] <COMMAND>

Commands:
  add          Add a service to your project
  completion   Generate completion script
  connect      Connect to a database's shell (psql for Postgres, mongosh for MongoDB, etc.)
  deploy       Provisions a template into your project
  domain       Generates a domain for a service if there is not a railway provided domain
  docs         Open Railway Documentation in default browser
  down         Remove the most recent deployment
  environment  Change the active environment
  init         Create a new project
  link         Associate existing project with current directory, may specify projectId as an argument
  list         List all projects in your Railway account
  login        Login to your Railway account
  logout       Logout of your Railway account
  logs         View a deploy's logs
  open         Open your project dashboard
  run          Run a local command using variables from the active environment
  service      Link a service to the current project
  shell        Open a local subshell with Railway variables available
  status       Show information about the current project
  unlink       Disassociate project from current directory
  up           Upload and deploy project from the current directory
  variables    Show variables for active environment
  whoami       Get the current logged in user
  volume       Manage project volumes
  redeploy     Redeploy the latest deployment of a service
  help         Print this message or the help of the given subcommand(s)

Options:
      --json     Output in JSON format
  -h, --help     Print help
  -V, --version  Print version
```
