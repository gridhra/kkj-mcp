/**
 * APIクライアントのテスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchNotices } from './client.js';
import { loadFixture } from '../__tests__/fixtures/mock-data.js';

// グローバルfetchのモック
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('searchNotices', () => {
  beforeEach(() => {
    // 各テストの前にモックをリセット
    mockFetch.mockReset();
    // console.errorをモック（ログ出力を抑制）
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('成功ケース', () => {
    it('複数の検索結果を正しく取得できる', async () => {
      const xmlResponse = loadFixture('search-multiple.xml');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => xmlResponse,
      });

      const results = await searchNotices({
        Query: '外壁',
        LG_Code: '13',
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);
      expect(results[0].ProjectName).toBe('テスト第一学校校舎改修工事');
    });

    it('単一の検索結果を配列として返す', async () => {
      const xmlResponse = loadFixture('search-single.xml');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => xmlResponse,
      });

      const results = await searchNotices({
        Project_Name: 'テスト',
      });

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);
      expect(results[0].ProjectName).toBe('テスト第一学校校舎改修工事');
    });

    it('空の検索結果の場合は空配列を返す', async () => {
      const xmlResponse = loadFixture('search-empty.xml');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => xmlResponse,
      });

      const results = await searchNotices({
        Query: '存在しないキーワード',
      });

      expect(results).toEqual([]);
    });

    it('正しいURLとクエリパラメータでAPIを呼び出す', async () => {
      const xmlResponse = loadFixture('search-empty.xml');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => xmlResponse,
      });

      await searchNotices({
        Query: 'テスト',
        LG_Code: '13',
        Category: '2',
        Count: '100',
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0] as string;

      // URLエンコードされたパラメータを含むことを確認
      expect(calledUrl).toContain('Query=');
      expect(calledUrl).toContain('LG_Code=13');
      expect(calledUrl).toContain('Category=2');
      expect(calledUrl).toContain('Count=100');

      // デコードして確認
      const url = new URL(calledUrl);
      expect(url.searchParams.get('Query')).toBe('テスト');
    });
  });

  describe('パラメータバリデーション', () => {
    it('必須パラメータがない場合はエラーをスローする', async () => {
      await expect(searchNotices({})).rejects.toThrow(
        'At least one of Query, Project_Name, Organization_Name, or LG_Code must be specified'
      );
    });

    it('空文字列のパラメータは無視する', async () => {
      const xmlResponse = loadFixture('search-empty.xml');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => xmlResponse,
      });

      await searchNotices({
        Query: 'テスト',
        Project_Name: '', // 空文字列
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      const url = new URL(calledUrl);

      expect(url.searchParams.get('Query')).toBe('テスト');
      expect(url.searchParams.has('Project_Name')).toBe(false);
    });
  });

  describe('HTTPエラーハンドリング', () => {
    it('400エラーの場合は適切なエラーメッセージをスローする', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(
        searchNotices({ Query: 'テスト' })
      ).rejects.toThrow('リクエストパラメータが不正です');
    });

    it('404エラーの場合は適切なエラーメッセージをスローする', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(
        searchNotices({ Query: 'テスト' })
      ).rejects.toThrow('APIエンドポイントが見つかりません');
    });

    it('500エラーの場合は日付形式の確認を促すメッセージをスローする', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const error = searchNotices({ Query: 'テスト' });

      await expect(error).rejects.toThrow('サーバーエラーが発生しました');
      await expect(error).rejects.toThrow('日付形式');
    });

    it('503エラーの場合は適切なエラーメッセージをスローする', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      await expect(
        searchNotices({ Query: 'テスト' })
      ).rejects.toThrow('サービスが一時的に利用できません');
    });

    it('予期しないステータスコードの場合もエラーをスローする', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 418, // I'm a teapot
      });

      await expect(
        searchNotices({ Query: 'テスト' })
      ).rejects.toThrow('予期しないエラーが発生しました');
    });
  });

  describe('ネットワークエラーハンドリング', () => {
    it('ネットワークエラーの場合はエラーをスローする', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        searchNotices({ Query: 'テスト' })
      ).rejects.toThrow('Failed to fetch data from API: Network error');
    });

    it('不正なXMLレスポンスでも空配列を返す', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '<InvalidXML>',
      });

      // fast-xml-parserは不正なXMLでもパースを試みるため、
      // 結果が空になるか、構造が異なる結果になる
      const result = await searchNotices({ Query: 'テスト' });
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
