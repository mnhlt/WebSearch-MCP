#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import * as path from 'path';

interface MCPMessage {
  jsonrpc: string;
  id: number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

async function main() {
  // Start the MCP server as a child process
  const serverProcess = spawn('ts-node', [path.join(__dirname, 'index.ts')], {
    stdio: ['pipe', 'pipe', process.stderr],
    env: {
      ...process.env,
      API_URL: process.env.API_URL || 'http://localhost:3001',
      MAX_SEARCH_RESULT: process.env.MAX_SEARCH_RESULT || '5'
    }
  });

  // Set up readline for nice formatting
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let messageId = 1;

  // Handle server output
  serverProcess.stdout.on('data', (data) => {
    try {
      const message = JSON.parse(data.toString()) as MCPMessage;
      console.log('\nReceived from server:');
      console.log(JSON.stringify(message, null, 2));
      
      if (message.result) {
        try {
          const resultContent = JSON.parse(message.result.content[0].text);
          console.log('\nSearch Results:');
          console.log(JSON.stringify(resultContent, null, 2));
        } catch (e) {
          console.log('\nResult Content:');
          console.log(message.result.content[0].text);
        }
      }
      
      readline.prompt();
    } catch (error) {
      console.error('Error parsing server response:', error);
      console.log('Raw response:', data.toString());
      readline.prompt();
    }
  });

  // Initial prompt
  console.log('WebSearch MCP Test Client');
  console.log('------------------------');
  console.log('Type a search query and press Enter to search.');
  console.log('Type \'exit\' to quit.');
  console.log('');

  readline.setPrompt('Search> ');
  readline.prompt();

  // Handle user input
  readline.on('line', (line) => {
    const input = line.trim();
    
    if (input.toLowerCase() === 'exit') {
      console.log('Exiting...');
      serverProcess.kill();
      process.exit(0);
    }

    // Create a web_search request
    const request: MCPMessage = {
      jsonrpc: '2.0',
      id: messageId++,
      method: 'call_tool',
      params: {
        name: 'web_search',
        arguments: {
          query: input,
          numResults: parseInt(process.env.MAX_SEARCH_RESULT || '3', 10)
        }
      }
    };

    console.log('\nSending request:');
    console.log(JSON.stringify(request, null, 2));
    
    // Send the request to the server
    serverProcess.stdin.write(JSON.stringify(request) + '\n');
  });

  // Handle exit
  readline.on('close', () => {
    console.log('Exiting...');
    serverProcess.kill();
    process.exit(0);
  });

  // Handle server exit
  serverProcess.on('exit', (code) => {
    console.log(`Server exited with code ${code}`);
    process.exit(code || 0);
  });
}

main().catch(error => {
  console.error('Error running test client:', error);
  process.exit(1);
}); 