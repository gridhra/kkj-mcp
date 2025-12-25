# KKJ MCP Server

官公需情報ポータルサイトAPI（http://www.kkj.go.jp/api/）のMCPサーバー実装です。

## 概要

このMCPサーバーは、日本の官公需情報ポータルサイトから調達情報を検索・取得するためのツールを提供します。

### 主な機能

- **search_notices**: 案件の検索（概要情報を10件ずつ返却）
- **get_notice_details**: 特定案件の詳細情報取得（官公需ポータルサイトへの直接リンクを含む）

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

#### Manusとの統合（リモートMCPサーバー）

Cloudflare Workersにデプロイした後、Manusの設定ファイルで以下のように設定します：

**macOS/Linux**: `~/.config/manus/config.json`（または Manusの設定ファイル）

```json
{
  "mcpServers": {
    "kkj-portal": {
      "url": "https://kkj-mcp-server-prod.houscape.workers.dev/mcp",
      "transport": "streamable-http"
    }
  }
}
```

**認証が必要な場合**:

```json
{
  "mcpServers": {
    "kkj-portal": {
      "url": "https://kkj-mcp-server-prod.houscape.workers.dev/mcp",
      "transport": "streamable-http",
      "headers": {
        "Authorization": "Bearer your-api-key-here"
      }
    }
  }
}
```

**注意**:
- URLは実際にデプロイされたWorkers URLに置き換えてください
- API_KEYSを設定している場合は、`Authorization`ヘッダーに有効なAPIキーを設定してください

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

### 3. Cloudflare Workersモード（リモートMCPサーバー）

Cloudflare Workersにデプロイして、グローバルに分散されたサーバーレス環境で実行できます。WebStandardStreamableHTTPServerTransportを使用し、Manus、Claude Desktop（mcp-remoteプロキシ経由）、その他のMCPクライアントから接続可能です。

#### セットアップ手順

1. **KV Namespaceの作成**:
```bash
# Wranglerにログイン
wrangler login

# 本番用KV Namespaceを作成
wrangler kv:namespace create "KKJ_CACHE"
# 出力例: { binding = "KKJ_CACHE", id = "abc123..." }

# プレビュー用KV Namespaceを作成
wrangler kv:namespace create "KKJ_CACHE" --preview
# 出力例: { binding = "KKJ_CACHE", preview_id = "xyz789..." }
```

2. **wrangler.tomlの設定**:
```toml
# 上記で取得したIDを設定
[[kv_namespaces]]
binding = "KKJ_CACHE"
id = "abc123..."  # 本番用KV ID
preview_id = "xyz789..."  # プレビュー用KV ID
```

3. **API認証キーの設定（オプション）**:
```bash
wrangler secret put API_KEYS
# プロンプトで入力: key1,key2,key3
```

4. **手動デプロイ**:
```bash
# プレビュー環境へデプロイ
npm run dev:workers  # ローカル開発

# 本番環境へデプロイ
npm run deploy:workers
```

#### GitHub Actionsによる自動デプロイ

GitHub ActionsでCloudflare Workersへの自動デプロイが設定されています。

##### 必要な設定

GitHub Actionsで自動デプロイするには、以下の手順でCloudflareとGitHubの設定を行います。

#### ステップ1: Cloudflare KV Namespaceの作成

```bash
# Wranglerにログイン
wrangler login

# 本番用KV Namespaceを作成
wrangler kv:namespace create "KKJ_CACHE"
# 出力例:
# ⛅️ wrangler 3.101.0
# ✨ Success!
# Add the following to your configuration file:
# { binding = "KKJ_CACHE", id = "0123456789abcdef0123456789abcdef" }

# プレビュー用KV Namespaceを作成
wrangler kv:namespace create "KKJ_CACHE" --preview
# 出力例:
# ✨ Success!
# Add the following to your configuration file:
# { binding = "KKJ_CACHE", preview_id = "fedcba9876543210fedcba9876543210" }
```

**重要**: 出力された `id` と `preview_id` をメモしてください。

#### ステップ2: Cloudflare認証情報の取得

**CLOUDFLARE_API_TOKEN の作成:**
1. [Cloudflareダッシュボード](https://dash.cloudflare.com/) にログイン
2. 右上のアバター > **My Profile** をクリック
3. 左メニュー > **API Tokens** をクリック
4. **Create Token** をクリック
5. **Edit Cloudflare Workers** テンプレートの **Use template** をクリック
6. **Account Resources** で対象アカウントを選択
7. **Zone Resources** は `All zones` のまま
8. **Continue to summary** > **Create Token** をクリック
9. 表示されたトークンをコピー（**再表示できないため必ずメモ**）

**CLOUDFLARE_ACCOUNT_ID の取得:**
1. [Cloudflareダッシュボード](https://dash.cloudflare.com/) にログイン
2. 左メニュー > **Workers & Pages** をクリック
3. 右サイドバーの **Account ID** をコピー

#### ステップ3: GitHub Secrets の設定

**リポジトリ > Settings > Secrets and variables > Actions > Secrets** で以下を追加:

| Secret名 | 値 | 取得方法 |
|---------|-----|---------|
| `CLOUDFLARE_API_TOKEN` | `YOUR_CLOUDFLARE_API_TOKEN` | ステップ2で作成したAPIトークン |
| `CLOUDFLARE_ACCOUNT_ID` | `YOUR_ACCOUNT_ID` | ステップ2で取得したAccount ID |
| `API_KEYS` | `key1,key2,key3` | 任意の認証キー（カンマ区切り）<br>例: `prod-key-2024,backup-key-2024`<br>**オプション**: 認証不要な場合は設定不要 |

**設定手順:**
1. GitHub リポジトリページで **Settings** タブをクリック
2. 左メニュー > **Secrets and variables** > **Actions** をクリック
3. **Secrets** タブで **New repository secret** をクリック
4. **Name** に Secret名、**Secret** に値を入力
5. **Add secret** をクリック
6. 上記3つのSecretについて繰り返す

#### ステップ4: GitHub Variables の設定

**リポジトリ > Settings > Secrets and variables > Actions > Variables** で以下を追加:

| Variable名 | 値 | 取得方法 |
|-----------|-----|---------|
| `KV_NAMESPACE_ID` | `0123456789abcdef...` | ステップ1で取得した本番用KV Namespace ID (`id`) |
| `KV_NAMESPACE_PREVIEW_ID` | `fedcba9876543210...` | ステップ1で取得したプレビュー用KV Namespace ID (`preview_id`) |

**設定手順:**
1. **Secrets and variables** > **Actions** ページで **Variables** タブをクリック
2. **New repository variable** をクリック
3. **Name** に Variable名、**Value** に値を入力
4. **Add variable** をクリック
5. 上記2つのVariableについて繰り返す

#### ステップ5: GitHub Environments の設定（オプション）

承認プロセスを追加する場合（本番デプロイ前に手動承認を必須にする）:

1. **リポジトリ > Settings > Environments** をクリック
2. **New environment** をクリック
3. Name: `production` と入力し **Configure environment** をクリック
4. **Environment protection rules** セクションで設定:
   - ✅ **Required reviewers** をチェックし、承認者を追加
   - ✅ **Deployment branches and tags** で `Selected branches and tags` を選択
   - `main` ブランチを追加
5. **Save protection rules** をクリック

**注**: Environment設定後、`.github/workflows/deploy-production.yml` の48行目付近のコメントを解除してください:
```yaml
# environment: production  ← このコメントを外す
environment: production
```

#### 設定確認チェックリスト

- [ ] Cloudflare KV Namespace作成済み（本番用・プレビュー用）
- [ ] GitHub Secrets 3つ設定済み（CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, API_KEYS）
- [ ] GitHub Variables 2つ設定済み（KV_NAMESPACE_ID, KV_NAMESPACE_PREVIEW_ID）
- [ ] GitHub Environments 設定済み（オプション、承認プロセスが必要な場合のみ）

##### デプロイワークフロー

**プレビュー環境へのデプロイ**:
1. PRに `deploy-preview` ラベルを追加
2. GitHub Actionsが自動的にプレビュー環境へデプロイ
3. デプロイURLがPRにコメントされます

**本番環境へのデプロイ**:
1. mainブランチへマージ（またはpush）
2. テストが自動実行
3. テスト成功後、承認待ち状態に
4. 承認者が手動承認
5. 本番環境へデプロイ

**手動トリガー**:
- Actions > Deploy to Cloudflare Workers (Production) > Run workflow

##### デプロイの確認

デプロイ後、以下のエンドポイントでヘルスチェック可能:
```bash
# 本番環境
curl https://kkj-mcp-server-prod.YOUR_ACCOUNT_ID.workers.dev/health

# プレビュー環境
curl https://kkj-mcp-server-preview.YOUR_ACCOUNT_ID.workers.dev/health
```

#### 機能

- **WebStandardStreamableHTTP**: MCPの最新トランスポートを使用（Streamable HTTP）
- **KVキャッシュ**: 検索結果と案件詳細をCloudflare KVに保存（TTL付き）
- **グローバルエッジ**: 世界中のエッジロケーションで実行
- **自動スケーリング**: トラフィックに応じて自動的にスケール
- **コスト効率**: 従量課金、無料枠あり
- **リモートアクセス**: インターネット経由でどこからでもアクセス可能

#### エンドポイント

デプロイ後、以下のエンドポイントが利用可能です：

- `GET /health` - ヘルスチェック
- `GET /mcp` - MCP SSEストリーム確立
- `POST /mcp` - MCPリクエスト送信
- `DELETE /mcp` - MCPセッション終了

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

**レスポンスに含まれる情報**:
- 案件の詳細情報（全フィールド）
- `NoticeUrl`: 官公需ポータルサイトの案件詳細ページへの直接リンク（例: `https://www.kkj.go.jp/d/?D=xxxxx&L=ja`）

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

**検索結果（search_notices）** には以下の情報が含まれます：

- `ResultId`: 案件ID（詳細取得時に使用）
- `ProjectName`: 案件名
- `OrganizationName`: 発注機関
- `CftIssueDate`: 公示日
- `ExternalDocumentURI`: 公告文書へのリンク（直接アクセス可能）

**詳細情報（get_notice_details）** には上記に加えて：

- `NoticeUrl`: 官公需ポータルサイトの案件詳細ページURL
- `ProjectDescription`: 案件説明
- その他の詳細フィールド

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
