#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";

// Configuration
const API_URL = process.env.API_URL || "http://localhost:3001";

// Interface definitions based on swagger.json
interface CrawlRequest {
  query: string;
  numResults?: number;
  language?: string;
  region?: string;
  filters?: {
    excludeDomains?: string[];
    includeDomains?: string[];
    excludeTerms?: string[];
    resultType?: "all" | "news" | "blogs";
  };
}

interface CrawlResult {
  url: string;
  title: string;
  excerpt: string;
  text?: string;
  html?: string;
  siteName?: string;
  byline?: string;
  error?: string | null;
}

interface CrawlResponse {
  query: string;
  results: CrawlResult[];
  error: string | null;
}

// Main function to set up and run the MCP server
async function main() {
  // Create an MCP server
  const server = new McpServer({
    name: "WebSearch-MCP",
    version: "1.0.0"
  });

  // Add a web_search tool
  server.tool(
    "web_search",
    {
      query: z.string().describe("The search query to look up"),
      numResults: z.number().optional().describe("Number of results to return (default: 5)"),
      language: z.string().optional().describe("Language code for search results (e.g., 'en')"),
      region: z.string().optional().describe("Region code for search results (e.g., 'us')"),
      excludeDomains: z.array(z.string()).optional().describe("Domains to exclude from results"),
      includeDomains: z.array(z.string()).optional().describe("Only include these domains in results"),
      excludeTerms: z.array(z.string()).optional().describe("Terms to exclude from results"),
      resultType: z.enum(["all", "news", "blogs"]).optional().describe("Type of results to return")
    },
    async (params) => {
      try {
        console.error(`Performing web search for: ${params.query}`);
        
        // Prepare request payload for crawler API
        const requestPayload: CrawlRequest = {
          query: params.query,
          numResults: params.numResults,
          language: params.language,
          region: params.region,
          filters: {
            excludeDomains: params.excludeDomains,
            includeDomains: params.includeDomains,
            excludeTerms: params.excludeTerms,
            resultType: params.resultType as "all" | "news" | "blogs"
          }
        };
        
        // Call the crawler API
        console.error(`Sending request to ${API_URL}/crawl`);
        const response = await axios.post<CrawlResponse>(`${API_URL}/crawl`, requestPayload);
        
        // Format the response for the MCP client
        const results = response.data.results.map(result => ({
          title: result.title,
          snippet: result.excerpt,
          text: result.text,
          url: result.url,
          siteName: result.siteName || "",
          byline: result.byline || ""
        }));
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              query: response.data.query,
              results: results
            }, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error performing web search:', error);
        
        if (axios.isAxiosError(error)) {
          const errorMessage = error.response?.data?.error || error.message;
          return {
            content: [{ type: "text", text: `Error: ${errorMessage}` }],
            isError: true
          };
        }
        
        return {
          content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
          isError: true
        };
      }
    }
  );

  // Start receiving messages on stdin and sending messages on stdout
  console.error('Starting WebSearch MCP server...');
  console.error(`Using API_URL: ${API_URL}`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('WebSearch MCP server started');
}

// Start the server
main().catch((error) => {
  console.error('Failed to start WebSearch MCP server:', error);
  process.exit(1);
}); 