/**
 * XML パーサー
 * fast-xml-parser を使用してXMLをJSONに変換
 */

import { XMLParser } from 'fast-xml-parser';
import type { ApiResponse } from '../api/types.js';

/**
 * XMLパーサーのインスタンス
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  trimValues: true,
});

/**
 * XML文字列をパースしてAPIレスポンス型に変換
 * @param xmlString - パース対象のXML文字列
 * @returns パース結果のオブジェクト
 */
export function parseXmlResponse(xmlString: string): ApiResponse {
  try {
    const result = parser.parse(xmlString) as ApiResponse;
    return result;
  } catch (error) {
    console.error('XML parse error:', error);
    throw new Error(`Failed to parse XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
