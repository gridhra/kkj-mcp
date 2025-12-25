/**
 * Cloudflare Workers エントリーポイント
 * Honoを使用したMCPサーバー実装
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { startServer } from '../server.js';
import type { Env } from './types.js';

/**
 * Honoアプリケーション
 */
const app = new Hono<{ Bindings: Env }>();

/**
 * CORS設定
 */
app.use('/*', cors({
  origin: (origin) => origin, // すべてのオリジンを許可（本番では制限推奨）
  allowHeaders: ['Authorization', 'Content-Type', 'mcp-session-id', 'Last-Event-ID', 'mcp-protocol-version'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['mcp-session-id', 'mcp-protocol-version'],
  credentials: true,
}));

/**
 * ヘルスチェックエンドポイント
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'kkj-mcp-server',
    mode: 'cloudflare-workers',
    transport: 'WebStandardStreamableHTTP'
  });
});

/**
 * 認証ミドルウェア（MCPエンドポイント用）
 */
app.use('/mcp', async (c, next) => {
  const apiKeys = c.env.API_KEYS?.split(',').map(k => k.trim()).filter(k => k) || [];

  // APIキーが設定されている場合のみ認証を実施
  if (apiKeys.length > 0) {
    const authHeader = c.req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token || !apiKeys.includes(token)) {
      return c.json({
        error: 'Unauthorized',
        message: 'Invalid or missing API key'
      }, 401);
    }
  }

  return await next();
});

/**
 * MCP エンドポイント
 * WebStandardStreamableHTTPServerTransportを使用
 */
app.all('/mcp', async (c) => {
  try {
    // ステートレスモードでトランスポートを作成
    // Cloudflare Workersは複数のインスタンスで実行されるため、
    // セッション管理は行わず、リクエストごとに新しいトランスポートを作成
    const transport = new WebStandardStreamableHTTPServerTransport();

    // MCPサーバーを作成して接続
    await startServer(transport, { kv: c.env.KKJ_CACHE });

    // リクエストを処理
    return transport.handleRequest(c.req.raw);
  } catch (error) {
    console.error('MCP endpoint error:', error);
    return c.json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * Cloudflare Workers Fetch Handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
};
