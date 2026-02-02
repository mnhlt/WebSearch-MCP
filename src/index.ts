#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from "axios";

// Configuration
const API_URL = process.env.API_URL || "http://localhost:3001";
const MAX_SEARCH_RESULT = parseInt(process.env.MAX_SEARCH_RESULT || "5", 10);

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
    version: "1.0.0",
  });

  // Add a web_search tool
  server.tool(
    "web_search",
    "Search the web for information.\n"
    + "Use this tool when you need to search the web for information.\n"
    + "You can use this tool to search for news, blogs, or all types of information.\n"
    + "You can also use this tool to search for information about a specific company or product.\n"
    + "You can also use this tool to search for information about a specific person.\n"
    + "You can also use this tool to search for information about a specific product.\n"
    + "You can also use this tool to search for information about a specific company.\n"
    + "You can also use this tool to search for information about a specific event.\n"
    + "You can also use this tool to search for information about a specific location.\n"
    + "You can also use this tool to search for information about a specific thing.\n"
    + "You can provide multiple queries (max 10) to search for different topics simultaneously.\n"
    + "Results from multiple queries will be aggregated and deduplicated by URL.\n"
    + "If you request search with 1 result number and failed, retry with bigger results number.",
    {
      queries: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe("Array of search queries to look up (max 10 queries)"),
      numResults: z
        .number()
        .optional()
        .describe(
          `Number of results to return per query (default: ${MAX_SEARCH_RESULT})`
        ),
      language: z
        .string()
        .optional()
        .describe("Language code for search results (e.g., 'en')"),
      region: z
        .string()
        .optional()
        .describe("Region code for search results (e.g., 'us')"),
      excludeDomains: z
        .array(z.string())
        .optional()
        .describe("Domains to exclude from results"),
      includeDomains: z
        .array(z.string())
        .optional()
        .describe("Only include these domains in results"),
      excludeTerms: z
        .array(z.string())
        .optional()
        .describe("Terms to exclude from results"),
      resultType: z
        .enum(["all", "news", "blogs"])
        .optional()
        .describe("Type of results to return"),
    },
    async (params) => {
      try {
        console.error(`Performing web search for ${params.queries.length} queries: ${params.queries.join(", ")}`);

        // Execute all searches in parallel
        const searchPromises = params.queries.map(async (query) => {
          const requestPayload: CrawlRequest = {
            query: query,
            numResults: params.numResults ?? MAX_SEARCH_RESULT,
            language: params.language,
            region: params.region,
            filters: {
              excludeDomains: params.excludeDomains,
              includeDomains: params.includeDomains,
              excludeTerms: params.excludeTerms,
              resultType: params.resultType as "all" | "news" | "blogs",
            },
          };

          console.error(`Sending request to ${API_URL}/crawl for query: ${query}`);
          try {
            const response = await axios.post<CrawlResponse>(
              `${API_URL}/crawl`,
              requestPayload
            );
            return { query, response: response.data };
          } catch (error) {
            console.error(`Error searching for "${query}":`, error);
            return { query, error: error };
          }
        });

        // Wait for all searches to complete
        const searchResults = await Promise.all(searchPromises);

        // Aggregate results and remove duplicates by URL
        const urlMap = new Map<string, any>();
        const queryList: string[] = [];

        for (const result of searchResults) {
          if ('response' in result && result.response) {
            queryList.push(result.query);
            for (const crawlResult of result.response.results) {
              if (!urlMap.has(crawlResult.url)) {
                urlMap.set(crawlResult.url, {
                  title: crawlResult.title,
                  snippet: crawlResult.excerpt,
                  text: crawlResult.text,
                  url: crawlResult.url,
                  siteName: crawlResult.siteName || "",
                  byline: crawlResult.byline || "",
                  sourceQuery: result.query,
                });
              }
            }
          }
        }

        const aggregatedResults = Array.from(urlMap.values());

        console.error(`Found ${aggregatedResults.length} unique results from ${queryList.length} queries`);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  queries: queryList,
                  totalResults: aggregatedResults.length,
                  results: aggregatedResults,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        console.error("Error performing web search:", error);

        if (axios.isAxiosError(error)) {
          const errorMessage = error.response?.data?.error || error.message;
          return {
            content: [{ type: "text", text: `Error: ${errorMessage}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Error: ${
                error instanceof Error ? error.message : "Unknown error"
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Start receiving messages on stdin and sending messages on stdout
  console.error("Starting WebSearch MCP server...");
  console.error(`Using API_URL: ${API_URL}`);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WebSearch MCP server started");
}

// Start the server
main().catch((error) => {
  console.error("Failed to start WebSearch MCP server:", error);
  process.exit(1);
});
