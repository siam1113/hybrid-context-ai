import { SemanticElement, SelectorCandidate, confidence } from '../../../packages/shared-types/src/index.js';
import { similarity } from '../../../packages/semantic-engine/src/index.js';

export interface RecoveryCandidate { readonly element: SemanticElement; readonly score: number; readonly strategy: 'semantic_rematch' | 'alternate_selector' | 'nearby_component' | 'historical_pattern'; }

export class RecoveryAgent {
  rank(original: SemanticElement, candidates: readonly SemanticElement[]): readonly RecoveryCandidate[] {
    return candidates.map((element) => ({ element, score: this.score(original, element), strategy: 'semantic_rematch' as const })).filter((candidate) => candidate.score > 0.4).sort((a, b) => b.score - a.score);
  }
  promoteSelector(element: SemanticElement, selector: SelectorCandidate): SemanticElement {
    return { ...element, selectors: [{ ...selector, confidence: confidence(Math.min(1, Number(selector.confidence) + 0.08)), lastVerifiedAt: new Date().toISOString() }, ...element.selectors] };
  }
  private score(original: SemanticElement, candidate: SemanticElement): number {
    return Math.min(1, similarity(original.businessMeaning, candidate.businessMeaning) * 0.45 + (original.semanticRole === candidate.semanticRole ? 0.25 : 0) + Number(candidate.confidence) * 0.3);
  }
}
