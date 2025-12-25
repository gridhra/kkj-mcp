import { z } from 'zod';
import {
  loadKnowledge,
  searchGlossary,
  getAllCategories,
  getCategoryLabel,
  type KnowledgeCategory,
  type DetailLevel,
} from '../knowledge/index.js';

/**
 * get_domain_knowledge ツールの引数スキーマ
 */
export const DomainKnowledgeArgsSchema = z.object({
  category: z.enum([
    'bidding_methods',
    'timeline_and_flow',
    'qualification_ranking',
    'evaluation_scoring',
    'legal_constraints',
    'search_strategy',
    'glossary',
  ]).describe('取得したい知識のカテゴリ'),
  detail_level: z.enum(['brief', 'detailed', 'comprehensive'])
    .optional()
    .default('detailed')
    .describe('詳細度レベル (brief: 簡潔版, detailed: 標準版, comprehensive: 完全版)'),
  search_term: z.string()
    .optional()
    .describe('用語集を検索する場合の検索語（category="glossary"の場合のみ有効）'),
});

export type DomainKnowledgeArgs = z.infer<typeof DomainKnowledgeArgsSchema>;

/**
 * Domain Knowledge Result
 */
export interface DomainKnowledgeResult {
  category: string;
  category_label: string;
  detail_level: DetailLevel;
  content: string;
  available_categories?: string[];
}

/**
 * get_domain_knowledge ツールのハンドラー
 * ユーザーからのドメイン知識の質問に回答するための知識を取得
 *
 * @param args ツールの引数
 * @returns 知識テキスト
 */
export async function handleDomainKnowledge(
  args: DomainKnowledgeArgs
): Promise<DomainKnowledgeResult> {
  const { category, detail_level = 'detailed', search_term } = args;

  try {
    let content: string;

    // 用語集の場合、search_termが指定されていれば検索
    if (category === 'glossary' && search_term) {
      const result = searchGlossary(search_term);
      if (result) {
        content = `# ${search_term} の説明\n\n${result}`;
      } else {
        content = `# 用語が見つかりません\n\n「${search_term}」に該当する用語が用語集に見つかりませんでした。\n\n以下のカテゴリで詳細な情報を探してください：\n${getAllCategories().filter(c => c !== 'glossary' && c !== 'investigation_primer').map(c => `- ${getCategoryLabel(c as KnowledgeCategory)}`).join('\n')}`;
      }
    } else {
      // 通常の知識取得
      content = loadKnowledge(category as KnowledgeCategory, detail_level);
    }

    return {
      category,
      category_label: getCategoryLabel(category as KnowledgeCategory),
      detail_level,
      content,
      available_categories: category === 'glossary' && !search_term
        ? getAllCategories().filter(c => c !== 'investigation_primer')
        : undefined,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to retrieve domain knowledge: ${error.message}`);
    }
    throw error;
  }
}

/**
 * ツール定義のメタデータ
 */
export const domainKnowledgeToolDefinition = {
  name: 'get_domain_knowledge',
  description: `日本の公共事業入札に関する専門的なドメイン知識を取得します。ユーザーが入札のルール、スケジュール感、資格要件、用語の意味について質問した際に使用してください。

利用可能なカテゴリ：
- bidding_methods: 入札方式（一般競争、指名競争、随意契約等）
- timeline_and_flow: タイムラインと法的期間（公告期間、見積期間、締切等）
- qualification_ranking: 資格要件とランク付け（経審、P点、地域要件等）
- evaluation_scoring: 総合評価落札方式（加算点、技術提案等）
- legal_constraints: 法的制約と最低制限価格（ダンピング防止、低入札調査等）
- search_strategy: 検索と情報収集の戦略（キーワード選定、季節性、外部DB等）
- glossary: 用語集（専門用語の検索）

詳細度レベル：
- brief: 重要ポイントのみの簡潔版（2-3段落程度）
- detailed: 標準的な説明、法的根拠を含む（推奨）
- comprehensive: 完全版、計算式や具体例を含む詳細な解説`,
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: [
          'bidding_methods',
          'timeline_and_flow',
          'qualification_ranking',
          'evaluation_scoring',
          'legal_constraints',
          'search_strategy',
          'glossary',
        ],
        description: '取得したい知識のカテゴリ',
      },
      detail_level: {
        type: 'string',
        enum: ['brief', 'detailed', 'comprehensive'],
        description: '詳細度レベル (brief: 簡潔版, detailed: 標準版, comprehensive: 完全版)',
        default: 'detailed',
      },
      search_term: {
        type: 'string',
        description: '用語集を検索する場合の検索語（category="glossary"の場合のみ有効）',
      },
    },
    required: ['category'],
  },
} as const;
