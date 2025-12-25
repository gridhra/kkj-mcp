/**
 * モックデータ定義
 * 実際のAPIレスポンスから固有名詞を匿名化したテストデータ
 */

import type { Notice, NoticeListItem, PaginatedSearchResult } from '../../api/types.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * XMLフィクスチャを読み込むヘルパー関数
 */
export function loadFixture(filename: string): string {
  return readFileSync(join(__dirname, filename), 'utf-8');
}

/**
 * 検索結果リストのモックデータ（複数件）
 */
export const mockNoticeListItems: NoticeListItem[] = [
  {
    ResultId: '1',
    ProjectName: 'テスト第一学校校舎改修工事',
    OrganizationName: 'サンプル県テスト市',
    CftIssueDate: '2025-12-24T00:00:00+09:00',
    ExternalDocumentURI: 'https://example.com/notice/001.pdf',
  },
  {
    ResultId: '2',
    ProjectName: 'サンプル病院設備更新工事',
    OrganizationName: 'サンプル医療機構テスト病院',
    CftIssueDate: '2025-12-23T00:00:00+09:00',
    ExternalDocumentURI: 'https://example.com/notice/002.pdf',
  },
  {
    ResultId: '3',
    ProjectName: '公共施設外壁塗装工事',
    OrganizationName: 'サンプル省サンプル部',
    CftIssueDate: '2025-12-22T00:00:00+09:00',
  },
];

/**
 * ページネーション付き検索結果のモックデータ
 */
export const mockPaginatedSearchResult: PaginatedSearchResult = {
  currentPage: 1,
  totalAvailable: 3,
  results: mockNoticeListItems,
  hasNextPage: false,
};

/**
 * 詳細情報のモックデータ（PDFタイプ）
 */
export const mockNoticeDetailPdf: Notice = {
  ResultId: '1',
  Key: 'dGVzdF9rZXlfZm9yX21vY2tfZGF0YV8wMDE=',
  ExternalDocumentURI: 'https://example.com/notice/001.pdf',
  ProjectName: 'テスト第一学校校舎改修工事',
  Date: '2025-12-24T10:30:00+09:00',
  FileType: 'pdf',
  FileSize: 410222,
  LgCode: 99,
  PrefectureName: 'サンプル県',
  CityCode: 999999,
  CityName: 'テスト市',
  OrganizationName: 'サンプル県テスト市',
  CftIssueDate: '2025-12-24T00:00:00+09:00',
  Category: '工事',
  ProjectDescription: 'テスト第一学校の校舎改修工事を実施します。本工事は耐震化対策を含む大規模改修工事です。詳細は添付の仕様書をご確認ください。',
};

/**
 * 詳細情報のモックデータ（HTMLタイプ - FileSizeが空文字列）
 */
export const mockNoticeDetailHtml: Notice = {
  ResultId: '2',
  Key: 'dGVzdF9rZXlfZm9yX21vY2tfZGF0YV8wMDI=',
  ExternalDocumentURI: 'https://example.com/portal/notice/002',
  ProjectName: 'サンプル病院設備更新工事',
  Date: '2025-12-23T15:45:00+09:00',
  FileType: 'html',
  FileSize: '',
  LgCode: 99,
  PrefectureName: 'サンプル県',
  OrganizationName: 'サンプル医療機構テスト病院',
  CftIssueDate: '2025-12-23T00:00:00+09:00',
  Category: '工事',
  ProcedureType: '一般競争入札',
  ProjectDescription: 'サンプル病院における設備更新工事の実施について。老朽化した設備を最新のものに更新します。',
};

/**
 * 最小フィールドのモックデータ（オプションフィールドなし）
 */
export const mockNoticeMinimal: Notice = {
  ResultId: '3',
  ProjectName: '公共施設外壁塗装工事',
  OrganizationName: 'サンプル省サンプル部',
  CftIssueDate: '2025-12-22T00:00:00+09:00',
};

/**
 * ResultIdが数値型のモックデータ（型変換テスト用）
 */
export const mockNoticeWithNumberId: Notice = {
  ResultId: 1 as any, // 意図的に数値型
  ProjectName: 'テスト案件',
  OrganizationName: 'テスト機関',
  CftIssueDate: '2025-12-20T00:00:00+09:00',
};
