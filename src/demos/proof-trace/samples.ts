/**
 * Bundled sample traces, built at module load from real demo logic so
 * they can never drift from the protocols they illustrate. Tests assert
 * that each sample validates and that its underlying run verifies.
 */

import { createPolynomial, computeHonestSum, runSumcheckProver, verifySumcheck } from '@/demos/sumcheck/logic';
import { friProtocol } from '@/demos/fri/logic';
import { parse } from '@/lib/dsl/parser';
import { compile } from '@/lib/dsl/compiler';
import { evaluateWitnessFromAST } from '@/lib/dsl/witness';
import { checkConstraints } from '@/lib/dsl/checker';
import { getDefaultCircuit } from '@/lib/dsl/defaults';
import type { ProofTrace, RoundMeta, TranscriptEvent } from './schema';
import { fromDslConstraints, normalizeTrace } from './schema';

export const SAMPLE_IDS = ['sumcheck-3var', 'fri-deg7', 'r1cs-square', 'r1cs-square-bad'] as const;
export type SampleId = (typeof SAMPLE_IDS)[number];

export function isSampleId(value: unknown): value is SampleId {
  return typeof value === 'string' && (SAMPLE_IDS as readonly string[]).includes(value);
}

export interface SampleInfo {
  id: SampleId;
  label: string;
  description: string;
  build: () => ProofTrace;
}

/* ── sumcheck ───────────────────────────────────────────────── */

function buildSumcheckSample(): ProofTrace {
  const fieldSize = 101n;
  const values = [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n];
  const challenges = [7n, 13n, 19n];
  const poly = createPolynomial(3, fieldSize, values);
  const claimedSum = computeHonestSum(poly);
  const rounds = runSumcheckProver(poly, claimedSum, challenges, fieldSize);
  const verdict = verifySumcheck(poly, claimedSum, rounds, challenges, fieldSize);

  const transcript: TranscriptEvent[] = [
    { t: 'absorb', round: 0, label: 'claimed sum', data: [claimedSum.toString()] },
  ];
  rounds.forEach((round, i) => {
    const r = i + 1;
    transcript.push({
      t: 'absorb',
      round: r,
      label: `g_${r} coefficients`,
      data: round.univariatePoly.map((c) => c.toString()),
    });
    transcript.push({ t: 'check', round: r, label: `g_${r}(0)+g_${r}(1) = expected`, ok: round.sumCheck });
    transcript.push({ t: 'challenge', round: r, label: `r_${r}`, data: [round.challenge!.toString()] });
  });
  const finalRound = rounds.length + 1;
  const lastRound = rounds[rounds.length - 1]!;
  transcript.push({
    t: 'query',
    round: finalRound,
    label: 'oracle f(r_1,r_2,r_3)',
    data: [lastRound.evalAtChallenge!.toString()],
  });
  transcript.push({ t: 'check', round: finalRound, label: 'final oracle check', ok: verdict.passed });

  return normalizeTrace({
    version: 1,
    meta: { system: 'theora', protocol: 'sumcheck', field: fieldSize.toString(), label: 'Sumcheck, 3 variables' },
    transcript,
  });
}

/* ── FRI ────────────────────────────────────────────────────── */

function buildFriSample(): ProofTrace {
  const p = 257n;
  const omega = 64n; // 3^(256/8) mod 257 — primitive 8th root of unity
  const coeffs = [3n, 1n, 4n, 1n, 5n, 9n, 2n, 6n]; // degree-7 polynomial
  const challenges = [11n, 23n, 5n];
  const queryIndices = [1, 5];
  const result = friProtocol(coeffs, omega, p, challenges, queryIndices);

  const transcript: TranscriptEvent[] = [];
  const rounds: RoundMeta[] = [];
  result.commitPhase.layers.forEach((layer, i) => {
    rounds.push({
      round: i,
      label: i === 0 ? 'initial codeword' : `fold ${i}`,
      stats: { domainSize: layer.domain.length.toString(), degreeBound: layer.degree.toString() },
    });
    if (layer.challenge !== null) {
      transcript.push({ t: 'challenge', round: i, label: `alpha_${i}`, data: [layer.challenge.toString()] });
      transcript.push({
        t: 'fold',
        round: i,
        label: `layer ${i} folded evaluations`,
        data: layer.evaluations.map((v) => v.toString()),
      });
    }
    transcript.push({
      t: 'commit',
      round: i,
      label: i === 0 ? 'commit initial codeword' : `commit layer ${i}`,
      data: [layer.evaluations.length.toString()],
    });
  });
  const queryRound = result.commitPhase.layers.length;
  result.queries.forEach((query) => {
    transcript.push({
      t: 'query',
      round: queryRound,
      label: `query index ${query.queryIndex}`,
      data: query.layerValues.map((lv) => lv.value.toString()),
    });
    transcript.push({
      t: 'check',
      round: queryRound,
      label: `fold consistency at index ${query.queryIndex}`,
      ok: query.layerValues.every((lv) => lv.consistent),
    });
  });
  transcript.push({ t: 'check', round: queryRound, label: 'final layer constant', ok: result.accepted });

  return normalizeTrace({
    version: 1,
    meta: { system: 'theora', protocol: 'fri', field: p.toString(), label: 'FRI, degree 7 over GF(257)' },
    transcript,
    rounds,
  });
}

/* ── R1CS from the constraint DSL ───────────────────────────── */

function buildR1csSample(corrupt: boolean): ProofTrace {
  const circuit = getDefaultCircuit('basic');
  if (!circuit) throw new Error('missing basic default circuit');
  const fieldSize = 101n;
  const parsed = parse(circuit.source);
  const compilation = compile(parsed.ast, fieldSize);
  const inputs = new Map<string, bigint>(
    Object.entries(circuit.defaultInputs).map(([name, value]) => [name, BigInt(value)]),
  );
  const witness = evaluateWitnessFromAST(compilation, parsed.ast, inputs);
  if (corrupt) {
    // Corrupt the first intermediate wire value: a dishonest prover.
    const intermediate = compilation.wires.find((w) => w.type === 'intermediate');
    if (intermediate) {
      witness.values.set(intermediate.id, (witness.values.get(intermediate.id)! + 1n) % fieldSize);
    }
  }
  const check = checkConstraints(compilation, witness);

  const transcript: TranscriptEvent[] = [
    {
      t: 'absorb',
      round: 0,
      label: 'public inputs',
      data: compilation.publicWires.map((w) => (witness.values.get(w.id) ?? 0n).toString()),
    },
  ];
  check.checks.forEach((result) => {
    transcript.push({
      t: 'check',
      round: 1,
      label: result.sourceExpr,
      ok: result.satisfied,
    });
  });

  return normalizeTrace({
    version: 1,
    meta: {
      system: 'theora',
      protocol: 'r1cs',
      field: fieldSize.toString(),
      label: corrupt ? 'R1CS x²+x+5 (corrupted witness)' : 'R1CS x²+x+5',
    },
    transcript,
    constraints: fromDslConstraints(compilation, check, witness),
  });
}

/* ── registry ───────────────────────────────────────────────── */

export const SAMPLES: Record<SampleId, SampleInfo> = {
  'sumcheck-3var': {
    id: 'sumcheck-3var',
    label: 'Sumcheck · 3 vars',
    description: 'Honest sumcheck run over GF(101): per-round polynomials, checks, and challenges.',
    build: buildSumcheckSample,
  },
  'fri-deg7': {
    id: 'fri-deg7',
    label: 'FRI · degree 7',
    description: 'FRI commit + query phases for a degree-7 polynomial over GF(257).',
    build: buildFriSample,
  },
  'r1cs-square': {
    id: 'r1cs-square',
    label: 'R1CS · x²+x+5',
    description: 'Constraint check of the basic DSL circuit with an honest witness.',
    build: () => buildR1csSample(false),
  },
  'r1cs-square-bad': {
    id: 'r1cs-square-bad',
    label: 'R1CS · corrupted',
    description: 'Same circuit with a corrupted witness — failed checks change the fingerprint.',
    build: () => buildR1csSample(true),
  },
};

export const DEFAULT_SAMPLE_ID: SampleId = 'sumcheck-3var';

export function buildSample(id: SampleId): ProofTrace {
  return SAMPLES[id].build();
}
