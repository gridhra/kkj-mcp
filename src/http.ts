#!/usr/bin/env node

/**
 * 官公需情報ポータルサイトAPI MCPサーバー
 * HTTPサーバーモード
 */

import express from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { startServer } from './server.js';
import { getServerConfig } from './config/server.js';
import { authMiddleware } from './middleware/auth.js';

/**
 * HTTPサーバーを起動
 */
async function main(): Promise<void> {
  try {
    const config = getServerConfig();

    if (config.mode !== 'http' || !config.http) {
      throw new Error('HTTP mode configuration is required');
    }

    const app = express();

    // CORS設定
    if (config.http.cors) {
      app.use(cors({
        origin: config.http.cors.origin,
        credentials: config.http.cors.credentials,
      }));
    }

    // JSONボディパース
    app.use(express.json());

    // 認証ミドルウェア
    app.use('/mcp', authMiddleware);

    // ヘルスチェックエンドポイント
    app.get('/health', (_, res) => {
      res.json({ status: 'ok', service: 'kkj-mcp-server' });
    });

    // MCP SSE エンドポイント
    app.get('/mcp/sse', async (_req, res) => {
      console.error('New SSE connection established');

      const transport = new SSEServerTransport('/mcp/message', res);
      await startServer(transport);
    });

    // MCP メッセージエンドポイント
    app.post('/mcp/message', async (_req, res) => {
      // SSEトランスポートで処理済み
      res.status(200).end();
    });

    // サーバー起動
    const server = app.listen(config.http.port, config.http.host, () => {
      console.error(`HTTP server listening on http://${config.http!.host}:${config.http!.port}`);
      console.error(`MCP endpoint: http://${config.http!.host}:${config.http!.port}/mcp/sse`);
      console.error(`Health check: http://${config.http!.host}:${config.http!.port}/health`);
    });

    // グレースフルシャットダウン
    process.on('SIGTERM', () => {
      console.error('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.error('HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.error('SIGINT signal received: closing HTTP server');
      server.close(() => {
        console.error('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
