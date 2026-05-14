import { AssertionResult, EvidenceObservation, EvidenceSignal, SemanticAssertion, confidence } from '../../shared-types/src/index.js';

export interface EvidenceProvider { observe(signal: EvidenceSignal): Promise<EvidenceObservation>; }

export class SemanticValidationEngine {
  constructor(private readonly evidenceProvider: EvidenceProvider) {}
  async validate(assertion: SemanticAssertion): Promise<AssertionResult> {
    const evidence = await Promise.all(assertion.evidenceSignals.map((signal) => this.evidenceProvider.observe(signal)));
    const weighted = evidence.reduce((sum, observation, index) => {
      const signal = assertion.evidenceSignals[index];
      return sum + (observation.matched && signal ? Number(signal.weight) * Number(observation.confidence) : 0);
    }, 0);
    const total = assertion.evidenceSignals.reduce((sum, signal) => sum + Number(signal.weight), 0) || 1;
    const score = confidence(Math.min(1, weighted / total));
    return { assertionId: assertion.id, passed: score >= assertion.requiredConfidence, confidence: score, evidence };
  }
}

export class StaticEvidenceProvider implements EvidenceProvider {
  constructor(private readonly observations: Readonly<Record<string, EvidenceObservation>>) {}
  async observe(signal: EvidenceSignal): Promise<EvidenceObservation> {
    return this.observations[signal.name] ?? { signalName: signal.name, matched: false, detail: 'signal unavailable', confidence: confidence(0) };
  }
}
