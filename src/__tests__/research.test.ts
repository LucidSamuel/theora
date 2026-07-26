import { describe, it, expect } from 'vitest';
import { CURATED_WALKTHROUGHS, getCuratedWalkthrough } from '../workspaces/research/curated';
import { generateDemoState } from '../workspaces/research/stateGenerator';
import { buildWalkthroughDemoUrl, normalizePaperPdfUrl } from '../workspaces/research/urls';
import { DEMO_IDS, isDemoId } from '../types';
import { decodeState } from '../lib/urlState';
import { deserializeDocument } from '../demos/constraint-editor/logic';
import { parse } from '../lib/dsl/parser';
import { compile } from '../lib/dsl/compiler';
import { analyzeConstraints } from '../lib/dsl/analyzer';
import { evaluateWitnessFromAST } from '../lib/dsl/witness';
import { checkConstraints } from '../lib/dsl/checker';

describe('curated walkthroughs', () => {
  it('all walkthroughs have unique IDs', () => {
    const ids = CURATED_WALKTHROUGHS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all section IDs are unique within each walkthrough', () => {
    for (const walkthrough of CURATED_WALKTHROUGHS) {
      const sectionIds = walkthrough.sections.map((s) => s.id);
      expect(new Set(sectionIds).size).toBe(sectionIds.length);
    }
  });

  it('all demo references use valid DemoIds', () => {
    for (const walkthrough of CURATED_WALKTHROUGHS) {
      for (const section of walkthrough.sections) {
        if (section.demo) {
          expect(
            isDemoId(section.demo.demoId),
            `Invalid demoId "${section.demo.demoId}" in ${walkthrough.id}/${section.id}`,
          ).toBe(true);
        }
      }
    }
  });

  it('all required fields are present', () => {
    for (const walkthrough of CURATED_WALKTHROUGHS) {
      expect(walkthrough.id).toBeTruthy();
      expect(walkthrough.paper.title).toBeTruthy();
      expect(walkthrough.paper.authors).toBeTruthy();
      expect(walkthrough.paper.year).toBeGreaterThan(2000);
      expect(walkthrough.paper.abstractSummary).toBeTruthy();
      expect(walkthrough.sections.length).toBeGreaterThan(0);
      expect(walkthrough.generatedBy).toBe('curated');

      for (const section of walkthrough.sections) {
        expect(section.id).toBeTruthy();
        expect(section.title).toBeTruthy();
        expect(section.summary).toBeTruthy();

        if (section.demo) {
          expect(section.demo.caption).toBeTruthy();
          expect(Array.isArray(section.demo.interactionHints)).toBe(true);
        }
      }
    }
  });

  it('getCuratedWalkthrough returns correct walkthrough by ID', () => {
    const halo = getCuratedWalkthrough('halo-2019');
    expect(halo).not.toBeNull();
    expect(halo!.paper.title).toContain('Recursive');

    const groth16 = getCuratedWalkthrough('groth16-2016');
    expect(groth16).not.toBeNull();
    expect(groth16!.paper.year).toBe(2016);
  });

  it('getCuratedWalkthrough returns null for unknown ID', () => {
    expect(getCuratedWalkthrough('nonexistent')).toBeNull();
  });

  it('has 8 curated walkthroughs', () => {
    expect(CURATED_WALKTHROUGHS.length).toBe(8);
  });

  it('each walkthrough has at least one section with a demo', () => {
    for (const walkthrough of CURATED_WALKTHROUGHS) {
      const hasDemos = walkthrough.sections.some((s) => s.demo !== undefined);
      expect(hasDemos, `${walkthrough.id} has no demo sections`).toBe(true);
    }
  });
});

describe('stateGenerator', () => {
  it('produces a valid state object for every DemoId', () => {
    for (const demoId of DEMO_IDS) {
      const state = generateDemoState(demoId);
      expect(state).toBeDefined();
      expect(typeof state).toBe('object');
    }
  });

  it('recursive state includes mode and depth', () => {
    const state = generateDemoState('recursive');
    expect(state.mode).toBe('tree');
    expect(state.depth).toBe(3);
  });

  it('pipeline state includes x', () => {
    const state = generateDemoState('pipeline');
    expect(state.x).toBe(7);
  });

  it('circuit state includes x', () => {
    const state = generateDemoState('circuit');
    expect(state.x).toBe(7);
  });

  it('pedersen state uses the demo URL schema', () => {
    const state = generateDemoState('pedersen');
    expect(state.v).toBe(42);
    expect(state.r).toBe(17);
    expect(state.showBlinding).toBe(true);
  });

  it('groth16 state uses showToxic instead of the stale key', () => {
    const state = generateDemoState('groth16');
    expect(state.showToxic).toBe(false);
    expect(state).not.toHaveProperty('showToxicWaste');
  });
});

describe('walkthrough type structure', () => {
  it('WalkthroughDemo has correct shape', () => {
    const walkthrough = getCuratedWalkthrough('halo-2019')!;
    const demoSection = walkthrough.sections.find((s) => s.demo);
    expect(demoSection).toBeDefined();
    expect(demoSection!.demo!.demoId).toBeTruthy();
    expect(demoSection!.demo!.caption).toBeTruthy();
    expect(Array.isArray(demoSection!.demo!.interactionHints)).toBe(true);
  });
});

describe('research URL helpers', () => {
  it('builds full demo URLs that preserve walkthrough state', () => {
    const walkthrough = getCuratedWalkthrough('halo-2019')!;
    const demo = walkthrough.sections.find((section) => section.id === 'accumulation')!.demo!;
    const url = new URL(buildWalkthroughDemoUrl(demo, { origin: 'https://theora.test' }));

    expect(url.pathname).toBe('/app');
    expect(url.hash).toBe('#recursive');
    expect(url.searchParams.get('embed')).toBeNull();

    const payload = decodeState<Record<string, unknown>>(url.searchParams.get('r'));
    expect(payload).toMatchObject({
      mode: 'ivc',
      ivcLength: 8,
      showPasta: true,
      showProofSize: true,
    });
  });

  it('builds embed demo URLs that target the isolated app shell', () => {
    const walkthrough = getCuratedWalkthrough('groth16-2016')!;
    const demo = walkthrough.sections.find((section) => section.id === 'trusted-setup')!.demo!;
    const url = new URL(buildWalkthroughDemoUrl(demo, { origin: 'https://theora.test', embed: true }));

    expect(url.pathname).toBe('/app');
    expect(url.hash).toBe('');
    expect(url.searchParams.get('embed')).toBe('groth16');

    const payload = decodeState<Record<string, unknown>>(url.searchParams.get('g16'));
    expect(payload).toMatchObject({
      x: 7,
      phase: 'setup',
      showToxic: true,
    });
  });

  it('appends the mode param when a walkthrough demo sets one', () => {
    const demo = {
      demoId: 'circuit' as const,
      state: { x: 7 },
      mode: 'debug' as const,
      caption: 'test',
      interactionHints: [],
    };
    const full = new URL(buildWalkthroughDemoUrl(demo, { origin: 'https://theora.test' }));
    expect(full.searchParams.get('mode')).toBe('debug');
    const embed = new URL(buildWalkthroughDemoUrl(demo, { origin: 'https://theora.test', embed: true }));
    expect(embed.searchParams.get('mode')).toBe('debug');
  });

  it('omits the mode param when a walkthrough demo has none', () => {
    for (const walkthrough of CURATED_WALKTHROUGHS) {
      for (const section of walkthrough.sections) {
        if (!section.demo || section.demo.mode) continue;
        const url = new URL(buildWalkthroughDemoUrl(section.demo, { origin: 'https://theora.test' }));
        expect(url.searchParams.get('mode')).toBeNull();
      }
    }
  });

  it('normalizes bare eprint ids and page URLs to PDF URLs', () => {
    expect(normalizePaperPdfUrl('2019/1021')).toBe('https://eprint.iacr.org/2019/1021.pdf');
    expect(normalizePaperPdfUrl('https://eprint.iacr.org/2019/1021')).toBe('https://eprint.iacr.org/2019/1021.pdf');
    expect(normalizePaperPdfUrl('https://eprint.iacr.org/2019/1021.pdf')).toBe('https://eprint.iacr.org/2019/1021.pdf');
  });
});

describe('paper-lineage walkthroughs (fri/protostar/plonky/hyperplonk)', () => {
  const NEW_IDS = ['fri-ethstark-2021', 'protostar-2023', 'plonky-lineage-2022', 'hyperplonk-2022'];

  it('all four are listed with sections and references', () => {
    for (const id of NEW_IDS) {
      const walkthrough = getCuratedWalkthrough(id);
      expect(walkthrough, id).not.toBeNull();
      expect(CURATED_WALKTHROUGHS.some((w) => w.id === id), `${id} listed`).toBe(true);
      expect(walkthrough!.sections.length).toBeGreaterThanOrEqual(8);
      expect(walkthrough!.references!.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('each has at least one constraint-editor deep link', () => {
    for (const id of NEW_IDS) {
      const walkthrough = getCuratedWalkthrough(id)!;
      const editorSections = walkthrough.sections.filter((s) => s.demo?.demoId === 'constraint-editor');
      expect(editorSections.length, `${id} editor sections`).toBeGreaterThanOrEqual(1);
    }
  });

  it('every constraint-editor payload deserializes, compiles cleanly, and is satisfied by its inputs', () => {
    for (const walkthrough of CURATED_WALKTHROUGHS) {
      for (const section of walkthrough.sections) {
        if (section.demo?.demoId !== 'constraint-editor') continue;
        const where = `${walkthrough.id}/${section.id}`;

        const doc = deserializeDocument(section.demo.state);
        expect(doc, `${where}: deserializeDocument`).not.toBeNull();
        expect(doc!.source, where).toBeTruthy();

        const parsed = parse(doc!.source!);
        expect(parsed.errors, `${where}: parse ${JSON.stringify(parsed.errors)}`).toHaveLength(0);

        const compilation = compile(parsed.ast, doc!.fieldSize!);
        expect(compilation.errors, `${where}: compile ${JSON.stringify(compilation.errors)}`).toHaveLength(0);

        const analysis = analyzeConstraints(compilation);
        expect(analysis.unconstrainedWires, `${where}: unconstrained wires`).toHaveLength(0);

        const witness = evaluateWitnessFromAST(compilation, parsed.ast, doc!.inputs!);
        expect(witness.success, `${where}: witness ${JSON.stringify(witness.errors)}`).toBe(true);

        const check = checkConstraints(compilation, witness);
        expect(check.allSatisfied, `${where}: ${JSON.stringify(check.failedConstraints)}`).toBe(true);
      }
    }
  });
});

describe('curated research state schema', () => {
  it('uses current demo URL keys for recursive, groth16, and pipeline walkthroughs', () => {
    const halo = getCuratedWalkthrough('halo-2019')!;
    const accumulation = halo.sections.find((section) => section.id === 'accumulation')!.demo!;
    const noTrustedSetup = halo.sections.find((section) => section.id === 'no-trusted-setup')!.demo!;
    const groth16 = getCuratedWalkthrough('groth16-2016')!;
    const trustedSetup = groth16.sections.find((section) => section.id === 'trusted-setup')!.demo!;
    const ragu = getCuratedWalkthrough('ragu-2026')!;
    const pipeline = ragu.sections.find((section) => section.id === 'proof-pipeline')!.demo!;

    expect(accumulation.state).toMatchObject({ ivcLength: 8 });
    expect(accumulation.state).not.toHaveProperty('ivcSteps');
    expect(noTrustedSetup.state).toMatchObject({ phase: 'setup', showToxic: true });
    expect(noTrustedSetup.state).not.toHaveProperty('showToxicWaste');
    expect(trustedSetup.state).toMatchObject({ phase: 'setup', showToxic: true });
    expect(trustedSetup.state).not.toHaveProperty('showToxicWaste');
    expect(pipeline.state).toMatchObject({ x: 7, fault: 'none' });
    expect(pipeline.state).not.toHaveProperty('secretInput');
  });

  it('uses the Pedersen demo URL schema in Bulletproofs walkthroughs', () => {
    const bulletproofs = getCuratedWalkthrough('bulletproofs-2018')!;
    const commitment = bulletproofs.sections.find((section) => section.id === 'pedersen-commitments')!.demo!;
    const homomorphic = bulletproofs.sections.find((section) => section.id === 'homomorphic-addition')!.demo!;

    expect(commitment.state).toMatchObject({ v: 42, r: 17, showBlinding: true });
    expect(commitment.state).not.toHaveProperty('mode');
    expect(commitment.state).not.toHaveProperty('value');
    expect(commitment.state).not.toHaveProperty('randomness');

    expect(homomorphic.state).toMatchObject({ v: 12, r: 7, v2: 30, r2: 11 });
    expect(homomorphic.state).not.toHaveProperty('mode');
  });
});
