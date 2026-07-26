import { describe, expect, it } from 'vitest';
import {
  evaluateCircuit,
  serializeDocument,
  deserializeDocument,
  exportTrace,
  type CircuitDocumentV1,
  type EditorDocumentState,
} from '@/demos/constraint-editor/logic';
import { EDITOR_PRESETS, BUGGY_PRESET_IDS, getEditorPreset, getPresetIdForSource } from '@/demos/constraint-editor/presets';
import { validateProofTrace } from '@/demos/proof-trace/schema';
import { decodeState, decodeStatePlain, encodeState, encodeStatePlain } from '@/lib/urlState';
import { hasAttackScenario, getScenarioForDemo } from '@/modes/attack/scenarios';
import { EDITOR_AUTHOR_THE_BUG } from '@/modes/attack/scenarios/constraint-editor';

function presetInputs(id: string): Map<string, bigint> {
  const preset = getEditorPreset(id)!;
  return new Map(Object.entries(preset.defaultInputs).map(([k, v]) => [k, BigInt(v)]));
}

describe('editor presets', () => {
  it('registry is non-empty, unique, and resolvable', () => {
    const ids = EDITOR_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('basic');
    expect(ids).toContain('xor');
    expect(ids).toContain('buggy-missing-bit');
    for (const id of ids) {
      expect(getEditorPreset(id)?.id).toBe(id);
      expect(getPresetIdForSource(getEditorPreset(id)!.source)).toBe(id);
    }
    expect(getPresetIdForSource('input z')).toBe('custom');
  });

  for (const preset of EDITOR_PRESETS) {
    it(`${preset.id}: parses, compiles, and satisfies with default inputs`, () => {
      const pipeline = evaluateCircuit(preset.source, 101n, presetInputs(preset.id));
      expect(pipeline.parseResult.success, JSON.stringify(pipeline.parseResult.errors)).toBe(true);
      expect(pipeline.compilation?.success, JSON.stringify(pipeline.compilation?.errors)).toBe(true);
      expect(pipeline.witness?.success).toBe(true);
      expect(pipeline.checks?.allSatisfied).toBe(true);
      expect(pipeline.layout).not.toBeNull();
    });
  }

  it('buggy presets are flagged by the analyzer; sound multiplicative ones are not', () => {
    for (const preset of EDITOR_PRESETS) {
      const pipeline = evaluateCircuit(preset.source, 101n, presetInputs(preset.id));
      const flaggedNames = [
        ...(pipeline.analysis?.unconstrainedWires ?? []),
        ...(pipeline.analysis?.weakInputWires ?? []),
      ].map((w) => w.name);
      if (BUGGY_PRESET_IDS.has(preset.id)) {
        expect(flaggedNames.length, `${preset.id} should be flagged`).toBeGreaterThan(0);
      }
    }
    const buggyRange = evaluateCircuit(getEditorPreset('buggy-missing-bit')!.source, 101n, presetInputs('buggy-missing-bit'));
    expect(buggyRange.analysis?.weakInputWires.map((w) => w.name)).toContain('b2');
    const soundRange = evaluateCircuit(getEditorPreset('range3')!.source, 101n, presetInputs('range3'));
    expect(soundRange.analysis?.weakInputWires).toHaveLength(0);
    expect(soundRange.analysis?.unconstrainedWires).toHaveLength(0);
  });

  it('buggy range check accepts an out-of-range value the sound one rejects', () => {
    const outOfRange = new Map<string, bigint>([['b0', 0n], ['b1', 0n], ['b2', 10n], ['x', 40n]]);
    const buggy = evaluateCircuit(getEditorPreset('buggy-missing-bit')!.source, 101n, outOfRange);
    expect(buggy.checks?.allSatisfied).toBe(true); // 40 "proved" to be < 8
    const sound = evaluateCircuit(getEditorPreset('range3')!.source, 101n, outOfRange);
    expect(sound.checks?.allSatisfied).toBe(false);
  });
});

describe('CircuitDocumentV1 serialization', () => {
  const docState: EditorDocumentState = {
    source: '// π unicode | pipe\ninput x\npublic out\nwire t = x * x\nassert t == out',
    fieldSize: 97n,
    inputs: new Map([['x', 3n], ['out', 9n]]),
    presetId: 'custom',
    selectedWire: 2,
    selectedConstraint: null,
  };

  it('round-trips through encodeState/decodeState', () => {
    const doc = serializeDocument(docState);
    const decoded = decodeState<CircuitDocumentV1>(encodeState(doc));
    expect(decoded).toEqual(doc);
    const restored = deserializeDocument(decoded);
    expect(restored?.source).toBe(docState.source);
    expect(restored?.fieldSize).toBe(97n);
    expect(restored?.inputs).toEqual(docState.inputs);
    expect(restored?.selectedWire).toBe(2);
    expect(restored?.selectedConstraint).toBeNull();
  });

  it('round-trips through encodeStatePlain/decodeStatePlain (hash state, incl. | in source)', () => {
    const doc = serializeDocument(docState);
    const encoded = encodeStatePlain(doc);
    expect(encoded).not.toContain('|');
    const decoded = decodeStatePlain<CircuitDocumentV1>(encoded);
    expect(decoded).toEqual(doc);
  });

  it('omits presetId for custom and view when nothing selected', () => {
    const doc = serializeDocument({ ...docState, selectedWire: null });
    expect(doc.presetId).toBeUndefined();
    expect(doc.view).toBeUndefined();
    const preset = serializeDocument({ ...docState, presetId: 'basic' });
    expect(preset.presetId).toBe('basic');
  });

  it('rejects garbage, bad versions, and clamps the field', () => {
    expect(deserializeDocument(null)).toBeNull();
    expect(deserializeDocument('nope')).toBeNull();
    expect(deserializeDocument([1, 2])).toBeNull();
    expect(deserializeDocument({ v: 2, source: 'input x' })).toBeNull();
    expect(deserializeDocument({ v: 1 })).toBeNull();
    const clamped = deserializeDocument({ v: 1, source: 'input x', field: '123456789' });
    expect(clamped?.fieldSize).toBe(101n);
    const bad = deserializeDocument({ v: 1, source: 'input x', field: 'abc', inputs: { x: 'not-a-number', y: '5' } });
    expect(bad?.fieldSize).toBe(101n);
    expect(bad?.inputs).toEqual(new Map([['y', 5n]]));
  });
});

describe('exportTrace', () => {
  it('emits a valid proof trace for a satisfied circuit', () => {
    const preset = getEditorPreset('basic')!;
    const pipeline = evaluateCircuit(preset.source, 101n, presetInputs('basic'));
    const audit = exportTrace(pipeline, 101n);
    expect(audit.demo).toBe('constraint-editor');
    expect(audit.analysis?.allSatisfied).toBe(true);
    expect(audit.trace).not.toBeNull();
    const validation = validateProofTrace(audit.trace);
    expect(validation.ok, validation.errors.join('; ')).toBe(true);
    const checkEvents = audit.trace!.transcript.filter((e) => e.t === 'check');
    expect(checkEvents).toHaveLength(pipeline.compilation!.constraints.length);
    expect(checkEvents.every((e) => e.ok === true)).toBe(true);
    expect(audit.trace!.constraints?.witness).toBeDefined();
    expect(JSON.stringify(audit)).toBeTypeOf('string');
  });

  it('reflects failed checks for a bad witness', () => {
    const preset = getEditorPreset('basic')!;
    const pipeline = evaluateCircuit(preset.source, 101n, new Map([['x', 7n], ['out', 60n]]));
    const audit = exportTrace(pipeline, 101n);
    expect(audit.analysis?.allSatisfied).toBe(false);
    expect(audit.trace!.transcript.some((e) => e.t === 'check' && e.ok === false)).toBe(true);
    expect(validateProofTrace(audit.trace).ok).toBe(true);
  });

  it('returns a null trace when the source does not compile', () => {
    const audit = exportTrace(evaluateCircuit('wire z = ', 101n, new Map()), 101n);
    expect(audit.trace).toBeNull();
  });
});

describe('author-the-bug attack scenario', () => {
  const HANDLED_ACTIONS = new Set(['LOAD_PRESET', 'LOAD_SOURCE', 'LOAD_INPUTS', 'RUN_EXHAUSTIVE', 'RESET']);

  it('is registered for the constraint-editor demo', () => {
    expect(hasAttackScenario('constraint-editor')).toBe(true);
    expect(getScenarioForDemo('constraint-editor')?.id).toBe('author-the-bug');
  });

  it('only uses demo actions the demo handles, with no consecutive duplicates', () => {
    let prevKey: string | null = null;
    for (const step of EDITOR_AUTHOR_THE_BUG.steps) {
      if (!step.demoAction) continue;
      expect(HANDLED_ACTIONS.has(step.demoAction.type), step.demoAction.type).toBe(true);
      const key = `${step.demoAction.type}:${JSON.stringify(step.demoAction.payload ?? null)}`;
      expect(key).not.toBe(prevKey);
      prevKey = key;
    }
  });

  it('honest witness passes on the shipped buggy circuit, and the exploit proves a false statement', () => {
    const shipStep = EDITOR_AUTHOR_THE_BUG.steps.find((s) => s.id === 'ship-the-bug')!;
    const payload = shipStep.demoAction!.payload as { source: string; inputs: Record<string, string> };
    const honestInputs = new Map(Object.entries(payload.inputs).map(([k, v]) => [k, BigInt(v)]));
    const honest = evaluateCircuit(payload.source, 101n, honestInputs);
    expect(honest.checks?.allSatisfied).toBe(true);
    // The analyzer flags the promoted input t
    const flagged = (honest.analysis?.weakInputWires ?? []).map((w) => w.name);
    expect(flagged).toContain('t');

    const exploitStep = EDITOR_AUTHOR_THE_BUG.steps.find((s) => s.id === 'exploit')!;
    const exploitRecord = exploitStep.demoAction!.payload as Record<string, string>;
    const exploitInputs = new Map(Object.entries(exploitRecord).map(([k, v]) => [k, BigInt(v)]));
    const exploit = evaluateCircuit(payload.source, 101n, exploitInputs);
    // Every constraint passes...
    expect(exploit.checks?.allSatisfied).toBe(true);
    // ...but the claimed output contradicts the honest computation f(7) = 61
    expect(exploitRecord.x).toBe('7');
    expect(exploitRecord.out).not.toBe('61');
    const soundPreset = getEditorPreset('basic')!;
    const soundRun = evaluateCircuit(
      soundPreset.source,
      101n,
      new Map([['x', BigInt(exploitRecord.x!)], ['out', BigInt(exploitRecord.out!)]]),
    );
    expect(soundRun.checks?.allSatisfied).toBe(false); // the sound circuit rejects the same claim
  });
});
