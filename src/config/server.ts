/**
 * サーバー設定
 */

export interface ServerConfig {
  mode: 'stdio' | 'http';
  http?: {
    port: number;
    host: string;
    cors?: {
      origin: string | string[];
      credentials: boolean;
    };
  };
}

/**
 * 環境変数からサーバー設定を取得
 */
export function getServerConfig(): ServerConfig {
  const mode = (process.env.SERVER_MODE || 'stdio') as 'stdio' | 'http';

  if (mode === 'http') {
    return {
      mode: 'http',
      http: {
        port: parseInt(process.env.PORT || '3000', 10),
        host: process.env.HOST || '0.0.0.0',
        cors: {
          origin: process.env.CORS_ORIGIN?.split(',') || '*',
          credentials: process.env.CORS_CREDENTIALS === 'true',
        },
      },
    };
  }

  return { mode: 'stdio' };
}
