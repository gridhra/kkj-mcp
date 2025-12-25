# KKJ MCP Server

官公需情報ポータルサイトAPI（http://www.kkj.go.jp/api/）のMCPサーバー実装です。

## 概要

このMCPサーバーは、日本の官公需情報ポータルサイトから調達情報を検索・取得するためのツールを提供します。

### 主な機能

- **search_notices**: 案件の検索（概要情報を10件ずつ返却）
- **get_notice_details**: 特定案件の詳細情報取得

### 特徴

- **トークン効率化**: 検索結果は最小限の情報のみを返し、詳細は必要時のみ取得
- **ページネーション**: 検索結果を10件ずつ表示し、大量データを効率的に処理
- **メモリキャッシュ**: 検索結果をプロセス内で保持し、詳細取得を高速化
- **フォールバック検索**: キャッシュミス時も追加パラメータでAPI検索し、ResultIdでフィルタリング
- **複数デプロイモード**: Stdio（CLI）、HTTP、Cloudflare Workers対応
- **APIキー認証**: 本番環境での安全なアクセス制御
- **自動化されたCI/CD**: GitHub Actionsによる自動テスト・ビルド

## 必要要件

- Node.js >= 20.0.0
- npm または yarn

## インストール

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# テスト実行
npm test
```

## デプロイモード

### 1. Stdioモード（CLI / Claude Desktop統合）

デフォルトのモードです。標準入出力を使用してMCPサーバーと通信します。

```bash
# 起動
npm start

# または直接実行
node build/index.js
```

#### Claude Desktopとの統合

Claude Desktop設定ファイルを編集します：

**macOS/Linux**: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "kkj-portal": {
      "command": "node",
      "args": [
        "/absolute/path/to/kkj-mcp-server/build/index.js"
      ]
    }
  }
}
```

設定後、Claude Desktopを再起動してください。

### 2. HTTPサーバーモード

HTTPサーバーとして起動し、Web経由でMCPサーバーにアクセスできます。

```bash
# 環境変数を設定して起動
SERVER_MODE=http PORT=3000 npm run start:http

# または開発モード（認証なし）
npm run dev:http
```

#### 環境変数

`.env`ファイルを作成（`.env.example`を参考）：

```bash
# サーバーモード
SERVER_MODE=http

# サーバー設定
PORT=3000
HOST=0.0.0.0

# CORS設定
CORS_ORIGIN=*
CORS_CREDENTIALS=false

# API認証（本番環境用）
NODE_ENV=production
API_KEYS=your-api-key-1,your-api-key-2
```

#### エンドポイント

- `GET /health` - ヘルスチェック
- `GET /mcp/sse` - MCP SSEエンドポイント（Server-Sent Events）
- `POST /mcp/message` - MCPメッセージ送信

#### 使用例

```bash
# ヘルスチェック
curl http://localhost:3000/health

# MCPへの接続（SSE）
curl -H "Authorization: Bearer your-api-key" http://localhost:3000/mcp/sse
```

### 3. Cloudflare Workersモード（予定）

Cloudflare Workersにデプロイして、グローバルに分散されたサーバーレス環境で実行できます。

```bash
# Cloudflare Workersへデプロイ
npm run deploy:cloudflare
```

**注**: Cloudflare Workers対応は開発中です。

## APIキー認証

### 認証の動作

- **本番環境（NODE_ENV=production）**: APIキーが必須
- **開発環境（NODE_ENV=development）**: localhostからのアクセスは認証不要
- **Stdioモード**: 認証なし（ローカル実行のため）

### APIキーの設定

```bash
# .envファイルまたは環境変数で設定
API_KEYS=key1,key2,key3
NODE_ENV=production
```

### 使用方法

HTTPリクエストに`Authorization`ヘッダーを追加：

```bash
curl -H "Authorization: Bearer your-api-key" \
     http://your-server/mcp/sse
```

## 開発

### ローカル開発

```bash
# 監視モード（自動再コンパイル）
npm run watch

# テスト実行
npm test

# カバレッジ付きテスト
npm run test:coverage

# テストUI
npm run test:ui

# MCP Inspectorでテスト
npm run inspector
```

### テスト

プロジェクトには44個の自動テストが含まれています：

```bash
# 全テスト実行
npm test

# カバレッジレポート生成
npm run test:coverage

# ウォッチモード
npm run test:watch
```

テストカバレッジ:
- API Client: 100%
- Tools (search, details): 100%
- XML Parser: 66%

## 使用方法

### 1. 案件を検索

```
search_notices を使って「外壁塗装」に関する東京都の案件を検索してください
```

パラメータ:
- `query`: 検索キーワード（AND, OR, NOT, ANDNOT演算子使用可能）
- `project_name`: 案件名
- `organization_name`: 機関名
- `lg_code`: 都道府県コード（13 = 東京都）
- `category`: カテゴリ（1:物品, 2:工事, 3:役務）
- `procedure_type`: 手続きタイプ
- `certification`: 等級（A, B, C, D）
- `cft_issue_date`: 公示日（例: 2025-12-01/, /2025-12-31, 2025-12）
- `page`: ページ番号（デフォルト: 1）

### 2. 詳細情報を取得

```
ResultId "12345" の詳細情報を get_notice_details で取得してください
```

パラメータ:
- `result_id`: search_noticesで取得したResultId（必須）

**フォールバック検索パラメータ**（オプション - キャッシュミス時に使用）:
- `project_name`: 案件名（例: "道路整備工事"）
- `organization_name`: 機関名（例: "国土交通省"）
- `query`: キーワード検索（例: "建設 AND 東京"）
- `lg_code`: 都道府県コード（例: "13"）

> **注意**: 官公需APIはResultIdによる直接検索をサポートしていません。
> キャッシュにResultIdが見つからない場合、フォールバック検索パラメータを使用することで、
> APIから該当案件を検索し、ResultIdでフィルタリングして取得できます。

#### 使用例

**基本的な使用方法（キャッシュから取得）**:
```
# 先に検索を実行
search_notices で「学校」を検索

# キャッシュから詳細を取得
get_notice_details で ResultId "12345" の詳細を取得
```

**フォールバック検索を使用**:
```
# キャッシュにない場合でも、追加パラメータで取得可能
get_notice_details で ResultId "12345" を project_name "学校改修工事" で取得
```

### 検索結果の見方

検索結果には以下の情報が含まれます：

- `ResultId`: 案件ID（詳細取得時に使用）
- `ProjectName`: 案件名
- `OrganizationName`: 発注機関
- `CftIssueDate`: 公示日
- `ExternalDocumentURI`: 公告文書へのリンク（直接アクセス可能）

## プロジェクト構成

```
kkj-mcp-server/
├── .github/
│   └── workflows/
│       ├── ci.yml          # CI/CDワークフロー
│       └── dependabot.yml  # 依存関係自動更新
├── src/
│   ├── index.ts            # エントリーポイント（Stdioモード）
│   ├── http.ts             # HTTPサーバーエントリーポイント
│   ├── server.ts           # MCPサーバーメインロジック
│   ├── config/
│   │   ├── server.ts       # サーバー設定
│   │   └── auth.ts         # 認証設定
│   ├── middleware/
│   │   └── auth.ts         # 認証ミドルウェア
│   ├── api/
│   │   ├── client.ts       # 官公需API クライアント
│   │   └── types.ts        # API型定義
│   ├── parsers/
│   │   ├── xml.ts          # XMLパーサー
│   │   └── xml.test.ts     # XMLパーサーテスト
│   └── tools/
│       ├── search.ts       # 検索ツール
│       ├── search.test.ts  # 検索ツールテスト
│       ├── details.ts      # 詳細ツール
│       └── details.test.ts # 詳細ツールテスト
├── build/                  # ビルド成果物
├── .env.example            # 環境変数サンプル
├── .nvmrc                  # Node.jsバージョン指定
├── package.json
├── tsconfig.json
├── vitest.config.ts        # テスト設定
└── README.md
```

## API仕様

### 官公需情報ポータルサイトAPI

- **ベースURL**: http://www.kkj.go.jp/api/
- **リクエスト方式**: GET
- **レスポンス形式**: XML
- **文字コード**: UTF-8
- **必須条件**: Query, Project_Name, Organization_Name, LG_Code のいずれか1つ以上

### 日付形式

公示日（cft_issue_date）パラメータは以下の形式をサポート：

- `YYYY-MM-DD/`: 指定日以降
- `/YYYY-MM-DD`: 指定日まで
- `YYYY-MM-DD/YYYY-MM-DD`: 期間指定
- `YYYY-MM`: 指定月全体（自動的に `YYYY-MM-01/` に変換）

## CI/CD

GitHub Actionsによる自動化：

- **プッシュ/プルリクエスト時**:
  - 型チェック
  - テスト実行（Node.js 20.x, 22.x）
  - ビルド検証
  - カバレッジレポート

- **依存関係更新**:
  - Dependabotによる週次自動更新

## トラブルシューティング

### ビルドエラー

```bash
# node_modules を削除して再インストール
rm -rf node_modules package-lock.json
npm install
npm run build
```

### HTTPサーバーが起動しない

```bash
# 環境変数を確認
echo $SERVER_MODE
echo $PORT

# ログを確認
SERVER_MODE=http PORT=3000 node build/http.js
```

### 認証エラー

```bash
# APIキーが正しく設定されているか確認
echo $API_KEYS

# 開発環境では認証をバイパス
NODE_ENV=development npm run dev:http
```

### Claude Desktopで認識されない

1. 設定ファイルのパスが絶対パスになっているか確認
2. ビルドが完了しているか確認（`build/index.js`が存在するか）
3. Claude Desktopを完全に再起動

### デバッグ方法

```bash
# MCP Inspectorを使用
npm run inspector

# または直接実行してログ確認
node build/index.js

# HTTPモードのデバッグ
SERVER_MODE=http PORT=3000 node build/http.js
```

## セキュリティ

- APIキーは環境変数で管理し、コードにハードコードしない
- `.env`ファイルは`.gitignore`に追加済み
- 本番環境では必ずHTTPS経由でアクセス
- Cloudflare Workersは自動的にHTTPSを提供

## パフォーマンス

- メモリキャッシュによる高速な詳細取得
- ページネーションによる効率的なデータ処理
- 検索結果は最小限の情報のみを返してトークン使用量を削減

## ライセンス

MIT

## 関連リンク

- [官公需情報ポータルサイト](http://www.kkj.go.jp/)
- [MCP Documentation](https://modelcontextprotocol.io/)
- [MCP SDK for TypeScript](https://github.com/modelcontextprotocol/typescript-sdk)
- [GitHub Repository](https://github.com/your-username/kkj-mcp-server)

## 貢献

プルリクエストを歓迎します！大きな変更の場合は、まずissueを開いて変更内容を議論してください。

## サポート

問題が発生した場合は、GitHubのissueで報告してください。
