import { describe, it, expect } from 'vitest';
import { handleDomainKnowledge } from './domain-knowledge.js';

describe('get_domain_knowledge tool', () => {
  describe('Knowledge retrieval', () => {
    it('should retrieve bidding_methods knowledge with detailed level', async () => {
      const result = await handleDomainKnowledge({
        category: 'bidding_methods',
        detail_level: 'detailed',
      });

      expect(result.category).toBe('bidding_methods');
      expect(result.category_label).toBe('入札方式');
      expect(result.detail_level).toBe('detailed');
      expect(result.content).toContain('一般競争入札');
      expect(result.content).toContain('指名競争入札');
      expect(result.content).toContain('随意契約');
    });

    it('should retrieve brief version of knowledge', async () => {
      const result = await handleDomainKnowledge({
        category: 'timeline_and_flow',
        detail_level: 'brief',
      });

      expect(result.detail_level).toBe('brief');
      expect(result.content).toContain('公告期間');
      // Brief版は短いはず
      expect(result.content.length).toBeLessThan(3000);
    });

    it('should retrieve comprehensive version of knowledge', async () => {
      const result = await handleDomainKnowledge({
        category: 'legal_constraints',
        detail_level: 'comprehensive',
      });

      expect(result.detail_level).toBe('comprehensive');
      expect(result.content).toContain('最低制限価格');
      // Comprehensive版は長いはず
      expect(result.content.length).toBeGreaterThan(3000);
    });

    it('should retrieve all available categories', async () => {
      const categories = [
        'bidding_methods',
        'timeline_and_flow',
        'qualification_ranking',
        'evaluation_scoring',
        'legal_constraints',
        'search_strategy',
      ] as const;

      for (const category of categories) {
        const result = await handleDomainKnowledge({
          category,
          detail_level: 'brief',
        });

        expect(result.category).toBe(category);
        expect(result.content).toBeTruthy();
        expect(result.content.length).toBeGreaterThan(100);
      }
    });
  });

  describe('Glossary search', () => {
    it('should search glossary for specific term (table format)', async () => {
      const result = await handleDomainKnowledge({
        category: 'glossary',
        search_term: '経審',
      });

      expect(result.category).toBe('glossary');
      expect(result.content).toContain('経審');
      expect(result.content).toContain('経営事項審査');
    });

    it('should search glossary for term in heading format', async () => {
      const result = await handleDomainKnowledge({
        category: 'glossary',
        search_term: '経営事項審査',
      });

      expect(result.category).toBe('glossary');
      expect(result.content).toContain('経営事項審査');
      expect(result.content).toContain('経審');
    });

    it('should return message when term not found', async () => {
      const result = await handleDomainKnowledge({
        category: 'glossary',
        search_term: 'NONEXISTENT_TERM_XYZ',
      });

      expect(result.content).toContain('用語が見つかりません');
      expect(result.content).toContain('NONEXISTENT_TERM_XYZ');
    });

    it('should retrieve full glossary when no search term provided', async () => {
      const result = await handleDomainKnowledge({
        category: 'glossary',
        detail_level: 'brief',
      });

      expect(result.category).toBe('glossary');
      expect(result.content).toContain('用語');
      // search_termなしの場合、available_categoriesが提供される
      expect(result.available_categories).toBeDefined();
      expect(result.available_categories).toBeInstanceOf(Array);
    });
  });

  describe('Error handling', () => {
    it('should throw error for invalid category', async () => {
      await expect(
        handleDomainKnowledge({
          category: 'invalid_category' as any,
        })
      ).rejects.toThrow();
    });
  });

  describe('Default parameters', () => {
    it('should use "detailed" as default detail_level', async () => {
      const result = await handleDomainKnowledge({
        category: 'bidding_methods',
      });

      expect(result.detail_level).toBe('detailed');
    });
  });

  describe('Content quality checks', () => {
    it('should contain法的根拠 in detailed version', async () => {
      const result = await handleDomainKnowledge({
        category: 'timeline_and_flow',
        detail_level: 'detailed',
      });

      expect(result.content).toMatch(/地方自治法|建設業法/);
    });

    it('should contain 計算式 in comprehensive version of legal_constraints', async () => {
      const result = await handleDomainKnowledge({
        category: 'legal_constraints',
        detail_level: 'comprehensive',
      });

      expect(result.content).toContain('最低制限価格');
      expect(result.content).toMatch(/係数|計算/);
    });

    it('should contain 戦略 or コツ in search_strategy', async () => {
      const result = await handleDomainKnowledge({
        category: 'search_strategy',
        detail_level: 'detailed',
      });

      expect(result.content).toMatch(/戦略|コツ|テクニック/);
    });
  });
});
