import { z } from 'zod';
import {
  loadInvestigationPrimer,
  loadMultipleKnowledge,
  type KnowledgeCategory,
  type DetailLevel,
} from '../knowledge/index.js';

/**
 * get_investigation_primer ツールの引数スキーマ
 */
export const InvestigationPrimerArgsSchema = z.object({
  scope: z.enum(['overview', 'full_context'])
    .optional()
    .default('overview')
    .describe('取得範囲 (overview: 概要のみ, full_context: 詳細な前提知識セット)'),
  focus_areas: z.array(z.enum([
    'bidding_methods',
    'timeline_and_flow',
    'qualification_ranking',
    'evaluation_scoring',
    'legal_constraints',
    'search_strategy',
  ]))
    .optional()
    .describe('特定分野に絞る場合のカテゴリ配列（オプション）'),
});

export type InvestigationPrimerArgs = z.infer<typeof InvestigationPrimerArgsSchema>;

/**
 * Investigation Primer Result
 */
export interface InvestigationPrimerResult {
  scope: 'overview' | 'full_context';
  content: string;
  focus_areas?: string[];
  usage_note: string;
}

/**
 * get_investigation_primer ツールのハンドラー
 * AI Agent自身が調査前に前提知識を把握するための情報を取得
 *
 * @param args ツールの引数
 * @returns 調査前提知識
 */
export async function handleInvestigationPrimer(
  args: InvestigationPrimerArgs
): Promise<InvestigationPrimerResult> {
  const { scope = 'overview', focus_areas } = args;

  try {
    let content: string;
    const usage_note = `この情報は、AI Agentが公共事業案件の調査を開始する前に把握すべき「思考のガイドライン」です。
ユーザーには直接提示せず、AI内部の推論・判断・アドバイス生成のベースとして活用してください。`;

    if (focus_areas && focus_areas.length > 0) {
      // 特定分野に絞った前提知識を取得
      const detailLevel: DetailLevel = scope === 'overview' ? 'brief' : 'detailed';
      const knowledgeMap = loadMultipleKnowledge(
        focus_areas as KnowledgeCategory[],
        detailLevel
      );

      // Investigation Primerも含める
      const primer = loadInvestigationPrimer(scope);

      content = `${primer}\n\n---\n\n# 重点分野の知識\n\n${Object.entries(knowledgeMap)
        .map(([_, text]) => text)
        .join('\n\n---\n\n')}`;
    } else {
      // 通常のInvestigation Primer取得
      content = loadInvestigationPrimer(scope);

      // full_contextの場合は、各カテゴリのbrief版も追加
      if (scope === 'full_context') {
        const categories: KnowledgeCategory[] = [
          'bidding_methods',
          'timeline_and_flow',
          'qualification_ranking',
          'evaluation_scoring',
          'legal_constraints',
          'search_strategy',
        ];

        const briefKnowledge = loadMultipleKnowledge(categories, 'brief');

        content += '\n\n---\n\n# 各分野の要点\n\n';
        content += Object.entries(briefKnowledge)
          .map(([_, text]) => text)
          .join('\n\n---\n\n');
      }
    }

    return {
      scope,
      content,
      focus_areas,
      usage_note,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to retrieve investigation primer: ${error.message}`);
    }
    throw error;
  }
}

/**
 * ツール定義のメタデータ
 */
export const investigationPrimerToolDefinition = {
  name: 'get_investigation_primer',
  description: `AI Agent自身が公共事業案件の調査を開始する前に、ドメイン知識とコツを少ないコンテキスト量で把握するための前提知識を取得します。

このツールは、以下のような状況で使用してください：
- ユーザーが案件検索を依頼する前に、調査の心得を把握したい
- 検索結果を分析する際の判断基準を理解したい
- 季節性、リスク検知、優先度付けなどの推論ロジックを学びたい

scopeの選択：
- overview: 概要のみ（検索クエリ最適化、日付リスク検知、季節性など基本的な心得）
- full_context: 詳細な前提知識セット（各分野の要点も含む包括的な情報）

focus_areasの活用：
特定分野に絞りたい場合、focus_areasで以下のカテゴリを指定できます：
- bidding_methods: 入札方式の判別ロジック
- timeline_and_flow: タイムライン分析と締切リスク検知
- qualification_ranking: ランク・地域要件の適合性判定
- evaluation_scoring: 総合評価の加算点推定
- legal_constraints: 最低制限価格のシミュレーション
- search_strategy: 検索クエリ最適化と優先度付け

注意：この情報はAI内部で使用し、ユーザーには「結論」だけを提示してください。`,
  inputSchema: {
    type: 'object',
    properties: {
      scope: {
        type: 'string',
        enum: ['overview', 'full_context'],
        description: '取得範囲 (overview: 概要のみ, full_context: 詳細な前提知識セット)',
        default: 'overview',
      },
      focus_areas: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'bidding_methods',
            'timeline_and_flow',
            'qualification_ranking',
            'evaluation_scoring',
            'legal_constraints',
            'search_strategy',
          ],
        },
        description: '特定分野に絞る場合のカテゴリ配列（オプション）',
      },
    },
  },
} as const;
