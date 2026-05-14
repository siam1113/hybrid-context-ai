import { SemanticUIMap, confidence } from '../../../packages/shared-types/src/index.js';
import { RawDomElement, SemanticDomProcessor } from '../../../packages/dom-processor/src/index.js';
import { InMemorySemanticIndex } from '../../../packages/semantic-engine/src/index.js';

export interface CompilerJob { readonly applicationId: string; readonly pageId: string; readonly urlPattern: string; readonly root: RawDomElement; readonly vocabulary: Readonly<Record<string, string>>; }

export class ContextCompilerService {
  constructor(private readonly processor: SemanticDomProcessor, private readonly semanticIndex: InMemorySemanticIndex) {}
  async compile(job: CompilerJob): Promise<SemanticUIMap> {
    const elements = this.processor.process(job.root, { applicationVocabulary: job.vocabulary, minConfidence: confidence(0.35) });
    const map: SemanticUIMap = { applicationId: job.applicationId, pageId: job.pageId, urlPattern: job.urlPattern, extractedAt: new Date().toISOString(), elements, componentGraph: [] };
    this.semanticIndex.upsert(map);
    return map;
  }
}
