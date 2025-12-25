/**
 * Cloudflare Workers用型定義
 */

/**
 * Workers環境変数のバインディング
 */
export interface Env {
  // KV Namespace
  KKJ_CACHE: KVNamespace;

  // 環境変数
  API_KEYS?: string;
  NODE_ENV?: string;
  CACHE_TTL_SEARCH?: string;
  CACHE_TTL_DETAIL?: string;
}

/**
 * KVキャッシュのキー接頭辞
 */
export const CACHE_KEY_PREFIX = {
  search: 'search:',
  notice: 'notice:',
} as const;

/**
 * KVに保存する検索結果のキャッシュデータ
 */
export interface CachedSearchResult {
  params: Record<string, unknown>;
  results: unknown[];
  fetchedAt: number;
  totalCount: number;
}
