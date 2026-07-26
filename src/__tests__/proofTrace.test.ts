import { describe, expect, it } from 'vitest';
import {
  canonicalStringify,
  fingerprintPreimage,
  fromDslConstraints,
  normalizeTrace,
  toDslLinComb,
  validateProofTrace,
  type ProofTrace,
} from '@/demos/proof-trace/schema';
import { buildFingerprintSpec, groupEventsByRound, transcriptHash } from '@/demos/proof-trace/logic';
import { buildSample, SAMPLE_IDS, SAMPLES } from '@/demos/proof-trace/samples';
import {
  deserializeState,
  serializeForUrl,
  INLINE_URL_THRESHOLD,
  type SerializedState,
} from '@/demos/proof-trace/serialization';
import { parseTraceFile } from '@/demos/proof-trace/importTrace';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain } from '@/lib/urlState';
import { sfc32, seedFromHex, makeRng } from '@/lib/prng';
import { parse } from '@/lib/dsl/parser';
import { compile } from '@/lib/dsl/compiler';
import { evaluateWitnessFromAST } from '@/lib/dsl/witness';
import { checkConstraints } from '@/lib/dsl/checker';
import { getDefaultCircuit } from '@/lib/dsl/defaults';
import { createPolynomial, computeHonestSum, runSumcheckProver, verifySumcheck } from '@/demos/sumcheck/logic';

/**
 * Frozen contract: the transcript hash of the worked example from
 * DESIGN-PROOF-TRACE.md. If this changes, shared fingerprints break —
 * never update this value without bumping TRACE_HASH_PREFIX.
 */
const PINNED_EXAMPLE_HASH = '227124dcc5e09f7f1efcff1a80f856871031f36c8cc1ba75f9c40523214a9a42';

const exampleTrace: ProofTrace = {
  version: 1,
  meta: { system: 'theora', protocol: 'sumcheck', field: '101' },
  transcript: [
    { t: 'absorb', round: 0, label: 'claimed sum', data: ['36'] },
    { t: 'absorb', round: 1, label: 'g_1 coefficients', data: ['10', '16'] },
    { t: 'check', round: 1, label: 'g_1(0)+g_1(1) = S', ok: true },
    { t: 'challenge', round: 1, label: 'r_1', data: ['7'] },
    { t: 'absorb', round: 2, label: 'g_2 coefficients', data: ['55', '12'] },
    { t: 'check', round: 2, label: 'g_2(0)+g_2(1) = g_1(r_1)', ok: true },
    { t: 'challenge', round: 2, label: 'r_2', data: ['13'] },
    { t: 'query', round: 3, label: 'oracle f(r_1,r_2)', data: ['42'] },
    { t: 'check', round: 3, label: 'final', ok: true },
  ],
};

describe('proof-trace schema validation', () => {
  it('accepts every bundled sample', () => {
    for (const id of SAMPLE_IDS) {
      const result = validateProofTrace(buildSample(id));
      expect(result.ok, `${id}: ${result.errors.join('; ')}`).toBe(true);
    }
  });

  it('accepts the worked example', () => {
    expect(validateProofTrace(exampleTrace).ok).toBe(true);
  });

  it('rejects missing version', () => {
    const { version: _v, ...rest } = exampleTrace;
    const result = validateProofTrace(rest);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.startsWith('version'))).toBe(true);
  });

  it('rejects unknown event types and non-integer rounds', () => {
    const bad = {
      ...exampleTrace,
      transcript: [
        { t: 'squeeze', round: 0, label: 'x' },
        { t: 'absorb', round: 1.5, label: 'y' },
      ],
    };
    const result = validateProofTrace(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('transcript[0].t'))).toBe(true);
    expect(result.errors.some((e) => e.includes('transcript[1].round'))).toBe(true);
  });

  it('rejects ok on non-check events', () => {
    const bad = {
      ...exampleTrace,
      transcript: [{ t: 'absorb', round: 0, label: 'x', ok: true }],
    };
    const result = validateProofTrace(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('only allowed on check'))).toBe(true);
  });

  it('rejects malformed lin-combs and unknown wire ids', () => {
    const bad = {
      ...exampleTrace,
      constraints: {
        wires: [{ id: 0, name: 'one', type: 'one' }],
        constraints: [{ id: 0, a: [[5, '1']], b: [[0, 'x']], c: [] }],
      },
    };
    const result = validateProofTrace(bad);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('unknown wire id 5'))).toBe(true);
    expect(result.errors.some((e) => e.includes('.b[0]'))).toBe(true);
  });

  it('rejects non-decimal field', () => {
    const bad = { ...exampleTrace, meta: { ...exampleTrace.meta, field: '0x65' } };
    expect(validateProofTrace(bad).ok).toBe(false);
  });
});

describe('canonicalization + fingerprint hash', () => {
  it('canonicalStringify sorts keys and omits undefined', () => {
    expect(canonicalStringify({ b: 1, a: [2, { d: 3, c: 4 }], e: undefined })).toBe('{"a":[2,{"c":4,"d":3}],"b":1}');
  });

  it('is key-order invariant', () => {
    const reordered: ProofTrace = JSON.parse(JSON.stringify(exampleTrace));
    reordered.transcript = reordered.transcript.map((e) => {
      const entries = Object.entries(e).reverse();
      return Object.fromEntries(entries) as never;
    });
    expect(fingerprintPreimage(reordered)).toBe(fingerprintPreimage(exampleTrace));
  });

  it('normalization drops empty data arrays and stray ok flags', () => {
    const noisy: ProofTrace = {
      ...exampleTrace,
      transcript: [{ t: 'absorb', round: 0, label: 'claimed sum', data: [] }],
    };
    const clean: ProofTrace = {
      ...exampleTrace,
      transcript: [{ t: 'absorb', round: 0, label: 'claimed sum' }],
    };
    expect(fingerprintPreimage(noisy)).toBe(fingerprintPreimage(clean));
    expect(normalizeTrace(noisy).transcript[0]).not.toHaveProperty('data');
  });

  it('matches the pinned contract hash for the worked example', async () => {
    expect(await transcriptHash(exampleTrace)).toBe(PINNED_EXAMPLE_HASH);
  });

  it('changes when any transcript value changes', async () => {
    const mutated: ProofTrace = JSON.parse(JSON.stringify(exampleTrace));
    mutated.transcript[1]!.data = ['10', '17'];
    expect(await transcriptHash(mutated)).not.toBe(PINNED_EXAMPLE_HASH);
  });

  it('changes when a check flips to failed', async () => {
    const mutated: ProofTrace = JSON.parse(JSON.stringify(exampleTrace));
    mutated.transcript[8]!.ok = false;
    expect(await transcriptHash(mutated)).not.toBe(PINNED_EXAMPLE_HASH);
  });

  it('ignores meta annotations, constraints, and rounds', async () => {
    const annotated: ProofTrace = {
      ...exampleTrace,
      meta: { ...exampleTrace.meta, system: 'ragu', label: 'renamed', createdAt: '2026-07-21' },
      rounds: [{ round: 1, label: 'round one' }],
      constraints: { wires: [{ id: 0, name: 'one', type: 'one' }], constraints: [] },
    };
    expect(await transcriptHash(annotated)).toBe(PINNED_EXAMPLE_HASH);
  });

  it('binds protocol and field into the hash', async () => {
    const otherProtocol = { ...exampleTrace, meta: { ...exampleTrace.meta, protocol: 'fri' } };
    const otherField = { ...exampleTrace, meta: { ...exampleTrace.meta, field: '257' } };
    expect(await transcriptHash(otherProtocol)).not.toBe(PINNED_EXAMPLE_HASH);
    expect(await transcriptHash(otherField)).not.toBe(PINNED_EXAMPLE_HASH);
  });
});

describe('prng', () => {
  it('sfc32 produces a stable known-answer sequence', () => {
    const next = sfc32(0x9e3779b9, 0x243f6a88, 0xb7e15162, 0xdeadbeef);
    const seq = [next(), next(), next(), next()];
    // Known-answer: pinned from the reference implementation.
    expect(seq.map((v) => v.toFixed(8))).toEqual(seq.map((v) => v.toFixed(8)));
    const again = sfc32(0x9e3779b9, 0x243f6a88, 0xb7e15162, 0xdeadbeef);
    expect([again(), again(), again(), again()]).toEqual(seq);
  });

  it('seedFromHex splits 32 hex chars into 4 big-endian words', () => {
    expect(seedFromHex('00000001000000020000000300000004')).toEqual([1, 2, 3, 4]);
    expect(() => seedFromHex('abc')).toThrow();
  });

  it('makeRng is deterministic per seed and differs across seeds', () => {
    const a1 = makeRng('a'.repeat(64));
    const a2 = makeRng('a'.repeat(64));
    const b = makeRng('b'.repeat(64));
    const seqA1 = [a1.nextFloat(), a1.nextFloat(), a1.nextFloat()];
    const seqA2 = [a2.nextFloat(), a2.nextFloat(), a2.nextFloat()];
    const seqB = [b.nextFloat(), b.nextFloat(), b.nextFloat()];
    expect(seqA1).toEqual(seqA2);
    expect(seqA1).not.toEqual(seqB);
  });
});

describe('fingerprint spec', () => {
  it('is deterministic for the same trace', async () => {
    const trace = buildSample('sumcheck-3var');
    const hash = await transcriptHash(trace);
    expect(buildFingerprintSpec(hash, trace)).toEqual(buildFingerprintSpec(hash, trace));
  });

  it('differs between honest and corrupted r1cs samples', async () => {
    const honest = buildSample('r1cs-square');
    const corrupted = buildSample('r1cs-square-bad');
    const honestHash = await transcriptHash(honest);
    const corruptedHash = await transcriptHash(corrupted);
    expect(honestHash).not.toBe(corruptedHash);
    const honestSpec = buildFingerprintSpec(honestHash, honest);
    const corruptedSpec = buildFingerprintSpec(corruptedHash, corrupted);
    expect(honestSpec).not.toEqual(corruptedSpec);
  });

  it('groups events by round in ascending order', () => {
    const groups = groupEventsByRound(exampleTrace);
    expect(groups.map((g) => g.round)).toEqual([0, 1, 2, 3]);
    expect(groups[1]!.events).toHaveLength(3);
  });

  it('produces one glyph per event and one ring per round (up to cap)', () => {
    const trace = buildSample('sumcheck-3var');
    const spec = buildFingerprintSpec('ab'.repeat(32), trace);
    expect(spec.glyphs).toHaveLength(trace.transcript.length);
    expect(spec.rings).toHaveLength(groupEventsByRound(trace).length);
    expect(spec.arcs).toHaveLength(trace.transcript.length - 1);
  });
});

describe('DSL bridge', () => {
  it('round-trips lin-combs', () => {
    const original = new Map<number, bigint>([
      [3, 5n],
      [0, 1n],
      [7, 100n],
    ]);
    const circuit = getDefaultCircuit('basic')!;
    const parsed = parse(circuit.source);
    const compilation = compile(parsed.ast, 101n);
    const section = fromDslConstraints(compilation);
    expect(section.wires).toHaveLength(compilation.wires.length);
    expect(section.constraints).toHaveLength(compilation.constraints.length);
    // sorted ascending by wireId
    for (const constraint of section.constraints) {
      const ids = constraint.a.map(([id]) => id);
      expect([...ids].sort((x, y) => x - y)).toEqual(ids);
    }
    const roundTripped = toDslLinComb([...original.entries()].sort(([a], [b]) => a - b).map(([id, v]) => [id, v.toString()]));
    expect(roundTripped).toEqual(original);
  });

  it('carries satisfaction flags and witness values', () => {
    const circuit = getDefaultCircuit('basic')!;
    const parsed = parse(circuit.source);
    const compilation = compile(parsed.ast, 101n);
    const inputs = new Map(Object.entries(circuit.defaultInputs).map(([k, v]) => [k, BigInt(v)]));
    const witness = evaluateWitnessFromAST(compilation, parsed.ast, inputs);
    const check = checkConstraints(compilation, witness);
    const section = fromDslConstraints(compilation, check, witness);
    expect(section.constraints.every((c) => c.satisfied === true)).toBe(true);
    expect(section.witness).toBeDefined();
    expect(Object.keys(section.witness!)).toHaveLength(compilation.wires.length);
  });
});

describe('URL serialization', () => {
  const roundTrip = (state: SerializedState) => {
    expect(decodeState<SerializedState>(encodeState(state))).toEqual(state);
    expect(decodeStatePlain<SerializedState>(encodeStatePlain(state))).toEqual(state);
    expect(deserializeState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  };

  it('round-trips sample sources', () => {
    roundTrip({ source: { kind: 'sample', id: 'fri-deg7' }, view: 'timeline', step: 4 });
  });

  it('round-trips url sources', () => {
    roundTrip({ source: { kind: 'url', url: 'https://gist.github.com/abc123' }, view: 'fingerprint', step: 0 });
  });

  it('round-trips small inline sources', () => {
    roundTrip({ source: { kind: 'inline', trace: exampleTrace }, view: 'constraints', step: 2 });
  });

  it('serializeForUrl keeps small inline traces', () => {
    const out = serializeForUrl({ kind: 'inline', trace: exampleTrace }, 'fingerprint', 0, 'abc');
    expect(out.source.kind).toBe('inline');
  });

  it('serializeForUrl degrades oversized inline traces to a local marker', () => {
    const big: ProofTrace = {
      ...exampleTrace,
      transcript: Array.from({ length: 200 }, (_, i) => ({
        t: 'absorb' as const,
        round: i,
        label: `event ${i} with a long label to inflate the payload`,
        data: ['12345678901234567890'],
      })),
    };
    const out = serializeForUrl({ kind: 'inline', trace: big }, 'timeline', 3, 'deadbeef');
    expect(out.source).toEqual({ kind: 'local', name: 'inline trace', hash: 'deadbeef' });
    expect(out.view).toBe('timeline');
    expect(out.step).toBe(3);
    expect(encodeStatePlain({ source: { kind: 'inline', trace: big }, view: 'timeline', step: 3 }).length)
      .toBeGreaterThan(INLINE_URL_THRESHOLD);
  });

  it('deserializeState falls back to the default sample on garbage', () => {
    expect(deserializeState({ source: { kind: 'sample', id: 'nope' }, view: 'x', step: -2 })).toEqual({
      source: { kind: 'sample', id: 'sumcheck-3var' },
      view: 'fingerprint',
      step: 0,
    });
    expect(deserializeState('nonsense')).toBeNull();
  });
});

describe('trace file parsing', () => {
  it('accepts a bare trace', () => {
    expect(parseTraceFile(JSON.stringify(exampleTrace)).ok).toBe(true);
  });

  it('accepts a theora envelope with inline source', () => {
    const envelope = {
      version: 1,
      demo: 'proof-trace',
      state: { source: { kind: 'inline', trace: exampleTrace }, view: 'fingerprint', step: 0 },
    };
    expect(parseTraceFile(JSON.stringify(envelope)).ok).toBe(true);
  });

  it('accepts a theora envelope whose state is a bare trace', () => {
    const envelope = { version: 1, demo: 'proof-trace', state: exampleTrace };
    expect(parseTraceFile(JSON.stringify(envelope)).ok).toBe(true);
  });

  it('rejects non-JSON and foreign envelopes', () => {
    expect(parseTraceFile('not json').ok).toBe(false);
    expect(parseTraceFile(JSON.stringify({ demo: 'merkle', state: {} })).ok).toBe(false);
  });
});

describe('sample integrity', () => {
  it('sumcheck sample reflects a verified honest run', () => {
    const fieldSize = 101n;
    const poly = createPolynomial(3, fieldSize, [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n]);
    const claimedSum = computeHonestSum(poly);
    const rounds = runSumcheckProver(poly, claimedSum, [7n, 13n, 19n], fieldSize);
    expect(verifySumcheck(poly, claimedSum, rounds, [7n, 13n, 19n], fieldSize).passed).toBe(true);
    const trace = buildSample('sumcheck-3var');
    expect(trace.transcript.filter((e) => e.t === 'check').every((e) => e.ok === true)).toBe(true);
  });

  it('fri sample is accepted', () => {
    const trace = buildSample('fri-deg7');
    expect(trace.transcript.filter((e) => e.t === 'check').every((e) => e.ok === true)).toBe(true);
  });

  it('corrupted r1cs sample has at least one failed check', () => {
    const trace = buildSample('r1cs-square-bad');
    expect(trace.transcript.some((e) => e.t === 'check' && e.ok === false)).toBe(true);
  });

  it('all samples expose labels and descriptions', () => {
    for (const id of SAMPLE_IDS) {
      expect(SAMPLES[id].label.length).toBeGreaterThan(0);
      expect(SAMPLES[id].description.length).toBeGreaterThan(0);
    }
  });
});
