/**
 * 検索ツールのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleSearchNotices, clearSearchCache } from './search.js';
import { mockNoticeDetailPdf, mockNoticeDetailHtml, mockNoticeMinimal } from '../__tests__/fixtures/mock-data.js';
import type { Notice } from '../api/types.js';

// searchNotices関数をモック
vi.mock('../api/client.js', () => ({
  searchNotices: vi.fn(),
}));

import { searchNotices } from '../api/client.js';
const mockSearchNotices = vi.mocked(searchNotices);

describe('handleSearchNotices', () => {
  beforeEach(() => {
    mockSearchNotices.mockReset();
    clearSearchCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('基本的な検索機能', () => {
    it('1ページ目の検索結果を正しく返す', async () => {
      const mockResults: Notice[] = [
        mockNoticeDetailPdf,
        mockNoticeDetailHtml,
        mockNoticeMinimal,
      ];

      mockSearchNotices.mockResolvedValueOnce(mockResults);

      const result = await handleSearchNotices({
        query: '外壁',
        lg_code: '13',
        page: 1,
      });

      expect(result.currentPage).toBe(1);
      expect(result.totalAvailable).toBe(3);
      expect(result.results.length).toBe(3);
      expect(result.hasNextPage).toBe(false);

      // ResultIdとExternalDocumentURIが含まれることを確認
      expect(result.results[0].ResultId).toBe('1');
      expect(result.results[0].ExternalDocumentURI).toBe('https://example.com/notice/001.pdf');
      expect(result.results[1].ExternalDocumentURI).toBe('https://example.com/portal/notice/002');
    });

    it('空の検索結果を正しく処理する', async () => {
      mockSearchNotices.mockResolvedValueOnce([]);

      const result = await handleSearchNotices({
        query: '存在しないキーワード',
        page: 1,
      });

      expect(result.currentPage).toBe(1);
      expect(result.totalAvailable).toBe(0);
      expect(result.results).toEqual([]);
      expect(result.hasNextPage).toBe(false);
    });
  });

  describe('ページネーション', () => {
    it('11件以上の結果がある場合、hasNextPageがtrueになる', async () => {
      // 15件のモックデータを作成
      const mockResults: Notice[] = Array.from({ length: 15 }, (_, i) => ({
        ResultId: `${i + 1}`,
        ProjectName: `案件${i + 1}`,
        OrganizationName: `機関${i + 1}`,
        CftIssueDate: '2025-12-20T00:00:00+09:00',
      }));

      mockSearchNotices.mockResolvedValueOnce(mockResults);

      const result = await handleSearchNotices({
        query: 'テスト',
        page: 1,
      });

      expect(result.results.length).toBe(10); // 1ページは10件
      expect(result.totalAvailable).toBe(15);
      expect(result.hasNextPage).toBe(true);
    });

    it('2ページ目はキャッシュから取得する', async () => {
      const mockResults: Notice[] = Array.from({ length: 15 }, (_, i) => ({
        ResultId: `${i + 1}`,
        ProjectName: `案件${i + 1}`,
        OrganizationName: `機関${i + 1}`,
        CftIssueDate: '2025-12-20T00:00:00+09:00',
      }));

      mockSearchNotices.mockResolvedValueOnce(mockResults);

      // 1ページ目
      await handleSearchNotices({ query: 'テスト', page: 1 });

      // 2ページ目（API呼び出しなし、キャッシュから取得）
      const result = await handleSearchNotices({ query: 'テスト', page: 2 });

      expect(mockSearchNotices).toHaveBeenCalledTimes(1); // 1回のみ
      expect(result.currentPage).toBe(2);
      expect(result.results.length).toBe(5); // 残り5件
      expect(result.results[0].ResultId).toBe('11'); // 11番目から
      expect(result.hasNextPage).toBe(false);
    });

    it('最終ページではhasNextPageがfalseになる', async () => {
      const mockResults: Notice[] = Array.from({ length: 10 }, (_, i) => ({
        ResultId: `${i + 1}`,
        ProjectName: `案件${i + 1}`,
        OrganizationName: `機関${i + 1}`,
        CftIssueDate: '2025-12-20T00:00:00+09:00',
      }));

      mockSearchNotices.mockResolvedValueOnce(mockResults);

      const result = await handleSearchNotices({
        query: 'テスト',
        page: 1,
      });

      expect(result.hasNextPage).toBe(false);
    });
  });

  describe('日付形式の自動変換', () => {
    it('YYYY-MM形式をYYYY-MM-01/に自動変換する', async () => {
      mockSearchNotices.mockResolvedValueOnce([]);

      await handleSearchNotices({
        query: 'テスト',
        cft_issue_date: '2025-12',
        page: 1,
      });

      expect(mockSearchNotices).toHaveBeenCalledWith(
        expect.objectContaining({
          CFT_Issue_Date: '2025-12-01/',
        })
      );
    });

    it('YYYY-MM-DD/形式はそのまま使用する', async () => {
      mockSearchNotices.mockResolvedValueOnce([]);

      await handleSearchNotices({
        query: 'テスト',
        cft_issue_date: '2025-12-24/',
        page: 1,
      });

      expect(mockSearchNotices).toHaveBeenCalledWith(
        expect.objectContaining({
          CFT_Issue_Date: '2025-12-24/',
        })
      );
    });

    it('/YYYY-MM-DD形式はそのまま使用する', async () => {
      mockSearchNotices.mockResolvedValueOnce([]);

      await handleSearchNotices({
        query: 'テスト',
        cft_issue_date: '/2025-12-31',
        page: 1,
      });

      expect(mockSearchNotices).toHaveBeenCalledWith(
        expect.objectContaining({
          CFT_Issue_Date: '/2025-12-31',
        })
      );
    });

    it('期間指定形式はそのまま使用する', async () => {
      mockSearchNotices.mockResolvedValueOnce([]);

      await handleSearchNotices({
        query: 'テスト',
        cft_issue_date: '2025-12-01/2025-12-31',
        page: 1,
      });

      expect(mockSearchNotices).toHaveBeenCalledWith(
        expect.objectContaining({
          CFT_Issue_Date: '2025-12-01/2025-12-31',
        })
      );
    });
  });

  describe('パラメータマッピング', () => {
    it('すべてのパラメータを正しくマッピングする', async () => {
      mockSearchNotices.mockResolvedValueOnce([]);

      await handleSearchNotices({
        query: 'テスト',
        project_name: '案件名',
        organization_name: '機関名',
        lg_code: '13',
        category: '2',
        procedure_type: '1',
        certification: 'A',
        cft_issue_date: '2025-12-01/',
        page: 1,
      });

      expect(mockSearchNotices).toHaveBeenCalledWith({
        Count: '100',
        Query: 'テスト',
        Project_Name: '案件名',
        Organization_Name: '機関名',
        LG_Code: '13',
        Category: '2',
        Procedure_Type: '1',
        Certification: 'A',
        CFT_Issue_Date: '2025-12-01/',
      });
    });

    it('未指定のパラメータは送信しない', async () => {
      mockSearchNotices.mockResolvedValueOnce([]);

      await handleSearchNotices({
        query: 'テスト',
        page: 1,
      });

      expect(mockSearchNotices).toHaveBeenCalledWith({
        Count: '100',
        Query: 'テスト',
      });
    });
  });

  describe('NoticeListItemへの変換', () => {
    it('必要なフィールドのみを抽出する', async () => {
      mockSearchNotices.mockResolvedValueOnce([mockNoticeDetailPdf]);

      const result = await handleSearchNotices({
        query: 'テスト',
        page: 1,
      });

      const item = result.results[0];
      expect(item).toHaveProperty('ResultId');
      expect(item).toHaveProperty('ProjectName');
      expect(item).toHaveProperty('OrganizationName');
      expect(item).toHaveProperty('CftIssueDate');
      expect(item).toHaveProperty('ExternalDocumentURI');
      expect(item).toHaveProperty('ProjectDescription');

      // 詳細情報のフィールドは含まれない
      expect(item).not.toHaveProperty('FileType');
      expect(item).not.toHaveProperty('FileSize');
    });

    it('ExternalDocumentURIがundefinedの場合も正しく処理する', async () => {
      mockSearchNotices.mockResolvedValueOnce([mockNoticeMinimal]);

      const result = await handleSearchNotices({
        query: 'テスト',
        page: 1,
      });

      expect(result.results[0].ExternalDocumentURI).toBeUndefined();
    });
  });

  describe('キャッシュ管理', () => {
    it('1ページ目を再検索するとキャッシュが更新される', async () => {
      const firstResults: Notice[] = [mockNoticeDetailPdf];
      const secondResults: Notice[] = [mockNoticeDetailHtml];

      mockSearchNotices.mockResolvedValueOnce(firstResults);

      // 1回目の検索
      const result1 = await handleSearchNotices({ query: 'テスト1', page: 1 });
      expect(result1.results[0].ProjectName).toBe('テスト第一学校校舎改修工事');

      mockSearchNotices.mockResolvedValueOnce(secondResults);

      // 2回目の検索（キャッシュ更新）
      const result2 = await handleSearchNotices({ query: 'テスト2', page: 1 });
      expect(result2.results[0].ProjectName).toBe('サンプル病院設備更新工事');

      expect(mockSearchNotices).toHaveBeenCalledTimes(2);
    });
  });

  describe('ProjectDescription切り取り機能', () => {
    it('デフォルトで100文字に切り取られる', async () => {
      const longDescription = 'あ'.repeat(150);
      const mockResults: Notice[] = [{
        ResultId: '1',
        ProjectName: 'テスト案件',
        OrganizationName: 'テスト機関',
        CftIssueDate: '2025-12-20T00:00:00+09:00',
        ProjectDescription: longDescription,
      }];

      mockSearchNotices.mockResolvedValueOnce(mockResults);

      const result = await handleSearchNotices({
        query: 'テスト',
        page: 1,
      });

      expect(result.results[0].ProjectDescription).toBe('あ'.repeat(100));
      expect(result.results[0].ProjectDescription?.length).toBe(100);
    });

    it('description_lengthパラメータで文字数を変更できる', async () => {
      const longDescription = 'あ'.repeat(150);
      const mockResults: Notice[] = [{
        ResultId: '1',
        ProjectName: 'テスト案件',
        OrganizationName: 'テスト機関',
        CftIssueDate: '2025-12-20T00:00:00+09:00',
        ProjectDescription: longDescription,
      }];

      mockSearchNotices.mockResolvedValueOnce(mockResults);

      const result = await handleSearchNotices({
        query: 'テスト',
        page: 1,
        description_length: 50,
      });

      expect(result.results[0].ProjectDescription).toBe('あ'.repeat(50));
      expect(result.results[0].ProjectDescription?.length).toBe(50);
    });

    it('description_length=0で非表示になる', async () => {
      const mockResults: Notice[] = [{
        ResultId: '1',
        ProjectName: 'テスト案件',
        OrganizationName: 'テスト機関',
        CftIssueDate: '2025-12-20T00:00:00+09:00',
        ProjectDescription: 'これは案件の説明文です',
      }];

      mockSearchNotices.mockResolvedValueOnce(mockResults);

      const result = await handleSearchNotices({
        query: 'テスト',
        page: 1,
        description_length: 0,
      });

      expect(result.results[0].ProjectDescription).toBeUndefined();
    });

    it('ProjectDescriptionが元々ない場合はundefinedのまま', async () => {
      const mockResults: Notice[] = [{
        ResultId: '1',
        ProjectName: 'テスト案件',
        OrganizationName: 'テスト機関',
        CftIssueDate: '2025-12-20T00:00:00+09:00',
      }];

      mockSearchNotices.mockResolvedValueOnce(mockResults);

      const result = await handleSearchNotices({
        query: 'テスト',
        page: 1,
      });

      expect(result.results[0].ProjectDescription).toBeUndefined();
    });

    it('指定文字数より短い場合はそのまま表示される', async () => {
      const shortDescription = 'これは短い説明文です';
      const mockResults: Notice[] = [{
        ResultId: '1',
        ProjectName: 'テスト案件',
        OrganizationName: 'テスト機関',
        CftIssueDate: '2025-12-20T00:00:00+09:00',
        ProjectDescription: shortDescription,
      }];

      mockSearchNotices.mockResolvedValueOnce(mockResults);

      const result = await handleSearchNotices({
        query: 'テスト',
        page: 1,
        description_length: 100,
      });

      expect(result.results[0].ProjectDescription).toBe(shortDescription);
    });

    it('サロゲートペア（絵文字など）を含む文字列も正しく切り取られる', async () => {
      // 絵文字はサロゲートペアで2つのUTF-16コードユニット
      const descriptionWithEmoji = '🏢'.repeat(60) + 'あ'.repeat(60); // 120文字
      const mockResults: Notice[] = [{
        ResultId: '1',
        ProjectName: 'テスト案件',
        OrganizationName: 'テスト機関',
        CftIssueDate: '2025-12-20T00:00:00+09:00',
        ProjectDescription: descriptionWithEmoji,
      }];

      mockSearchNotices.mockResolvedValueOnce(mockResults);

      const result = await handleSearchNotices({
        query: 'テスト',
        page: 1,
        description_length: 100,
      });

      // サロゲートペアを考慮した文字数で100文字に切り取られる
      const expected = '🏢'.repeat(60) + 'あ'.repeat(40);
      expect(result.results[0].ProjectDescription).toBe(expected);
      expect([...(result.results[0].ProjectDescription ?? '')].length).toBe(100);
    });
  });
});
