/**
 * MCP サーバー実装
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  handleSearchNotices,
  SearchNoticesArgsSchema,
  type SearchNoticesArgs
} from './tools/search.js';
import {
  handleGetNoticeDetails,
  GetNoticeDetailsArgsSchema,
  type GetNoticeDetailsArgs
} from './tools/details.js';

/**
 * MCPサーバーを作成して起動
 * @param transport - トランスポート（Stdio, HTTP等）
 */
export async function startServer(transport: Transport): Promise<Server> {
  const server = new Server(
    {
      name: 'kkj-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  /**
   * ツール一覧の提供
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'search_notices',
          description: '官公需情報ポータルサイトから案件を検索します。結果は概要のみを10件ずつ返します。詳細情報が必要な場合は get_notice_details を使用してください。',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: '検索キーワード（AND, OR, NOT, ANDNOT演算子使用可能）',
              },
              project_name: {
                type: 'string',
                description: '案件名での検索',
              },
              organization_name: {
                type: 'string',
                description: '機関名での検索',
              },
              lg_code: {
                type: 'string',
                description: '都道府県コード（2桁）',
              },
              category: {
                type: 'string',
                enum: ['1', '2', '3'],
                description: 'カテゴリ（1:物品, 2:工事, 3:役務）',
              },
              procedure_type: {
                type: 'string',
                enum: ['1', '2'],
                description: '手続きタイプ（1:一般競争入札等）',
              },
              certification: {
                type: 'string',
                enum: ['A', 'B', 'C', 'D'],
                description: '等級',
              },
              cft_issue_date: {
                type: 'string',
                description: '公示日（例: 2025-12-01/=12月1日以降、/2025-12-31=12月31日まで、2025-12-01/2025-12-31=期間指定、2025-12=12月全体）',
              },
              page: {
                type: 'number',
                description: 'ページ番号（デフォルト: 1）',
                default: 1,
              },
            },
          },
        },
        {
          name: 'get_notice_details',
          description: '特定の案件の詳細情報（公告全文や添付ファイル等）を取得します。search_noticesで取得したResultIdを指定してください。',
          inputSchema: {
            type: 'object',
            properties: {
              result_id: {
                type: 'string',
                description: 'search_noticesで取得したResultId',
              },
            },
            required: ['result_id'],
          },
        },
      ],
    };
  });

  /**
   * ツール実行ハンドラー
   */
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'search_notices') {
        // 引数の検証
        const validatedArgs = SearchNoticesArgsSchema.parse(args) as SearchNoticesArgs;

        // 検索実行
        const result = await handleSearchNotices(validatedArgs);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      if (name === 'get_notice_details') {
        // 引数の検証
        const validatedArgs = GetNoticeDetailsArgsSchema.parse(args) as GetNoticeDetailsArgs;

        // 詳細取得
        const result = await handleGetNoticeDetails(validatedArgs);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}`,
          },
        ],
      };
    } catch (error) {
      console.error(`Error executing tool ${name}:`, error);

      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  });

  // サーバー起動
  await server.connect(transport);

  console.error('KKJ MCP Server started successfully');

  return server;
}
