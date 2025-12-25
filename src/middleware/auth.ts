/**
 * 認証ミドルウェア
 */

import type { Request, Response, NextFunction } from 'express';
import { getAuthConfig, validateApiKey, isLocalhost } from '../config/auth.js';

/**
 * Bearer トークン認証ミドルウェア
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const config = getAuthConfig();

  // 認証が無効な場合はスキップ
  if (!config.enabled) {
    next();
    return;
  }

  // localhostをバイパス
  if (config.bypassLocalhost && isLocalhost(req.hostname)) {
    next();
    return;
  }

  // Authorization ヘッダーからトークンを取得
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : null;

  // APIキーを検証
  if (!validateApiKey(token)) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key',
    });
    return;
  }

  next();
}
