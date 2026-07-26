import type { AttackScenario } from './types';

const BUGGY_SQUARE_SOURCE = `// f(x) = x² + x + 5 — or so the developer intended.
// Somewhere in here a constraint is missing.
input x
input t
public out

wire u = t + x + 5
assert u == out`;

export const EDITOR_AUTHOR_THE_BUG: AttackScenario = {
  id: 'author-the-bug',
  demoId: 'constraint-editor',
  title: 'Author the Bug, Then Exploit It',
  difficulty: 'intermediate',
  briefing: {
    goal: 'Ship an underconstrained circuit as its developer, then switch hats and exploit it as a prover.',
    adversarySees: [
      'The full circuit source (it is public)',
      'The analyzer output and constraint list',
      'The public output out',
    ],
    adversaryControls: [
      'Every witness value, including intermediates (the adversary IS the prover)',
      'As the developer in this exercise: the circuit source itself',
    ],
    adversaryCannotDo: [
      'Cheat once every wire is pinned by a constraint',
      'Change the circuit after deployment (only exploit what shipped)',
    ],
  },
  steps: [
    {
      id: 'sound-circuit',
      instruction: 'Start from the sound version: f(x) = x² + x + 5 with the square enforced by wire t = x * x. Check the Analysis panel.',
      demoAction: { type: 'LOAD_PRESET', payload: 'basic' },
      observation: 'The analyzer reports no unconstrained or weak wires. Every value is forced by the constraints — the witness is fully determined by x.',
      adversaryNarration: 'As a prover I have no freedom here. Every wire is pinned. Time to put on the developer hat and make a mistake.',
    },
    {
      id: 'ship-the-bug',
      instruction: 'You are the developer now. Replace "wire t = x * x" with "input t" — a one-line refactor that ships a critical bug. The honest witness still passes.',
      demoAction: {
        type: 'LOAD_SOURCE',
        payload: {
          source: BUGGY_SQUARE_SOURCE,
          inputs: { x: '7', t: '49', out: '61' },
        },
      },
      observation: 'All constraints still pass with the honest witness (t=49, out=61) — tests would be green. But the Analysis panel now flags t: nothing multiplies it, nothing binds it to x·x. The canvas draws it dashed orange.',
      adversaryNarration: 'The circuit still "works", so the bug survives code review. But t is now mine to choose.',
    },
    {
      id: 'prove-freedom',
      instruction: 'Run the exhaustive check. It enumerates every input assignment and asks: does each (x, out) pair have a unique witness?',
      demoAction: { type: 'RUN_EXHAUSTIVE' },
      observation: 'The checker reports the circuit is NOT input-determined: many different outputs are provable for the same x. That is the formal signature of an underconstrained circuit.',
      adversaryNarration: 'Confirmed. For x=7 I can prove any out I like by back-solving t = out − x − 5.',
    },
    {
      id: 'exploit',
      instruction: 'Switch hats: you are the prover. Load the exploit witness t=0, out=12 for x=7. The correct answer is 61.',
      demoAction: { type: 'LOAD_INPUTS', payload: { x: '7', t: '0', out: '12' } },
      observation: 'Every remaining constraint is satisfied: u = 0 + 7 + 5 = 12 = out. The verifier accepts a proof that f(7) = 12, which is false.',
      adversaryNarration: 'I just proved a false statement. The circuit only ever checked the addition — the square existed solely in the developer’s head.',
    },
    {
      id: 'lesson',
      instruction: 'The bug you authored is the most common class of real SNARK vulnerability. Fix it: change "input t" back to "wire t = x * x" and watch the analyzer flags clear.',
      observation: 'One line separated a sound circuit from a broken one, and no witness test caught it — only constraint-level analysis did.',
      adversaryNarration: 'Every intermediate value must be constrained, not just computed. If the circuit doesn’t check it, I get to choose it.',
    },
  ],
  conclusion: {
    succeeded: true,
    explanation:
      'You built an underconstrained circuit and exploited it. Removing the multiplication constraint left t free, so the prover could satisfy the remaining constraints while asserting a false output. Honest-witness testing cannot catch this class of bug — the honest witness always passes.',
    securityGuarantee:
      'Fix: every intermediate wire must be pinned by a constraint (wire t = x * x, not input t). The editor’s analyzer and exhaustive checker automate exactly the review that catches this: look for wires that never reach a multiplication and inputs that admit multiple valid witnesses.',
    realWorldExample:
      'The Zcash Sapling counterfeiting bug (CVE-2019-7167) was an underconstrained circuit. Chaliasos et al. (2024) found the large majority of audited SNARK circuit vulnerabilities are this same pattern.',
    furtherReading: 'Chaliasos et al., "SoK: What don’t we know? Understanding Security Vulnerabilities in SNARKs" (2024)',
  },
};
