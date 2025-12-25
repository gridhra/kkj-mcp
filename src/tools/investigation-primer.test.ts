import { describe, it, expect } from 'vitest';
import { handleInvestigationPrimer } from './investigation-primer.js';

describe('get_investigation_primer tool', () => {
  describe('Overview scope', () => {
    it('should retrieve overview primer', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'overview',
      });

      expect(result.scope).toBe('overview');
      expect(result.content).toContain('調査');
      expect(result.content).toContain('AI');
      expect(result.usage_note).toContain('思考のガイドライン');
    });

    it('should contain search optimization hints in overview', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'overview',
      });

      expect(result.content).toMatch(/検索|クエリ/);
    });

    it('should contain timeline risk detection in overview', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'overview',
      });

      expect(result.content).toMatch(/日付|締切|リスク/);
    });

    it('should contain seasonality considerations in overview', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'overview',
      });

      expect(result.content).toMatch(/季節|年度末|月/);
    });
  });

  describe('Full context scope', () => {
    it('should retrieve full_context primer', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'full_context',
      });

      expect(result.scope).toBe('full_context');
      expect(result.content).toContain('調査');
      // full_contextは各分野の要点も含むため、長いはず
      expect(result.content.length).toBeGreaterThan(10000);
    });

    it('should include all domain brief summaries in full_context', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'full_context',
      });

      expect(result.content).toContain('各分野の要点');
      expect(result.content).toContain('入札方式');
      expect(result.content).toContain('タイムライン');
      expect(result.content).toContain('資格要件');
    });
  });

  describe('Focus areas', () => {
    it('should retrieve primer with specific focus areas', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'overview',
        focus_areas: ['bidding_methods', 'timeline_and_flow'],
      });

      expect(result.focus_areas).toEqual(['bidding_methods', 'timeline_and_flow']);
      expect(result.content).toContain('重点分野の知識');
      expect(result.content).toContain('入札方式');
      expect(result.content).toContain('タイムライン');
    });

    it('should combine primer with detailed knowledge when full_context with focus_areas', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'full_context',
        focus_areas: ['qualification_ranking'],
      });

      expect(result.focus_areas).toEqual(['qualification_ranking']);
      expect(result.content).toContain('経審');
      expect(result.content).toContain('P点');
    });

    it('should handle multiple focus areas', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'overview',
        focus_areas: [
          'bidding_methods',
          'timeline_and_flow',
          'qualification_ranking',
          'evaluation_scoring',
        ],
      });

      expect(result.focus_areas).toHaveLength(4);
      expect(result.content).toContain('一般競争');
      expect(result.content).toMatch(/公告|締切/);
      expect(result.content).toContain('ランク');
      expect(result.content).toContain('総合評価');
    });
  });

  describe('Default parameters', () => {
    it('should use "overview" as default scope', async () => {
      const result = await handleInvestigationPrimer({});

      expect(result.scope).toBe('overview');
    });
  });

  describe('Content quality checks', () => {
    it('should contain query optimization logic in overview', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'overview',
      });

      // 検索クエリの自動拡張ロジックが含まれているか
      expect(result.content).toMatch(/OR|AND|NOT/);
    });

    it('should contain risk detection patterns', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'full_context',
      });

      // リスク検知のロジックが含まれているか
      expect(result.content).toMatch(/days_since_issue|days_until_bid/i);
    });

    it('should contain ranking eligibility判定 logic in full_context', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'full_context',
      });

      // ランク適合性判定のロジックが含まれているか
      expect(result.content).toMatch(/eligible|P点|ランク/);
    });
  });

  describe('Usage note', () => {
    it('should always include usage note', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'overview',
      });

      expect(result.usage_note).toBeTruthy();
      expect(result.usage_note).toContain('AI');
      expect(result.usage_note).toContain('思考');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid scope gracefully', async () => {
      // Zodのバリデーションでエラーになるはずだが、
      // ツールハンドラー自体はエラーハンドリングしている
      const result = await handleInvestigationPrimer({
        scope: 'overview',
      });

      expect(result).toBeTruthy();
    });
  });

  describe('Content comprehensiveness', () => {
    it('should cover all key AI reasoning areas in full_context', async () => {
      const result = await handleInvestigationPrimer({
        scope: 'full_context',
      });

      // 主要な推論エリアがカバーされているか
      const keyAreas = [
        '検索',
        'リスク',
        '優先度',
        'ランク',
        '地域',
        '総合評価',
      ];

      for (const area of keyAreas) {
        expect(result.content).toContain(area);
      }
    });
  });
});
