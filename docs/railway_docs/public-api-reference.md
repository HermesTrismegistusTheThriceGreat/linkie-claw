# Public API Reference

The Railway public API is built with GraphQL and is the same API that powers the Railway dashboard.

## Endpoint

The public API is accessible at:

```bash
https://backboard.railway.com/graphql/v2
```

## Authentication

Three types of tokens are available for API access:

**Team and Personal Tokens**

Create tokens via the [tokens page](https://railway.com/account/tokens) in account settings.

- Team tokens access all team resources and can be shared with teammates
- Personal tokens access individual account resources and should not be shared

Example request:
```bash
curl --request POST \
  --url https://backboard.railway.com/graphql/v2 \
  --header 'Authorization: Bearer <API_TOKEN_GOES_HERE>' \
  --header 'Content-Type: application/json' \
  --data '{"query":"query { me { name email } }"}'
```

**Project Tokens**

Generated from project settings, these tokens are "scoped to a specific environment within a project and can only be used to authenticate requests to that environment."

Example:
```bash
curl --request POST \
  --url https://backboard.railway.com/graphql/v2 \
  --header 'Project-Access-Token: <PROJECT_TOKEN_GOES_HERE>' \
  --header 'Content-Type: application/json' \
  --data '{"query":"query { projectToken { projectId environmentId } }"}'
```

## Schema

The API supports introspection for use with tools like Postman or Insomnia. A [collection file](https://gql-collection-server.up.railway.app/railway_graphql_collection.json) is available for import. The [GraphiQL playground](https://railway.com/graphiql) allows schema exploration and query testing with proper Authorization headers.

## Rate Limits

Current limits vary by plan:
- **Free**: 100 RPH
- **Hobby**: 1000 RPH, 10 RPS
- **Pro**: 10,000 RPH, 50 RPS
- **Enterprise**: Custom limits

Response headers track usage:
- `X-RateLimit-Limit`: Maximum requests per day
- `X-RateLimit-Remaining`: Available requests in current window
- `X-RateLimit-Reset`: Window reset time
- `Retry-After`: Wait time when limit reached

## Support

Resources include the [Public API guide](/guides/public-api) and the [Discord server](https://discord.gg/railway) for community support.