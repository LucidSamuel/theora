import { describe, expect, it } from 'vitest';
import { buildLinkedDemoTarget, buildPipelineHash, getPrimaryPipelineIssue, getStageDiagnostic } from '@/demos/pipeline/linkedState';
import { runPipeline } from '@/demos/pipeline/logic';

describe('pipeline linked trace', () => {
  it('maps witness and constraint stages to the circuit demo', async () => {
    const results = runPipeline(3, 'constraints', 'none');
    const target = await buildLinkedDemoTarget('constraints', results, 'none', { x: 3, stage: 'constraints', fault: 'none' });

    expect(target?.demo).toBe('circuit');
    expect(target?.hash.startsWith('circuit|')).toBe(true);
    expect(target?.exact).toBe(true);
    expect(target?.hash).toContain('pipelineHash');
  });

  it('maps polynomial verification stages to the polynomial demo with kzg state', async () => {
    const results = runPipeline(3, 'verify', 'none');
    const target = await buildLinkedDemoTarget('verify', results, 'none', { x: 3, stage: 'verify', fault: 'none' });

    expect(target?.demo).toBe('polynomial');
    expect(target?.hash.startsWith('polynomial|')).toBe(true);
    expect(target?.hash).toContain('currentStep');
    expect(target?.hash).toContain('pipelineHash');
  });

  it('flags the constraint stage as the first divergence for a bad witness', () => {
    const results = runPipeline(3, 'verify', 'bad-witness');
    const issue = getPrimaryPipelineIssue(results, 'bad-witness');

    expect(issue?.stage).toBe('constraints');
    expect(issue?.severity).toBe('error');
  });

  it('flags weak fiat-shamir as a challenge-stage warning even if verification passes', () => {
    const results = runPipeline(3, 'verify', 'weak-fiat-shamir');
    const challenge = getStageDiagnostic('challenge', results, 'weak-fiat-shamir');
    const issue = getPrimaryPipelineIssue(results, 'weak-fiat-shamir');

    expect(challenge.severity).toBe('warning');
    expect(issue?.stage).toBe('challenge');
  });

  it('builds an exact fiat-shamir transcript handoff for the challenge stage', async () => {
    const results = runPipeline(3, 'challenge', 'none');
    const target = await buildLinkedDemoTarget('challenge', results, 'none', { x: 3, stage: 'challenge', fault: 'none' });

    expect(target?.demo).toBe('fiat-shamir');
    expect(target?.exact).toBe(true);
    expect(target?.hash.startsWith('fiat-shamir|')).toBe(true);
    expect(target?.hash).toContain('transcriptInputs');
    expect(target?.hash).toContain('commitment');
    expect(target?.hash).toContain('pipelineHash');
  });

  it('builds a canonical restorable pipeline hash', () => {
    expect(buildPipelineHash({ x: 3, stage: 'open', fault: 'bad-opening' })).toContain('pipeline|');
  });
});
