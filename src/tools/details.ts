/**
 * 詳細ツール実装
 * キャッシュ（メモリまたはKV）から特定の案件の詳細情報を取得
 */

import { z } from 'zod';
import { getSearchCache, mergeSearchCache } from './search.js';
import { searchNotices } from '../api/client.js';
import type { Notice, SearchParams } from '../api/types.js';
import {
  getCachedNoticeDetail,
  cacheMultipleNotices
} from '../workers/cache.js';

/**
 * 詳細取得ツールの引数スキーマ
 */
export const GetNoticeDetailsArgsSchema = z.object({
  result_id: z.string().describe('search_noticesで取得したResultId'),
  project_name: z.string().optional().describe('案件名（キャッシュミス時のフォールバック検索用）'),
  organization_name: z.string().optional().describe('機関名（キャッシュミス時のフォールバック検索用）'),
  query: z.string().optional().describe('キーワード検索（キャッシュミス時のフォールバック検索用）'),
  lg_code: z.string().optional().describe('都道府県コード（キャッシュミス時のフォールバック検索用）'),
});

export type GetNoticeDetailsArgs = z.infer<typeof GetNoticeDetailsArgsSchema>;

/**
 * 親切なエラーメッセージを生成
 * @param resultId - 検索対象のResultId
 * @returns エラーメッセージ
 */
function generateHelpfulErrorMessage(resultId: string): string {
  return (
    `ResultId "${resultId}" がキャッシュに見つかりません。\n\n` +
    `この案件を取得するには、以下のいずれかの方法をお試しください:\n\n` +
    `1. 先に search_notices を実行して案件をキャッシュに読み込む\n\n` +
    `2. get_notice_details に追加パラメータを指定してフォールバック検索を実行:\n` +
    `   - project_name: 案件名（例: "道路整備工事"）\n` +
    `   - organization_name: 機関名（例: "国土交通省"）\n` +
    `   - query: キーワード（例: "建設 AND 東京"）\n` +
    `   - lg_code: 都道府県コード（例: "13" for 東京都）\n\n` +
    `注: 官公需APIはResultIdによる直接検索をサポートしていないため、\n` +
    `    上記のパラメータを使用して検索してから該当案件を抽出します。`
  );
}

/**
 * 詳細取得ツールの実装
 * @param args - 詳細取得引数
 * @param kv - Cloudflare Workers KV Namespace（オプション、Workersモード用）
 * @returns 案件の詳細情報
 */
export async function handleGetNoticeDetails(
  args: GetNoticeDetailsArgs,
  kv?: KVNamespace
): Promise<Notice> {
  const resultId = args.result_id;

  // KVモード（Workers）の場合
  if (kv) {
    return await handleGetNoticeDetailsWithKV(args, kv);
  }

  // メモリキャッシュモード（Stdio）の場合
  let cache = getSearchCache();

  // キャッシュから該当IDを検索
  let detail = cache.find(item => String(item.ResultId) === resultId);

  if (!detail) {
    // フォールバック: 追加パラメータがあればAPI検索を実行
    const hasSearchParams =
      args.project_name ||
      args.organization_name ||
      args.query ||
      args.lg_code;

    if (hasSearchParams) {
      console.error(`ResultId "${resultId}" not found in cache. Attempting fallback search...`);

      // 検索パラメータの構築
      const searchParams: SearchParams = {
        Count: '100', // 十分な数を取得
      };

      if (args.project_name) searchParams.Project_Name = args.project_name;
      if (args.organization_name) searchParams.Organization_Name = args.organization_name;
      if (args.query) searchParams.Query = args.query;
      if (args.lg_code) searchParams.LG_Code = args.lg_code;

      try {
        // API検索実行
        const searchResults = await searchNotices(searchParams);
        console.error(`Fallback search returned ${searchResults.length} results`);

        // ResultIdで該当案件を検索
        detail = searchResults.find(item => String(item.ResultId) === resultId);

        if (detail) {
          // 見つかった場合はキャッシュにマージ
          mergeSearchCache(searchResults);
          console.error(`Found ResultId "${resultId}" via fallback search`);
        } else {
          // 検索結果内に該当IDが見つからない
          throw new Error(
            `ResultId "${resultId}" が見つかりませんでした。\n\n` +
            `指定された検索条件で ${searchResults.length} 件の案件が見つかりましたが、\n` +
            `該当するResultIdは含まれていませんでした。\n\n` +
            `以下を確認してください:\n` +
            `- ResultIdが正しいか\n` +
            `- 検索条件（project_name, organization_name, query, lg_code）が適切か\n` +
            `- 該当案件が検索結果の範囲内（最新100件）に含まれているか`
          );
        }
      } catch (error) {
        // API検索エラー
        if (error instanceof Error && error.message.includes('ResultId')) {
          // 上記で生成したエラーはそのまま再スロー
          throw error;
        }
        throw new Error(
          `フォールバック検索中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    } else {
      // 追加パラメータがない場合は親切なエラーメッセージ
      throw new Error(generateHelpfulErrorMessage(resultId));
    }
  }

  console.error(`Retrieved details for ResultId: ${resultId}`);

  return detail;
}

/**
 * KVキャッシュを使用した詳細取得ツールの実装（Workersモード）
 * @param args - 詳細取得引数
 * @param kv - Cloudflare Workers KV Namespace
 * @returns 案件の詳細情報
 */
async function handleGetNoticeDetailsWithKV(
  args: GetNoticeDetailsArgs,
  kv: KVNamespace
): Promise<Notice> {
  const resultId = args.result_id;

  // 1. KVから直接取得試行
  let detail = await getCachedNoticeDetail(kv, resultId);

  if (detail) {
    console.error(`Cache hit for ResultId: ${resultId}`);
    return detail;
  }

  // 2. フォールバック検索（追加パラメータがある場合）
  const hasSearchParams =
    args.project_name ||
    args.organization_name ||
    args.query ||
    args.lg_code;

  if (hasSearchParams) {
    console.error(`ResultId "${resultId}" not found in KV. Attempting fallback search...`);

    // 検索パラメータの構築
    const searchParams: SearchParams = {
      Count: '100', // 十分な数を取得
    };

    if (args.project_name) searchParams.Project_Name = args.project_name;
    if (args.organization_name) searchParams.Organization_Name = args.organization_name;
    if (args.query) searchParams.Query = args.query;
    if (args.lg_code) searchParams.LG_Code = args.lg_code;

    try {
      // API検索実行
      const searchResults = await searchNotices(searchParams);
      console.error(`Fallback search returned ${searchResults.length} results`);

      // ResultIdで該当案件を検索
      detail = searchResults.find(item => String(item.ResultId) === resultId) || null;

      if (detail) {
        // 見つかった場合はKVにキャッシュ
        await cacheMultipleNotices(kv, searchResults, 86400); // 24時間
        console.error(`Found ResultId "${resultId}" via fallback search`);
        return detail;
      } else {
        // 検索結果内に該当IDが見つからない
        throw new Error(
          `ResultId "${resultId}" が見つかりませんでした。\n\n` +
          `指定された検索条件で ${searchResults.length} 件の案件が見つかりましたが、\n` +
          `該当するResultIdは含まれていませんでした。\n\n` +
          `以下を確認してください:\n` +
          `- ResultIdが正しいか\n` +
          `- 検索条件（project_name, organization_name, query, lg_code）が適切か\n` +
          `- 該当案件が検索結果の範囲内（最新100件）に含まれているか`
        );
      }
    } catch (error) {
      // API検索エラー
      if (error instanceof Error && error.message.includes('ResultId')) {
        // 上記で生成したエラーはそのまま再スロー
        throw error;
      }
      throw new Error(
        `フォールバック検索中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // 3. 追加パラメータがない場合は親切なエラーメッセージ
  throw new Error(generateHelpfulErrorMessage(resultId));
}
