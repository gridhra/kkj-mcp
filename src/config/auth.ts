/**
 * 認証設定
 */

export interface AuthConfig {
  enabled: boolean;
  bypassLocalhost: boolean;
  apiKeys: string[];
}

/**
 * 環境変数から認証設定を取得
 */
export function getAuthConfig(): AuthConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const apiKeysEnv = process.env.API_KEYS || '';

  return {
    // 本番環境でのみ認証を有効化
    enabled: nodeEnv === 'production' && apiKeysEnv.length > 0,
    // 開発環境ではlocalhostをバイパス
    bypassLocalhost: nodeEnv === 'development',
    // カンマ区切りでAPIキーを取得
    apiKeys: apiKeysEnv.split(',').filter(key => key.trim().length > 0),
  };
}

/**
 * APIキーを検証
 * @param token - Bearer トークン
 * @returns 検証結果
 */
export function validateApiKey(token: string | null): boolean {
  const config = getAuthConfig();

  // 認証が無効な場合は常にtrue
  if (!config.enabled) {
    return true;
  }

  // トークンがない場合は失敗
  if (!token) {
    return false;
  }

  // APIキーリストに含まれているか確認
  return config.apiKeys.includes(token);
}

/**
 * リクエストがlocalhostからのものか確認
 * @param host - ホスト名
 * @returns localhostかどうか
 */
export function isLocalhost(host: string | null): boolean {
  if (!host) return false;

  return (
    host === 'localhost' ||
    host.startsWith('localhost:') ||
    host === '127.0.0.1' ||
    host.startsWith('127.0.0.1:') ||
    host === '[::1]' ||
    host.startsWith('[::1]:')
  );
}
