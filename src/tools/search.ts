/**
 * 検索ツール実装
 * メモリキャッシュ（Stdioモード）またはKVキャッシュ（Workersモード）とページネーション機能を提供
 */

import { z } from 'zod';
import { searchNotices } from '../api/client.js';
import type { Notice, NoticeListItem, PaginatedSearchResult, SearchParams } from '../api/types.js';
import {
  getCachedSearchResults,
  cacheSearchResults
} from '../workers/cache.js';

/**
 * 検索結果のキャッシュ（Stdioモード用）
 */
let searchCache: Notice[] = [];

/**
 * 1ページあたりの表示件数
 */
const PAGE_SIZE = 10;

/**
 * 文字列を指定した文字数で切り取る（サロゲートペア対応）
 * @param text - 切り取る文字列
 * @param maxLength - 最大文字数（0の場合はundefinedを返す）
 * @returns 切り取った文字列、または0の場合はundefined
 */
function truncateText(text: string | undefined, maxLength: number): string | undefined {
  if (!text || maxLength === 0) {
    return undefined;
  }

  // サロゲートペアを考慮した文字列処理
  const chars = [...text];
  if (chars.length <= maxLength) {
    return text;
  }

  return chars.slice(0, maxLength).join('');
}

/**
 * 検索ツールの引数スキーマ
 */
export const SearchNoticesArgsSchema = z.object({
  query: z.string().optional().describe('検索キーワード（AND, OR, NOT, ANDNOT演算子使用可能）'),
  project_name: z.string().optional().describe('案件名での検索'),
  organization_name: z.string().optional().describe('機関名での検索'),
  lg_code: z.string().optional().describe('都道府県コード（2桁）'),
  category: z.enum(['1', '2', '3']).optional().describe('カテゴリ（1:物品, 2:工事, 3:役務）'),
  procedure_type: z.enum(['1', '2']).optional().describe('手続きタイプ（1:一般競争入札等）'),
  certification: z.enum(['A', 'B', 'C', 'D']).optional().describe('等級'),
  cft_issue_date: z.string()
    .regex(
      /^(\d{4}-\d{2}-\d{2}\/|\d{4}-\d{2}\/|\/\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}|\d{4}-\d{2})$/,
      '日付形式が不正です。YYYY-MM-DD/、/YYYY-MM-DD、YYYY-MM-DD/YYYY-MM-DD、またはYYYY-MM形式で指定してください'
    )
    .optional()
    .describe('公示日（例: 2025-12-01/=12月1日以降、/2025-12-31=12月31日まで、2025-12-01/2025-12-31=期間指定、2025-12=12月全体）'),
  page: z.number().int().positive().optional().default(1).describe('ページ番号（デフォルト: 1）'),
  description_length: z.number().int().min(0).max(1000).optional().default(100).describe('案件概要の表示文字数（0で非表示、デフォルト: 100）'),
});

export type SearchNoticesArgs = z.infer<typeof SearchNoticesArgsSchema>;

/**
 * 検索ツールの実装
 * @param args - 検索引数
 * @param kv - Cloudflare Workers KV Namespace（オプション、Workersモード用）
 * @returns ページネーション付き検索結果
 */
export async function handleSearchNotices(
  args: SearchNoticesArgs,
  kv?: KVNamespace
): Promise<PaginatedSearchResult> {
  const page = args.page ?? 1;

  // KVモード（Workers）の場合
  if (kv) {
    return await handleSearchNoticesWithKV(args, kv);
  }

  // メモリキャッシュモード（Stdio）の場合
  // 1ページ目の場合はAPIを呼び出し、キャッシュを更新
  if (page === 1 || searchCache.length === 0) {
    // 検索パラメータの構築
    const searchParams: SearchParams = {
      Count: '100', // 多めに取得してページネーション用に保持
    };

    // 各パラメータをマッピング
    if (args.query) searchParams.Query = args.query;
    if (args.project_name) searchParams.Project_Name = args.project_name;
    if (args.organization_name) searchParams.Organization_Name = args.organization_name;
    if (args.lg_code) searchParams.LG_Code = args.lg_code;
    if (args.category) searchParams.Category = args.category;
    if (args.procedure_type) searchParams.Procedure_Type = args.procedure_type;
    if (args.certification) searchParams.Certification = args.certification;

    // 日付パラメータの処理（YYYY-MM形式を自動変換）
    if (args.cft_issue_date) {
      let dateParam = args.cft_issue_date;

      // YYYY-MM形式の場合はYYYY-MM-01/に変換
      if (/^\d{4}-\d{2}$/.test(dateParam)) {
        dateParam = `${dateParam}-01/`;
        console.error(`Date format auto-converted: ${args.cft_issue_date} -> ${dateParam}`);
      }

      searchParams.CFT_Issue_Date = dateParam;
    }

    // API呼び出し
    searchCache = await searchNotices(searchParams);

    console.error(`Fetched ${searchCache.length} results from API`);
  }

  // ページネーション処理
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pagedData = searchCache.slice(start, end);

  // 簡略化された情報のみを返却（トークン効率化）
  const descriptionLength = args.description_length ?? 100;
  const results: NoticeListItem[] = pagedData.map(item => ({
    ResultId: item.ResultId,
    ProjectName: item.ProjectName,
    OrganizationName: item.OrganizationName,
    CftIssueDate: item.CftIssueDate,
    ExternalDocumentURI: item.ExternalDocumentURI,
    ProjectDescription: truncateText(item.ProjectDescription, descriptionLength),
  }));

  return {
    currentPage: page,
    totalAvailable: searchCache.length,
    results,
    hasNextPage: searchCache.length > end,
  };
}

/**
 * キャッシュをクリア
 */
export function clearSearchCache(): void {
  searchCache = [];
  console.error('Search cache cleared');
}

/**
 * キャッシュを取得（詳細ツールで使用）
 */
export function getSearchCache(): Notice[] {
  return searchCache;
}

/**
 * キャッシュに新しい結果をマージ（重複は除外）
 * @param newResults - マージする新しい結果
 */
export function mergeSearchCache(newResults: Notice[]): void {
  const existingIds = new Set(searchCache.map(item => item.ResultId));
  const uniqueNewResults = newResults.filter(item => !existingIds.has(item.ResultId));

  if (uniqueNewResults.length > 0) {
    searchCache = [...searchCache, ...uniqueNewResults];
    console.error(`Merged ${uniqueNewResults.length} new results into cache (total: ${searchCache.length})`);
  }
}

/**
 * KVキャッシュを使用した検索ツールの実装（Workersモード）
 * @param args - 検索引数
 * @param kv - Cloudflare Workers KV Namespace
 * @returns ページネーション付き検索結果
 */
async function handleSearchNoticesWithKV(
  args: SearchNoticesArgs,
  kv: KVNamespace
): Promise<PaginatedSearchResult> {
  const page = args.page ?? 1;

  // 検索パラメータの構築
  const searchParams: SearchParams = {
    Count: '100', // 多めに取得してページネーション用に保持
  };

  // 各パラメータをマッピング
  if (args.query) searchParams.Query = args.query;
  if (args.project_name) searchParams.Project_Name = args.project_name;
  if (args.organization_name) searchParams.Organization_Name = args.organization_name;
  if (args.lg_code) searchParams.LG_Code = args.lg_code;
  if (args.category) searchParams.Category = args.category;
  if (args.procedure_type) searchParams.Procedure_Type = args.procedure_type;
  if (args.certification) searchParams.Certification = args.certification;

  // 日付パラメータの処理（YYYY-MM形式を自動変換）
  if (args.cft_issue_date) {
    let dateParam = args.cft_issue_date;

    // YYYY-MM形式の場合はYYYY-MM-01/に変換
    if (/^\d{4}-\d{2}$/.test(dateParam)) {
      dateParam = `${dateParam}-01/`;
      console.error(`Date format auto-converted: ${args.cft_issue_date} -> ${dateParam}`);
    }

    searchParams.CFT_Issue_Date = dateParam;
  }

  // KVキャッシュから検索
  let cached = await getCachedSearchResults(kv, searchParams);

  // キャッシュミスの場合はAPI呼び出し
  if (!cached) {
    console.error('Cache miss, fetching from API...');
    const results = await searchNotices(searchParams);

    // KVにキャッシュ（1時間）
    await cacheSearchResults(kv, searchParams, results, 3600);

    cached = {
      params: searchParams as Record<string, unknown>,
      results,
      fetchedAt: Date.now(),
      totalCount: results.length,
    };
  }

  // ページネーション処理
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pagedData = cached.results.slice(start, end) as Notice[];

  // 簡略化された情報のみを返却（トークン効率化）
  const descriptionLength = args.description_length ?? 100;
  const results: NoticeListItem[] = pagedData.map(item => ({
    ResultId: item.ResultId,
    ProjectName: item.ProjectName,
    OrganizationName: item.OrganizationName,
    CftIssueDate: item.CftIssueDate,
    ExternalDocumentURI: item.ExternalDocumentURI,
    ProjectDescription: truncateText(item.ProjectDescription, descriptionLength),
  }));

  return {
    currentPage: page,
    totalAvailable: cached.totalCount,
    results,
    hasNextPage: cached.totalCount > end,
  };
}
