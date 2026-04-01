import { describe, it, expect } from 'vitest';
import { CURATED_WALKTHROUGHS, getCuratedWalkthrough } from '../workspaces/research/curated';
import { generateDemoState } from '../workspaces/research/stateGenerator';
import { DEMO_IDS, isDemoId } from '../types';

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

  it('has 5 curated walkthroughs', () => {
    expect(CURATED_WALKTHROUGHS.length).toBe(5);
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

  it('pipeline state includes secretInput', () => {
    const state = generateDemoState('pipeline');
    expect(state.secretInput).toBe(7);
  });

  it('circuit state includes x', () => {
    const state = generateDemoState('circuit');
    expect(state.x).toBe(7);
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
