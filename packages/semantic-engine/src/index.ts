import { SemanticElement, SemanticUIMap, confidence } from '../../shared-types/src/index.js';

export interface SemanticQuery { readonly businessMeaning?: string; readonly role?: string; readonly action?: string; }
export interface SemanticMatch { readonly element: SemanticElement; readonly score: number; readonly reasons: readonly string[]; }

export class InMemorySemanticIndex {
  private readonly maps = new Map<string, SemanticUIMap>();

  upsert(map: SemanticUIMap): void { this.maps.set(`${map.applicationId}:${map.pageId}`, map); }

  list(applicationId?: string): readonly SemanticUIMap[] {
    return [...this.maps.values()].filter((map) => !applicationId || map.applicationId === applicationId);
  }

  get(applicationId: string, pageId: string): SemanticUIMap | undefined { return this.maps.get(`${applicationId}:${pageId}`); }

  query(applicationId: string, query: SemanticQuery): readonly SemanticMatch[] {
    const matches: SemanticMatch[] = [];
    for (const map of this.maps.values()) {
      if (map.applicationId !== applicationId) continue;
      for (const element of map.elements) {
        const reasons: string[] = [];
        let score = Number(element.confidence) * 0.4;
        if (query.businessMeaning && similarity(query.businessMeaning, element.businessMeaning) > 0.55) { score += 0.35; reasons.push('business_meaning'); }
        if (query.role && query.role === element.semanticRole) { score += 0.15; reasons.push('semantic_role'); }
        const requestedAction = query.action;
        if (requestedAction && element.relatedActions.some((action) => action.includes(requestedAction))) { score += 0.1; reasons.push('related_action'); }
        if (reasons.length > 0) matches.push({ element, score: Math.min(1, score), reasons });
      }
    }
    return matches.sort((a, b) => b.score - a.score);
  }

  resolveTarget(applicationId: string, businessMeaning: string): SemanticElement {
    const match = this.query(applicationId, { businessMeaning }).at(0);
    if (!match || match.score < 0.45) throw new Error(`No semantic target found for ${businessMeaning}`);
    return { ...match.element, confidence: confidence(match.score) };
  }
}

export function similarity(a: string, b: string): number {
  const left = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const right = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}
