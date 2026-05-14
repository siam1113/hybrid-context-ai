import { ConfidenceScore, SemanticElement, SemanticRole, SelectorCandidate, confidence } from '../../shared-types/src/index.js';

export interface RawDomElement {
  readonly tagName: string;
  readonly textContent?: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly rect?: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly children?: readonly RawDomElement[];
}

export interface DomProcessingOptions {
  readonly applicationVocabulary: Readonly<Record<string, string>>;
  readonly minConfidence: ConfidenceScore;
}

export class SemanticDomProcessor {
  process(root: RawDomElement, options: DomProcessingOptions): readonly SemanticElement[] {
    const elements: SemanticElement[] = [];
    const visit = (node: RawDomElement, parentComponent?: string, index = 0): void => {
      const role = this.inferRole(node);
      const businessMeaning = this.inferBusinessMeaning(node, options.applicationVocabulary);
      const selectors = this.buildSelectors(node, role);
      const fingerprint = this.fingerprint(node, role, businessMeaning, parentComponent);
      const score = this.scoreElement(node, selectors, businessMeaning);
      const elementId = `${businessMeaning.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${index}_${fingerprint.slice(0, 8)}`;
      if (score >= options.minConfidence || role !== 'unknown') {
        elements.push({
          elementId,
          semanticRole: role,
          businessMeaning,
          selectors,
          confidence: confidence(Math.max(score, Number(options.minConfidence))),
          ...(node.rect ? { visualPosition: node.rect } : {}),
          ...(parentComponent ? { parentComponent } : {}),
          ...(node.textContent?.trim() ? { text: node.textContent.trim() } : {}),
          attributes: node.attributes,
          relatedActions: this.relatedActions(role, businessMeaning),
          fingerprint
        });
      }
      node.children?.forEach((child, childIndex) => visit(child, role === 'modal' || role === 'navigation' ? elementId : parentComponent, childIndex));
    };
    visit(root);
    return elements;
  }

  private inferRole(node: RawDomElement): SemanticRole {
    const tag = node.tagName.toLowerCase();
    const role = node.attributes.role?.toLowerCase();
    const aria = `${node.attributes['aria-label'] ?? ''} ${node.textContent ?? ''}`.toLowerCase();
    if (role === 'dialog' || aria.includes('modal')) return 'modal';
    if (role === 'navigation' || tag === 'nav') return 'navigation';
    if (role === 'button' || tag === 'button' || node.attributes.onclick) return 'button';
    if (tag === 'textarea') return 'textarea';
    if (tag === 'input' && node.attributes.type === 'file') return 'file_dropzone';
    if (tag === 'input' || role === 'textbox') return 'input';
    if (role === 'menu') return 'menu';
    if (tag === 'table' || role === 'table') return 'table';
    if (role === 'status' || role === 'alert' || aria.includes('sent')) return 'toast';
    return 'unknown';
  }

  private inferBusinessMeaning(node: RawDomElement, vocabulary: Readonly<Record<string, string>>): string {
    const source = `${node.attributes['aria-label'] ?? ''} ${node.attributes.placeholder ?? ''} ${node.textContent ?? ''}`.trim().toLowerCase();
    const match = Object.entries(vocabulary).find(([phrase]) => source.includes(phrase.toLowerCase()));
    if (match) return match[1];
    if (source.length > 0) return source.slice(0, 80);
    return `${node.tagName.toLowerCase()}_component`;
  }

  private buildSelectors(node: RawDomElement, role: SemanticRole): readonly SelectorCandidate[] {
    const candidates: SelectorCandidate[] = [];
    const aria = node.attributes['aria-label'];
    const testId = node.attributes['data-testid'] ?? node.attributes['data-test'];
    if (aria) candidates.push({ strategy: 'aria', value: aria, confidence: confidence(0.94) });
    if (node.attributes.role) candidates.push({ strategy: 'role', value: node.attributes.role, confidence: confidence(0.86) });
    if (testId) candidates.push({ strategy: 'test_id', value: testId, confidence: confidence(0.96) });
    if (node.textContent?.trim()) candidates.push({ strategy: 'text', value: node.textContent.trim().slice(0, 120), confidence: confidence(role === 'button' ? 0.82 : 0.62) });
    if (node.attributes.id) candidates.push({ strategy: 'css', value: `#${node.attributes.id}`, confidence: confidence(0.7) });
    candidates.push({ strategy: 'semantic_fingerprint', value: this.fingerprint(node, role, '', undefined), confidence: confidence(0.78) });
    return candidates.sort((a, b) => Number(b.confidence) - Number(a.confidence));
  }

  private scoreElement(node: RawDomElement, selectors: readonly SelectorCandidate[], businessMeaning: string): number {
    const selectorScore = selectors.reduce((sum, selector) => sum + Number(selector.confidence), 0) / Math.max(1, selectors.length);
    const textScore = businessMeaning === 'component' ? 0.2 : 0.75;
    const geometryScore = node.rect && node.rect.width > 0 && node.rect.height > 0 ? 0.1 : 0;
    return Math.min(1, selectorScore * 0.7 + textScore * 0.2 + geometryScore);
  }

  private relatedActions(role: SemanticRole, businessMeaning: string): readonly string[] {
    if (role === 'button') return [`click:${businessMeaning}`];
    if (role === 'input' || role === 'textarea') return [`fill:${businessMeaning}`];
    if (role === 'file_dropzone') return [`upload:${businessMeaning}`];
    return [];
  }

  private fingerprint(node: RawDomElement, role: SemanticRole, meaning: string, parent?: string): string {
    const stable = JSON.stringify({ tag: node.tagName.toLowerCase(), role, meaning, parent, aria: node.attributes['aria-label'], placeholder: node.attributes.placeholder, type: node.attributes.type });
    let hash = 0;
    for (let index = 0; index < stable.length; index += 1) hash = (hash * 31 + stable.charCodeAt(index)) >>> 0;
    return hash.toString(16).padStart(8, '0');
  }
}
