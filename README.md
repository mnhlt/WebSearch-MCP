# WebSearch-MCP

[![smithery badge](https://smithery.ai/badge/@mnhlt/WebSearch-MCP)](https://smithery.ai/server/@mnhlt/WebSearch-MCP)

A Model Context Protocol (MCP) server implementation that provides a web search capability over stdio transport. This server integrates with a WebSearch Crawler API to retrieve search results.

## Table of Contents

- [About](#about)
- [Installation](#installation)
- [Configuration](#configuration)
- [Setup & Integration](#setup--integration)
  - [Setting Up the Crawler Service](#setting-up-the-crawler-service)
    - [Prerequisites](#prerequisites)
    - [Starting the Crawler Service](#starting-the-crawler-service)
    - [Testing the Crawler API](#testing-the-crawler-api)
    - [Custom Configuration](#custom-configuration)
  - [Integrating with MCP Clients](#integrating-with-mcp-clients)
    - [Quick Reference: MCP Configuration](#quick-reference-mcp-configuration)
    - [Claude Desktop](#claude-desktop)
    - [Cursor IDE](#cursor-ide)
    - [Cline](#cline-command-line-interface-for-claude)
- [Usage](#usage)
  - [Parameters](#parameters)
  - [Example Search Response](#example-search-response)
  - [Testing Locally](#testing-locally)
  - [As a Library](#as-a-library)
- [Troubleshooting](#troubleshooting)
  - [Crawler Service Issues](#crawler-service-issues)
  - [MCP Server Issues](#mcp-server-issues)
- [Development](#development)
  - [Project Structure](#project-structure)
  - [Publishing to npm](#publishing-to-npm)
- [Contributing](#contributing)
- [License](#license)

## About

WebSearch-MCP is a Model Context Protocol server that provides web search capabilities to AI assistants that support MCP. It allows AI models like Claude to search the web in real-time, retrieving up-to-date information about any topic.

The server integrates with a Crawler API service that handles the actual web searches, and communicates with AI assistants using the standardized Model Context Protocol.

## Installation

### Installing via Smithery

To install WebSearch for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@mnhlt/WebSearch-MCP):

```bash
npx -y @smithery/cli install @mnhlt/WebSearch-MCP --client claude
```

### Manual Installation
```bash
npm install -g websearch-mcp
```

Or use without installing:

```bash
npx websearch-mcp
```

## Configuration

The WebSearch MCP server can be configured using environment variables:

- `API_URL`: The URL of the WebSearch Crawler API (default: `http://localhost:3001`)
- `MAX_SEARCH_RESULT`: Maximum number of search results to return when not specified in the request (default: `5`)

Examples:
```bash
# Configure API URL
API_URL=https://crawler.example.com npx websearch-mcp

# Configure maximum search results
MAX_SEARCH_RESULT=10 npx websearch-mcp

# Configure both
API_URL=https://crawler.example.com MAX_SEARCH_RESULT=10 npx websearch-mcp
```

## Setup & Integration

Setting up WebSearch-MCP involves two main parts: configuring the crawler service that performs the actual web searches, and integrating the MCP server with your AI client applications.

### Setting Up the Crawler Service

The WebSearch MCP server requires a crawler service to perform the actual web searches. You can easily set up the crawler service using Docker Compose.

### Prerequisites

- [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/)

### Starting the Crawler Service

1. Create a file named `docker-compose.yml` with the following content:

```yaml
version: '3.8'

services:
  crawler:
    image: laituanmanh/websearch-crawler:latest
    container_name: websearch-api
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - LOG_LEVEL=info
      - FLARESOLVERR_URL=http://flaresolverr:8191/v1
    depends_on:
      - flaresolverr
    volumes:
      - crawler_storage:/app/storage

  flaresolverr:
    image: 21hsmw/flaresolverr:nodriver
    container_name: flaresolverr
    restart: unless-stopped
    environment:
      - LOG_LEVEL=info
      - TZ=UTC

volumes:
  crawler_storage:
```
workaround for Mac Apple Silicon
```
version: '3.8'

services:
  crawler:
    image: laituanmanh/websearch-crawler:latest
    container_name: websearch-api
    platform: "linux/amd64"
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - LOG_LEVEL=info
      - FLARESOLVERR_URL=http://flaresolverr:8191/v1
    depends_on:
      - flaresolverr
    volumes:
      - crawler_storage:/app/storage

  flaresolverr:
    image: 21hsmw/flaresolverr:nodriver
    platform: "linux/arm64"
    container_name: flaresolverr
    restart: unless-stopped
    environment:
      - LOG_LEVEL=info
      - TZ=UTC

volumes:
  crawler_storage:
```

2. Start the services:

```bash
docker-compose up -d
```

3. Verify that the services are running:

```bash
docker-compose ps
```

4. Test the crawler API health endpoint:

```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "ok",
  "details": {
    "status": "ok",
    "flaresolverr": true,
    "google": true,
    "message": null
  }
}
```

The crawler API will be available at `http://localhost:3001`.

### Testing the Crawler API

You can test the crawler API directly using curl:

```bash
curl -X POST http://localhost:3001/crawl \
  -H "Content-Type: application/json" \
  -d '{
    "query": "typescript best practices",
    "numResults": 2,
    "language": "en",
    "filters": {
      "excludeDomains": ["youtube.com"],
      "resultType": "all" 
    }
  }'
```

### Custom Configuration

You can customize the crawler service by modifying the environment variables in the `docker-compose.yml` file:

- `PORT`: The port on which the crawler API listens (default: 3001)
- `LOG_LEVEL`: Logging level (options: debug, info, warn, error)
- `FLARESOLVERR_URL`: URL of the FlareSolverr service (for bypassing Cloudflare protection)

## Integrating with MCP Clients

### Quick Reference: MCP Configuration

Here's a quick reference for MCP configuration across different clients:

```json
{
    "mcpServers": {
        "websearch": {
            "command": "npx",
            "args": [
                "websearch-mcp"
            ],
            "environment": {
                "API_URL": "http://localhost:3001",
                "MAX_SEARCH_RESULT": "5" // reduce to save your tokens, increase for wider information gain
            }
        }
    }
}
```

Workaround for Windows, due to [Issue](https://github.com/smithery-ai/mcp-obsidian/issues/19)
```
{
	"mcpServers": {
	  "websearch": {
            "command": "cmd",
            "args": [
				"/c",
				"npx",
                "websearch-mcp"
            ],
            "environment": {
                "API_URL": "http://localhost:3001",
                "MAX_SEARCH_RESULT": "1"
            }
        }
	}
  }
```

## Usage

This package implements an MCP server using stdio transport that exposes a `web_search` tool with the following parameters:

### Parameters

- `query` (required): The search query to look up
- `numResults` (optional): Number of results to return (default: 5)
- `language` (optional): Language code for search results (e.g., 'en')
- `region` (optional): Region code for search results (e.g., 'us')
- `excludeDomains` (optional): Domains to exclude from results
- `includeDomains` (optional): Only include these domains in results
- `excludeTerms` (optional): Terms to exclude from results
- `resultType` (optional): Type of results to return ('all', 'news', or 'blogs')

### Example Search Response

Here's an example of a search response:

```json
{
  "query": "machine learning trends",
  "results": [
    {
      "title": "Top Machine Learning Trends in 2025",
      "snippet": "The key machine learning trends for 2025 include multimodal AI, generative models, and quantum machine learning applications in enterprise...",
      "url": "https://example.com/machine-learning-trends-2025",
      "siteName": "AI Research Today",
      "byline": "Dr. Jane Smith"
    },
    {
      "title": "The Evolution of Machine Learning: 2020-2025",
      "snippet": "Over the past five years, machine learning has evolved from primarily supervised learning approaches to more sophisticated self-supervised and reinforcement learning paradigms...",
      "url": "https://example.com/ml-evolution",
      "siteName": "Tech Insights",
      "byline": "John Doe"
    }
  ]
}
```

### Testing Locally

To test the WebSearch MCP server locally, you can use the included test client:

```bash
npm run test-client
```

This will start the MCP server and a simple command-line interface that allows you to enter search queries and see the results.

You can also configure the API_URL for the test client:

```bash
API_URL=https://crawler.example.com npm run test-client
```

### As a Library

You can use this package programmatically:

```typescript
import { createMCPClient } from '@modelcontextprotocol/sdk';

// Create an MCP client
const client = createMCPClient({
  transport: { type: 'subprocess', command: 'npx websearch-mcp' }
});

// Execute a web search
const response = await client.request({
  method: 'call_tool',
  params: {
    name: 'web_search',
    arguments: {
      query: 'your search query',
      numResults: 5,
      language: 'en'
    }
  }
});

console.log(response.result);
```

## Troubleshooting

### Crawler Service Issues

- **API Unreachable**: Ensure that the crawler service is running and accessible at the configured API_URL.
- **Search Results Not Available**: Check the logs of the crawler service to see if there are any errors:
  ```bash
  docker-compose logs crawler
  ```
- **FlareSolverr Issues**: Some websites use Cloudflare protection. If you see errors related to this, check if FlareSolverr is working:
  ```bash
  docker-compose logs flaresolverr
  ```

### MCP Server Issues

- **Import Errors**: Ensure you have the latest version of the MCP SDK:
  ```bash
  npm install -g @modelcontextprotocol/sdk@latest
  ```
- **Connection Issues**: Make sure the stdio transport is properly configured for your client.

## Development

To work on this project:

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the project: `npm run build`
4. Run in development mode: `npm run dev`

The server expects a WebSearch Crawler API as defined in the included swagger.json file. Make sure the API is running at the configured API_URL.

### Project Structure

- `.gitignore`: Specifies files that Git should ignore (node_modules, dist, logs, etc.)
- `.npmignore`: Specifies files that shouldn't be included when publishing to npm
- `package.json`: Project metadata and dependencies
- `src/`: Source TypeScript files
- `dist/`: Compiled JavaScript files (generated when building)

### Publishing to npm

To publish this package to npm:

1. Make sure you have an npm account and are logged in (`npm login`)
2. Update the version in package.json (`npm version patch|minor|major`)
3. Run `npm publish`

The `.npmignore` file ensures that only the necessary files are included in the published package:
- The compiled code in `dist/`
- README.md and LICENSE files
- package.json

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC
