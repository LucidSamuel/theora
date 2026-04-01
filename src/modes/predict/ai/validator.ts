import type { AiPrediction } from '../types';
import type { DemoId } from '@/types';

/**
 * Validates an AI-generated prediction against logic.ts functions.
 *
 * This provides a safety layer: the AI's claimed correct answer is checked
 * against the actual demo logic before the user ever sees it.
 * Returns null if validation passes, or an error string if it fails.
 */
export function validateAiPrediction(prediction: AiPrediction, demoId: DemoId): string | null {
  // Structural validation
  if (prediction.choices.length !== 4) {
    return `Expected 4 choices, got ${prediction.choices.length}`;
  }
  if (prediction.correctIndex < 0 || prediction.correctIndex >= prediction.choices.length) {
    return `correctIndex ${prediction.correctIndex} is out of range [0, ${prediction.choices.length - 1}]`;
  }
  if (prediction.question.length < 10) {
    return 'Question is too short to be meaningful';
  }
  if (prediction.explanation.length < 10) {
    return 'Explanation is too short to be useful';
  }

  // Check that all choice labels are unique
  const labels = prediction.choices.map((c) => c.label.toLowerCase().trim());
  if (new Set(labels).size !== labels.length) {
    return 'Duplicate choice labels detected';
  }

  // Demo-specific validation where we can check against logic.ts
  const demoValidator = DEMO_VALIDATORS[demoId];
  if (demoValidator) {
    return demoValidator(prediction);
  }

  return null;
}

// Demo-specific validators that check AI claims against logic.ts
const DEMO_VALIDATORS: Partial<Record<DemoId, (p: AiPrediction) => string | null>> = {
  circuit: (prediction) => {
    // Check if the question mentions specific numeric values
    // that we can cross-reference with the circuit logic
    const questionLower = prediction.question.toLowerCase();
    if (questionLower.includes('x² + y') || questionLower.includes('x*x + y')) {
      // This is the standard circuit equation — make sure the explanation
      // doesn't claim a different formula
      const explLower = prediction.explanation.toLowerCase();
      if (explLower.includes('x² - y') || explLower.includes('x*x - y')) {
        return 'Explanation contradicts the circuit equation (z = x² + y, not x² - y)';
      }
    }
    return null;
  },

  'fiat-shamir': (prediction) => {
    const explLower = prediction.explanation.toLowerCase();
    // The Fiat-Shamir transform specifically hashes statement|publicKey|commitment
    // The broken version omits the commitment
    if (explLower.includes('broken') && explLower.includes('includes the commitment')) {
      return 'Broken FS specifically OMITS the commitment from the hash — explanation is incorrect';
    }
    return null;
  },

  merkle: (prediction) => {
    const explLower = prediction.explanation.toLowerCase();
    // Merkle proofs are O(log n), not O(n)
    if (explLower.includes('o(n)') && !explLower.includes('o(n log') && !explLower.includes('o(log n)')) {
      if (explLower.includes('proof size') || explLower.includes('proof length')) {
        return 'Merkle proofs are O(log n), not O(n)';
      }
    }
    return null;
  },
};
