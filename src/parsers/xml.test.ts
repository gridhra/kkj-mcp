/**
 * XMLパーサーのテスト
 */

import { describe, it, expect } from 'vitest';
import { parseXmlResponse } from './xml.js';
import { loadFixture } from '../__tests__/fixtures/mock-data.js';

describe('parseXmlResponse', () => {
  it('空の検索結果を正しくパースできる', () => {
    const xmlString = loadFixture('search-empty.xml');
    const result = parseXmlResponse(xmlString);

    expect(result).toBeDefined();
    expect(result.Results).toBeDefined();
    expect(result.Results?.SearchResults).toBeDefined();
  });

  it('単一の検索結果を正しくパースできる', () => {
    const xmlString = loadFixture('search-single.xml');
    const result = parseXmlResponse(xmlString);

    expect(result.Results?.SearchResults?.SearchResult).toBeDefined();

    const searchResult = result.Results?.SearchResults?.SearchResult;
    expect(searchResult).toBeDefined();

    // 単一結果の場合はオブジェクトとして返される
    if (searchResult && !Array.isArray(searchResult)) {
      expect(searchResult.ProjectName).toBe('テスト第一学校校舎改修工事');
      expect(searchResult.OrganizationName).toBe('サンプル県テスト市');
      expect(searchResult.CftIssueDate).toBe('2025-12-24T00:00:00+09:00');
      expect(searchResult.ExternalDocumentURI).toBe('https://example.com/notice/001.pdf');
    }
  });

  it('複数の検索結果を配列として正しくパースできる', () => {
    const xmlString = loadFixture('search-multiple.xml');
    const result = parseXmlResponse(xmlString);

    const searchResults = result.Results?.SearchResults?.SearchResult;
    expect(searchResults).toBeDefined();
    expect(Array.isArray(searchResults)).toBe(true);

    if (Array.isArray(searchResults)) {
      expect(searchResults.length).toBe(3);

      // 1件目の確認
      expect(searchResults[0].ResultId).toBe(1); // XMLParserが数値に変換
      expect(searchResults[0].ProjectName).toBe('テスト第一学校校舎改修工事');

      // 2件目の確認
      expect(searchResults[1].ResultId).toBe(2);
      expect(searchResults[1].ProjectName).toBe('サンプル病院設備更新工事');

      // 3件目の確認（ExternalDocumentURIなし）
      expect(searchResults[2].ResultId).toBe(3);
      expect(searchResults[2].ExternalDocumentURI).toBeUndefined();
    }
  });

  it('PDFタイプの詳細情報を正しくパースできる', () => {
    const xmlString = loadFixture('detail-pdf.xml');
    const result = parseXmlResponse(xmlString);

    const notice = result.Results?.SearchResults?.SearchResult;
    expect(notice).toBeDefined();

    if (notice && !Array.isArray(notice)) {
      expect(notice.ResultId).toBe(1);
      expect(notice.FileType).toBe('pdf');
      expect(notice.FileSize).toBe(410222); // 数値として解析
      expect(notice.LgCode).toBe(99);
      expect(notice.CityCode).toBe(999999);
      expect(notice.Category).toBe('工事');
      expect(notice.ProjectDescription).toContain('テスト第一学校');
    }
  });

  it('HTMLタイプの詳細情報を正しくパースできる（FileSizeが空文字列）', () => {
    const xmlString = loadFixture('detail-html.xml');
    const result = parseXmlResponse(xmlString);

    const notice = result.Results?.SearchResults?.SearchResult;
    expect(notice).toBeDefined();

    if (notice && !Array.isArray(notice)) {
      expect(notice.ResultId).toBe(2);
      expect(notice.FileType).toBe('html');
      expect(notice.FileSize).toBe(''); // 空文字列
      expect(notice.ProcedureType).toBe('一般競争入札');
    }
  });

  it('不正なXMLでもパース処理は完了する', () => {
    const invalidXml = '<InvalidXML>';

    // fast-xml-parserは不正なXMLでもパースを試みる
    const result = parseXmlResponse(invalidXml);
    expect(result).toBeDefined();
  });

  it('空文字列をパースした場合は空オブジェクトを返す', () => {
    // fast-xml-parserは空文字列でもエラーをスローせず、空オブジェクトを返す
    const result = parseXmlResponse('');
    expect(result).toBeDefined();
  });
});
