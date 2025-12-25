/**
 * 詳細ツールのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleGetNoticeDetails } from './details.js';
import { handleSearchNotices, clearSearchCache } from './search.js';
import { mockNoticeDetailPdf, mockNoticeDetailHtml, mockNoticeWithNumberId } from '../__tests__/fixtures/mock-data.js';
import type { Notice } from '../api/types.js';

// searchNotices関数をモック
vi.mock('../api/client.js', () => ({
  searchNotices: vi.fn(),
}));

import { searchNotices } from '../api/client.js';
const mockSearchNotices = vi.mocked(searchNotices);

describe('handleGetNoticeDetails', () => {
  beforeEach(() => {
    mockSearchNotices.mockReset();
    clearSearchCache();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('基本的な詳細取得', () => {
    it('キャッシュから正しくデータを取得できる', async () => {
      const mockResults: Notice[] = [mockNoticeDetailPdf, mockNoticeDetailHtml];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      // まず検索を実行してキャッシュに保存
      await handleSearchNotices({ query: 'テスト', page: 1 });

      // 詳細を取得
      const detail = await handleGetNoticeDetails({ result_id: '1' });

      expect(detail).toEqual(mockNoticeDetailPdf);
      expect(detail.ResultId).toBe('1');
      expect(detail.ProjectName).toBe('テスト第一学校校舎改修工事');
      expect(detail.FileType).toBe('pdf');
      expect(detail.FileSize).toBe(410222);
    });

    it('複数の案件から指定したIDの詳細を取得できる', async () => {
      const mockResults: Notice[] = [mockNoticeDetailPdf, mockNoticeDetailHtml];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      await handleSearchNotices({ query: 'テスト', page: 1 });

      // 2番目の案件を取得
      const detail = await handleGetNoticeDetails({ result_id: '2' });

      expect(detail).toEqual(mockNoticeDetailHtml);
      expect(detail.ResultId).toBe('2');
      expect(detail.ProjectName).toBe('サンプル病院設備更新工事');
      expect(detail.FileType).toBe('html');
      expect(detail.FileSize).toBe(''); // 空文字列
    });
  });

  describe('ResultIdの型変換', () => {
    it('ResultIdが数値型でも文字列として検索できる', async () => {
      const mockResults: Notice[] = [mockNoticeWithNumberId];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      await handleSearchNotices({ query: 'テスト', page: 1 });

      // 文字列でリクエスト
      const detail = await handleGetNoticeDetails({ result_id: '1' });

      expect(detail).toEqual(mockNoticeWithNumberId);
      expect(detail.ResultId).toBe(1); // 元データは数値
    });

    it('文字列型のResultIdを検索できる', async () => {
      const mockResults: Notice[] = [mockNoticeDetailPdf];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      await handleSearchNotices({ query: 'テスト', page: 1 });

      const detail = await handleGetNoticeDetails({ result_id: '1' });

      expect(detail.ResultId).toBe('1'); // 文字列
    });
  });

  describe('エラーハンドリング', () => {
    it('キャッシュが空で追加パラメータがない場合は親切なエラーメッセージをスローする', async () => {
      // 検索を実行せずに詳細を取得しようとする
      await expect(
        handleGetNoticeDetails({ result_id: '1' })
      ).rejects.toThrow('ResultId "1" がキャッシュに見つかりません');

      await expect(
        handleGetNoticeDetails({ result_id: '1' })
      ).rejects.toThrow('先に search_notices を実行して');

      await expect(
        handleGetNoticeDetails({ result_id: '1' })
      ).rejects.toThrow('project_name: 案件名');

      await expect(
        handleGetNoticeDetails({ result_id: '1' })
      ).rejects.toThrow('organization_name: 機関名');
    });

    it('存在しないResultIdで追加パラメータがない場合はエラーをスローする', async () => {
      const mockResults: Notice[] = [mockNoticeDetailPdf];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      await handleSearchNotices({ query: 'テスト', page: 1 });

      await expect(
        handleGetNoticeDetails({ result_id: '999' })
      ).rejects.toThrow('ResultId "999" がキャッシュに見つかりません');
    });

    it('空文字列のResultIdでエラーをスローする', async () => {
      const mockResults: Notice[] = [mockNoticeDetailPdf];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      await handleSearchNotices({ query: 'テスト', page: 1 });

      await expect(
        handleGetNoticeDetails({ result_id: '' })
      ).rejects.toThrow('ResultId "" がキャッシュに見つかりません');
    });
  });

  describe('詳細情報の完全性', () => {
    it('PDFタイプの詳細情報がすべてのフィールドを含む', async () => {
      const mockResults: Notice[] = [mockNoticeDetailPdf];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      await handleSearchNotices({ query: 'テスト', page: 1 });

      const detail = await handleGetNoticeDetails({ result_id: '1' });

      // すべてのフィールドを確認
      expect(detail.ResultId).toBeDefined();
      expect(detail.Key).toBeDefined();
      expect(detail.ExternalDocumentURI).toBeDefined();
      expect(detail.ProjectName).toBeDefined();
      expect(detail.Date).toBeDefined();
      expect(detail.FileType).toBeDefined();
      expect(detail.FileSize).toBeDefined();
      expect(detail.LgCode).toBeDefined();
      expect(detail.PrefectureName).toBeDefined();
      expect(detail.CityCode).toBeDefined();
      expect(detail.CityName).toBeDefined();
      expect(detail.OrganizationName).toBeDefined();
      expect(detail.CftIssueDate).toBeDefined();
      expect(detail.Category).toBeDefined();
      expect(detail.ProjectDescription).toBeDefined();
    });

    it('HTMLタイプの詳細情報を正しく取得できる', async () => {
      const mockResults: Notice[] = [mockNoticeDetailHtml];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      await handleSearchNotices({ query: 'テスト', page: 1 });

      const detail = await handleGetNoticeDetails({ result_id: '2' });

      expect(detail.FileType).toBe('html');
      expect(detail.FileSize).toBe(''); // 空文字列
      expect(detail.ProcedureType).toBe('一般競争入札');
      // CityCodeとCityNameは含まれない
      expect(detail.CityCode).toBeUndefined();
      expect(detail.CityName).toBeUndefined();
    });
  });

  describe('キャッシュの永続性', () => {
    it('複数回詳細を取得してもキャッシュは維持される', async () => {
      const mockResults: Notice[] = [mockNoticeDetailPdf];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      await handleSearchNotices({ query: 'テスト', page: 1 });

      // 1回目の取得
      const detail1 = await handleGetNoticeDetails({ result_id: '1' });
      expect(detail1.ProjectName).toBe('テスト第一学校校舎改修工事');

      // 2回目の取得（同じデータ）
      const detail2 = await handleGetNoticeDetails({ result_id: '1' });
      expect(detail2.ProjectName).toBe('テスト第一学校校舎改修工事');

      // 検索は1回のみ実行されている
      expect(mockSearchNotices).toHaveBeenCalledTimes(1);
    });
  });

  describe('フォールバック検索', () => {
    it('キャッシュミス時にproject_nameでフォールバック検索が成功する', async () => {
      clearSearchCache();

      const mockResults: Notice[] = [mockNoticeDetailPdf, mockNoticeDetailHtml];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      // キャッシュにない状態でproject_nameを指定して詳細を取得
      const detail = await handleGetNoticeDetails({
        result_id: '1',
        project_name: '学校校舎改修工事',
      });

      expect(detail).toEqual(mockNoticeDetailPdf);
      expect(detail.ResultId).toBe('1');
      expect(mockSearchNotices).toHaveBeenCalledWith({
        Count: '100',
        Project_Name: '学校校舎改修工事',
      });
    });

    it('キャッシュミス時にorganization_nameでフォールバック検索が成功する', async () => {
      clearSearchCache();

      const mockResults: Notice[] = [mockNoticeDetailPdf, mockNoticeDetailHtml];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      const detail = await handleGetNoticeDetails({
        result_id: '2',
        organization_name: 'サンプル市',
      });

      expect(detail).toEqual(mockNoticeDetailHtml);
      expect(detail.ResultId).toBe('2');
      expect(mockSearchNotices).toHaveBeenCalledWith({
        Count: '100',
        Organization_Name: 'サンプル市',
      });
    });

    it('キャッシュミス時にqueryでフォールバック検索が成功する', async () => {
      clearSearchCache();

      const mockResults: Notice[] = [mockNoticeDetailPdf];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      const detail = await handleGetNoticeDetails({
        result_id: '1',
        query: '学校 AND 改修',
      });

      expect(detail.ResultId).toBe('1');
      expect(mockSearchNotices).toHaveBeenCalledWith({
        Count: '100',
        Query: '学校 AND 改修',
      });
    });

    it('キャッシュミス時にlg_codeでフォールバック検索が成功する', async () => {
      clearSearchCache();

      const mockResults: Notice[] = [mockNoticeDetailPdf];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      const detail = await handleGetNoticeDetails({
        result_id: '1',
        lg_code: '13',
      });

      expect(detail.ResultId).toBe('1');
      expect(mockSearchNotices).toHaveBeenCalledWith({
        Count: '100',
        LG_Code: '13',
      });
    });

    it('複数の検索パラメータを組み合わせてフォールバック検索できる', async () => {
      clearSearchCache();

      const mockResults: Notice[] = [mockNoticeDetailPdf];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      const detail = await handleGetNoticeDetails({
        result_id: '1',
        project_name: '学校',
        organization_name: 'テスト市',
        query: '改修',
        lg_code: '13',
      });

      expect(detail.ResultId).toBe('1');
      expect(mockSearchNotices).toHaveBeenCalledWith({
        Count: '100',
        Project_Name: '学校',
        Organization_Name: 'テスト市',
        Query: '改修',
        LG_Code: '13',
      });
    });

    it('フォールバック検索後にキャッシュが更新される', async () => {
      clearSearchCache();

      const mockResults: Notice[] = [mockNoticeDetailPdf, mockNoticeDetailHtml];
      mockSearchNotices.mockResolvedValueOnce(mockResults);

      // フォールバック検索で取得
      await handleGetNoticeDetails({
        result_id: '1',
        project_name: '学校',
      });

      // 2回目は追加パラメータなしでもキャッシュから取得できる
      const detail = await handleGetNoticeDetails({ result_id: '2' });
      expect(detail).toEqual(mockNoticeDetailHtml);

      // API呼び出しは1回のみ
      expect(mockSearchNotices).toHaveBeenCalledTimes(1);
    });

    it('フォールバック検索でResultIdが見つからない場合はエラーをスローする', async () => {
      clearSearchCache();

      const mockResults: Notice[] = [mockNoticeDetailPdf, mockNoticeDetailHtml];
      mockSearchNotices.mockResolvedValue(mockResults);

      const error = await handleGetNoticeDetails({
        result_id: '999',
        project_name: '学校',
      }).catch(e => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('ResultId "999" が見つかりませんでした');
      expect(error.message).toContain('該当するResultIdは含まれていませんでした');
      expect(error.message).toContain('ResultIdが正しいか');
    });

    it('フォールバック検索でAPI呼び出しエラーが発生した場合は適切なエラーメッセージをスローする', async () => {
      clearSearchCache();

      mockSearchNotices.mockRejectedValueOnce(new Error('API error occurred'));

      await expect(
        handleGetNoticeDetails({
          result_id: '1',
          project_name: '学校',
        })
      ).rejects.toThrow('フォールバック検索中にエラーが発生しました: API error occurred');
    });
  });
});
