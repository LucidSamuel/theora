import type { AiChallengeRequest, PredictDifficulty } from '../types';

const SYSTEM_PROMPT = `You are an expert cryptography educator generating prediction challenges for Theora, an interactive cryptography visualizer.

Your job is to create a multiple-choice prediction question based on the current demo state. The question should test the user's understanding of the cryptographic primitive being visualized.

Rules:
- Exactly 4 choices, one correct
- Each choice needs a short rationale explaining why it's right or wrong
- Target specific misconceptions when possible
- Match the requested difficulty level
- Refer to concrete values from the demo state when relevant
- Keep questions focused on "what happens next" or "what would change if..."

Respond with ONLY valid JSON matching this schema:
{
  "question": "string",
  "choices": [
    { "label": "string", "rationale": "string" },
    { "label": "string", "rationale": "string" },
    { "label": "string", "rationale": "string" },
    { "label": "string", "rationale": "string" }
  ],
  "correctIndex": 0,
  "explanation": "string",
  "targetMisconception": "string or null"
}`;

const DIFFICULTY_GUIDANCE: Record<PredictDifficulty, string> = {
  beginner: 'Ask about basic properties — what a hash looks like, whether changing an input changes the output, simple cause-and-effect.',
  intermediate: 'Ask about security properties — why a particular design choice matters, what an attacker could exploit, how components relate.',
  advanced: 'Ask about subtle edge cases — soundness vs completeness tradeoffs, specific attack vectors, algebraic relationships between values.',
};

const DEMO_CONTEXT: Record<string, string> = {
  merkle: 'Merkle tree: binary hash tree where each parent is H(left || right). Changing any leaf changes the root. Proofs are O(log n) sibling hashes.',
  polynomial: 'Polynomial commitments (KZG): commit to p(x) via hash, open at challenge point z, verifier checks p(z) matches. Binding and hiding.',
  circuit: 'R1CS circuits: witness (x, y, z, t) must satisfy A·w ⊙ B·w = C·w for each constraint row. Underconstrained = missing row = exploitable.',
  'fiat-shamir': 'Fiat-Shamir transform: replace interactive verifier with hash of transcript. Broken FS omits commitment from hash → challenge is predictable → forgery.',
  pipeline: 'Proof pipeline: witness → constraints → polynomial → commit → challenge → open → verify. Fault in any stage propagates downstream.',
  accumulator: 'RSA accumulator: set membership via modular exponentiation. Witnesses must be refreshed after set mutations.',
  recursive: 'Recursive proofs: verify a proof inside another proof. IVC chains fold proofs incrementally. Bad proof at leaf propagates up.',
  elliptic: 'Elliptic curves over finite fields: point addition, scalar multiplication, ECDLP hardness. Pasta curves for recursive SNARKs.',
  lookup: 'Lookup arguments: multiset equality check between wire values and table entries. Missing entry → mismatch → proof fails.',
  pedersen: 'Pedersen commitments: C = g^v · h^r mod p. Perfectly hiding (information-theoretic), computationally binding. Homomorphic addition.',
  groth16: 'Groth16: R1CS → QAP → trusted setup → prove → verify via pairings. Toxic waste leak breaks soundness.',
  plonk: 'PLONK: gate equations qL·a + qR·b + qO·c + qM·a·b + qC = 0, plus copy constraints for wire equality.',
};

export function buildPrompt(request: AiChallengeRequest): { system: string; user: string } {
  const demoCtx = DEMO_CONTEXT[request.demoId] ?? `Demo: ${request.demoId}`;
  const accuracyPct = request.accuracy.total > 0
    ? Math.round((request.accuracy.correct / request.accuracy.total) * 100)
    : null;

  const userParts: string[] = [
    `Demo: ${request.demoId}`,
    `Context: ${demoCtx}`,
    `Difficulty: ${request.difficulty}`,
    DIFFICULTY_GUIDANCE[request.difficulty],
    '',
    `Current demo state: ${JSON.stringify(request.demoState, null, 2)}`,
  ];

  if (accuracyPct !== null) {
    userParts.push(`User accuracy so far: ${accuracyPct}% (${request.accuracy.correct}/${request.accuracy.total})`);
  }

  if (request.accuracy.streak < -2) {
    userParts.push('User is on a losing streak — consider an easier question to rebuild confidence.');
  } else if (request.accuracy.streak > 3) {
    userParts.push('User is on a winning streak — consider increasing difficulty within the requested tier.');
  }

  if (request.targetMisconception) {
    userParts.push(`Target this specific misconception: ${request.targetMisconception}`);
  }

  // Weak categories
  const weakCategories = Object.entries(request.accuracy.byCategory)
    .filter(([, v]) => v.total >= 3 && (v.correct / v.total) < 0.5)
    .map(([cat]) => cat);
  if (weakCategories.length > 0) {
    userParts.push(`User struggles with: ${weakCategories.join(', ')}`);
  }

  return {
    system: SYSTEM_PROMPT,
    user: userParts.join('\n'),
  };
}
