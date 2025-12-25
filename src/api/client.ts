/**
 * 官公需情報ポータルサイトAPI クライアント
 */

import { parseXmlResponse } from '../parsers/xml.js';
import type { SearchParams, Notice } from './types.js';

/**
 * APIベースURL
 */
const API_BASE_URL = 'http://www.kkj.go.jp/api/';

/**
 * 官公需情報APIを検索
 * @param params - 検索パラメータ
 * @returns 検索結果の配列
 */
export async function searchNotices(params: SearchParams): Promise<Notice[]> {
  // パラメータの検証
  if (!params.Query && !params.Project_Name && !params.Organization_Name && !params.LG_Code) {
    throw new Error('At least one of Query, Project_Name, Organization_Name, or LG_Code must be specified');
  }

  // URLSearchParamsを使用してクエリ文字列を構築
  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value));
    }
  });

  const url = `${API_BASE_URL}?${queryParams.toString()}`;

  console.error(`Fetching: ${url}`);
  console.error(`Request params: ${JSON.stringify(params, null, 2)}`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;

      // ステータスコード別のエラーメッセージ
      switch (response.status) {
        case 400:
          errorMessage += ' - リクエストパラメータが不正です。日付形式などを確認してください。';
          break;
        case 404:
          errorMessage += ' - APIエンドポイントが見つかりません。';
          break;
        case 500:
          errorMessage += ' - サーバーエラーが発生しました。パラメータの形式を確認してください。';
          errorMessage += '\n特に日付形式（YYYY-MM-DD/、/YYYY-MM-DD、YYYY-MM-DD/YYYY-MM-DD）を確認してください。';
          break;
        case 503:
          errorMessage += ' - サービスが一時的に利用できません。しばらく待ってから再試行してください。';
          break;
        default:
          errorMessage += ' - 予期しないエラーが発生しました。';
      }

      throw new Error(errorMessage);
    }

    const xmlText = await response.text();
    const parsedData = parseXmlResponse(xmlText);

    // 検索結果の抽出
    const searchResult = parsedData.Results?.SearchResults?.SearchResult;

    if (!searchResult) {
      return [];
    }

    // 単一結果の場合は配列に変換
    return Array.isArray(searchResult) ? searchResult : [searchResult];
  } catch (error) {
    console.error('API request error:', error);
    throw new Error(`Failed to fetch data from API: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
