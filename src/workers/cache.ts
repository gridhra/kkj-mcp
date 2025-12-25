/**
 * Cloudflare KV キャッシュ実装
 */

import type { Notice, SearchParams } from '../api/types.js';
import { CACHE_KEY_PREFIX, type CachedSearchResult } from './types.js';

/**
 * 検索パラメータからSHA-256ハッシュを生成
 * @param params - 検索パラメータ
 * @returns ハッシュ文字列（16進数）
 */
export async function generateParamsHash(params: SearchParams): Promise<string> {
  // パラメータを正規化（キーをソートしてJSON化）
  const sortedKeys = Object.keys(params).sort();
  const normalized: Record<string, unknown> = {};
  sortedKeys.forEach(key => {
    normalized[key] = params[key as keyof SearchParams];
  });
  const jsonString = JSON.stringify(normalized);

  // SHA-256ハッシュ生成
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  // ArrayBufferを16進数文字列に変換
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * 検索結果をKVに保存
 * @param kv - KV Namespace
 * @param params - 検索パラメータ
 * @param results - 検索結果
 * @param ttl - TTL（秒）、デフォルト: 3600秒（1時間）
 */
export async function cacheSearchResults(
  kv: KVNamespace,
  params: SearchParams,
  results: Notice[],
  ttl: number = 3600
): Promise<void> {
  const paramsHash = await generateParamsHash(params);
  const cacheKey = `${CACHE_KEY_PREFIX.search}${paramsHash}`;

  const cached: CachedSearchResult = {
    params: params as Record<string, unknown>,
    results,
    fetchedAt: Date.now(),
    totalCount: results.length,
  };

  await kv.put(cacheKey, JSON.stringify(cached), {
    expirationTtl: ttl,
  });

  console.error(`Cached search results: key=${cacheKey}, count=${results.length}, ttl=${ttl}s`);

  // 個別案件もキャッシュ（24時間）
  await Promise.all(results.map(notice =>
    cacheNoticeDetail(kv, notice.ResultId, notice, 86400)
  ));
}

/**
 * KVから検索結果を取得
 * @param kv - KV Namespace
 * @param params - 検索パラメータ
 * @returns キャッシュされた検索結果、またはnull
 */
export async function getCachedSearchResults(
  kv: KVNamespace,
  params: SearchParams
): Promise<CachedSearchResult | null> {
  const paramsHash = await generateParamsHash(params);
  const cacheKey = `${CACHE_KEY_PREFIX.search}${paramsHash}`;

  const cached = await kv.get<CachedSearchResult>(cacheKey, 'json');

  if (!cached) {
    console.error(`Cache miss: key=${cacheKey}`);
    return null;
  }

  console.error(`Cache hit: key=${cacheKey}, count=${cached.totalCount}`);
  return cached;
}

/**
 * 案件詳細をKVに保存
 * @param kv - KV Namespace
 * @param resultId - 案件ID
 * @param notice - 案件詳細データ
 * @param ttl - TTL（秒）、デフォルト: 86400秒（24時間）
 */
export async function cacheNoticeDetail(
  kv: KVNamespace,
  resultId: string,
  notice: Notice,
  ttl: number = 86400
): Promise<void> {
  const cacheKey = `${CACHE_KEY_PREFIX.notice}${resultId}`;

  await kv.put(cacheKey, JSON.stringify(notice), {
    expirationTtl: ttl,
  });

  console.error(`Cached notice detail: key=${cacheKey}, ttl=${ttl}s`);
}

/**
 * KVから案件詳細を取得
 * @param kv - KV Namespace
 * @param resultId - 案件ID
 * @returns キャッシュされた案件詳細、またはnull
 */
export async function getCachedNoticeDetail(
  kv: KVNamespace,
  resultId: string
): Promise<Notice | null> {
  const cacheKey = `${CACHE_KEY_PREFIX.notice}${resultId}`;

  const cached = await kv.get<Notice>(cacheKey, 'json');

  if (!cached) {
    console.error(`Cache miss: key=${cacheKey}`);
    return null;
  }

  console.error(`Cache hit: key=${cacheKey}`);
  return cached;
}

/**
 * 複数の案件詳細をKVに一括保存
 * @param kv - KV Namespace
 * @param notices - 案件詳細データの配列
 * @param ttl - TTL（秒）、デフォルト: 86400秒（24時間）
 */
export async function cacheMultipleNotices(
  kv: KVNamespace,
  notices: Notice[],
  ttl: number = 86400
): Promise<void> {
  await Promise.all(notices.map(notice =>
    cacheNoticeDetail(kv, notice.ResultId, notice, ttl)
  ));

  console.error(`Cached ${notices.length} notice details, ttl=${ttl}s`);
}
