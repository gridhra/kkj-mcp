/**
 * Cloudflare Workers エントリーポイント
 * Honoを使用したMCPサーバー実装
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
// import { startServer } from '../server.js'; // TODO: Uncomment when implementing MCP
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
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

/**
 * ヘルスチェックエンドポイント
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'kkj-mcp-server',
    mode: 'cloudflare-workers'
  });
});

/**
 * 認証ミドルウェア（MCPエンドポイント用）
 */
app.use('/mcp/*', async (c, next) => {
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
 *
 * 注意: WebStandardStreamableHTTPServerTransportの使用が必要ですが、
 * MCPのHTTP実装は現在開発中のため、以下は概念的な実装です。
 *
 * 実際のデプロイ前に、MCPの公式ドキュメントを参照して
 * 正しい実装に更新してください:
 * https://github.com/modelcontextprotocol/typescript-sdk
 */
app.all('/mcp', async (c) => {
  try {
    // TODO: WebStandardStreamableHTTPServerTransportを使用した実装
    //
    // 期待される実装パターン:
    // const transport = new WebStandardStreamableHTTPServerTransport({
    //   sessionIdGenerator: () => crypto.randomUUID(),
    // });
    //
    // await startServer(transport, { kv: c.env.KKJ_CACHE });
    // return transport.handleRequest(c.req.raw);

    return c.json({
      error: 'Not Implemented',
      message: 'MCP over HTTP is not yet fully implemented. Please use Stdio mode for now.',
      note: 'WebStandardStreamableHTTPServerTransport integration is pending MCP SDK updates.'
    }, 501);
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
