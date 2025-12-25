#!/usr/bin/env node

/**
 * 官公需情報ポータルサイトAPI MCPサーバー
 * エントリーポイント（Stdioモード）
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { startServer } from './server.js';

/**
 * メイン関数
 */
async function main(): Promise<void> {
  try {
    const transport = new StdioServerTransport();
    await startServer(transport);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
