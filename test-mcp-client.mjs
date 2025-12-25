#!/usr/bin/env node

/**
 * MCP Server Test Client
 * MCPサーバーを実際に起動して、外側からツールをテストする
 */

import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testMCPServer() {
  console.log('🚀 Starting MCP Server...\n');

  // MCPサーバーをstdioモードで起動
  const serverProcess = spawn('node', ['build/index.js'], {
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  // クライアント作成
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['build/index.js'],
  });

  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  try {
    // サーバーに接続
    await client.connect(transport);
    console.log('✅ Connected to MCP Server\n');

    // ツール一覧を取得
    console.log('📋 Listing available tools...');
    const { tools } = await client.listTools();
    console.log(`Found ${tools.length} tools:`);
    tools.forEach((tool) => {
      console.log(`  - ${tool.name}`);
    });
    console.log('');

    // Test 1: get_domain_knowledge - brief version
    console.log('🧪 Test 1: get_domain_knowledge (brief)');
    const test1Result = await client.callTool({
      name: 'get_domain_knowledge',
      arguments: {
        category: 'bidding_methods',
        detail_level: 'brief',
      },
    });
    console.log('Result:', test1Result.content[0].text.substring(0, 200) + '...\n');

    // Test 2: get_domain_knowledge - glossary search
    console.log('🧪 Test 2: get_domain_knowledge (glossary search)');
    const test2Result = await client.callTool({
      name: 'get_domain_knowledge',
      arguments: {
        category: 'glossary',
        search_term: '経審',
      },
    });
    console.log('Result:', test2Result.content[0].text + '\n');

    // Test 3: get_investigation_primer - overview
    console.log('🧪 Test 3: get_investigation_primer (overview)');
    const test3Result = await client.callTool({
      name: 'get_investigation_primer',
      arguments: {
        scope: 'overview',
      },
    });
    console.log('Result:', test3Result.content[0].text.substring(0, 200) + '...\n');

    // Test 4: get_investigation_primer - with focus areas
    console.log('🧪 Test 4: get_investigation_primer (with focus areas)');
    const test4Result = await client.callTool({
      name: 'get_investigation_primer',
      arguments: {
        scope: 'overview',
        focus_areas: ['timeline_and_flow', 'search_strategy'],
      },
    });
    console.log('Result:', test4Result.content[0].text.substring(0, 200) + '...\n');

    // Test 5: search_notices (既存のツールも確認)
    console.log('🧪 Test 5: search_notices (existing tool)');
    const test5Result = await client.callTool({
      name: 'search_notices',
      arguments: {
        query: '道路',
        category: '2',
        page: 1,
      },
    });
    const searchResult = JSON.parse(test5Result.content[0].text);
    console.log(`Found ${searchResult.total_count} results, displaying ${searchResult.results.length} items\n`);

    console.log('✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    // クリーンアップ
    await client.close();
    serverProcess.kill();
    console.log('\n🛑 MCP Server stopped');
  }
}

// テスト実行
testMCPServer().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
