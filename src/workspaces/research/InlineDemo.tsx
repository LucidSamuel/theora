import { Suspense, lazy, useMemo } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { DemoId } from '@/types';
import type { WalkthroughDemo } from './types';
import { encodeState } from '@/lib/urlState';

// Lazy-load demo components to avoid pulling all demos into the research chunk
const MerkleDemo = lazy(() => import('@/demos/merkle/MerkleDemo').then(m => ({ default: m.MerkleDemo })));
const PolynomialDemo = lazy(() => import('@/demos/polynomial/PolynomialDemo').then(m => ({ default: m.PolynomialDemo })));
const AccumulatorDemo = lazy(() => import('@/demos/accumulator/AccumulatorDemo').then(m => ({ default: m.AccumulatorDemo })));
const RecursiveDemo = lazy(() => import('@/demos/recursive/RecursiveDemo').then(m => ({ default: m.RecursiveDemo })));
const EllipticDemo = lazy(() => import('@/demos/elliptic/EllipticDemo').then(m => ({ default: m.EllipticDemo })));
const FiatShamirDemo = lazy(() => import('@/demos/fiat-shamir/FiatShamirDemo').then(m => ({ default: m.FiatShamirDemo })));
const CircuitDemo = lazy(() => import('@/demos/circuit/CircuitDemo').then(m => ({ default: m.CircuitDemo })));
const LookupDemo = lazy(() => import('@/demos/lookup/LookupDemo').then(m => ({ default: m.LookupDemo })));
const PedersenDemo = lazy(() => import('@/demos/pedersen/PedersenDemo').then(m => ({ default: m.PedersenDemo })));
const PlonkDemo = lazy(() => import('@/demos/plonk/PlonkDemo').then(m => ({ default: m.PlonkDemo })));
const Groth16Demo = lazy(() => import('@/demos/groth16/Groth16Demo').then(m => ({ default: m.Groth16Demo })));
const PipelineDemo = lazy(() => import('@/demos/pipeline/PipelineDemo').then(m => ({ default: m.PipelineDemo })));
const SplitAccumulationDemo = lazy(() => import('@/demos/split-accumulation/SplitAccumulationDemo').then(m => ({ default: m.SplitAccumulationDemo })));
const RerandomizationDemo = lazy(() => import('@/demos/rerandomization/RerandomizationDemo').then(m => ({ default: m.RerandomizationDemo })));
const ConstraintCounterDemo = lazy(() => import('@/demos/constraint-counter/ConstraintCounterDemo').then(m => ({ default: m.ConstraintCounterDemo })));

interface InlineDemoProps {
  demo: WalkthroughDemo;
  height?: number;
}

function getDemoComponent(demoId: DemoId): React.ComponentType | null {
  switch (demoId) {
    case 'merkle': return MerkleDemo;
    case 'polynomial': return PolynomialDemo;
    case 'accumulator': return AccumulatorDemo;
    case 'recursive': return RecursiveDemo;
    case 'elliptic': return EllipticDemo;
    case 'fiat-shamir': return FiatShamirDemo;
    case 'circuit': return CircuitDemo;
    case 'lookup': return LookupDemo;
    case 'pedersen': return PedersenDemo;
    case 'plonk': return PlonkDemo;
    case 'groth16': return Groth16Demo;
    case 'pipeline': return PipelineDemo;
    case 'split-accumulation': return SplitAccumulationDemo;
    case 'rerandomization': return RerandomizationDemo;
    case 'constraint-counter': return ConstraintCounterDemo;
    default: return null;
  }
}

export function InlineDemo({ demo, height = 500 }: InlineDemoProps) {
  const isMobile = useMediaQuery('(max-width: 767px)');

  const openFullUrl = useMemo(() => {
    const url = new URL(window.location.origin + '/app');
    url.hash = demo.demoId;
    if (Object.keys(demo.state).length > 0) {
      // Use query param key for the demo
      const DEMO_KEYS: Partial<Record<DemoId, string>> = {
        pipeline: 'pl', merkle: 'm', polynomial: 'p', accumulator: 'a',
        recursive: 'r', 'split-accumulation': 'sa', rerandomization: 'rr',
        'fiat-shamir': 'fs', circuit: 'c', elliptic: 'e', lookup: 'l',
        pedersen: 'ped', 'constraint-counter': 'cc', plonk: 'plk', groth16: 'g16',
      };
      const key = DEMO_KEYS[demo.demoId];
      if (key) {
        url.searchParams.set(key, encodeState(demo.state));
      }
    }
    return url.toString();
  }, [demo.demoId, demo.state]);

  // On mobile, show a placeholder instead of the full interactive demo
  if (isMobile) {
    return (
      <div
        style={{
          padding: '32px 20px',
          borderRadius: 12,
          border: '1px solid var(--border)',
          background: 'var(--surface-element)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          {demo.caption}
        </div>
        <a
          href={openFullUrl}
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            textDecoration: 'none',
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            display: 'inline-block',
          }}
        >
          Open full demo on desktop
        </a>
      </div>
    );
  }

  const DemoComponent = getDemoComponent(demo.demoId);
  if (!DemoComponent) return null;

  return (
    <div style={{ marginTop: 16 }}>
      {/* Demo embed container */}
      <div
        style={{
          height,
          borderRadius: 12,
          border: '1px solid var(--border)',
          overflow: 'hidden',
          position: 'relative',
          background: 'var(--bg-primary)',
        }}
      >
        <Suspense
          fallback={
            <div
              style={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: 'var(--text-muted)',
                  opacity: 0.3,
                  animation: 'pulse 1.4s ease-in-out infinite',
                }}
              />
            </div>
          }
        >
          <DemoComponent />
        </Suspense>
      </div>

      {/* Caption */}
      {demo.caption && (
        <p
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            margin: '10px 0 0',
            lineHeight: 1.5,
            fontStyle: 'italic',
          }}
        >
          {demo.caption}
        </p>
      )}

      {/* Interaction hints */}
      {demo.interactionHints.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
            }}
          >
            Interaction hints
          </summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {demo.interactionHints.map((hint, i) => (
              <li
                key={i}
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5,
                  marginBottom: 4,
                }}
              >
                {hint}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Open full demo link */}
      <div style={{ marginTop: 10 }}>
        <a
          href={openFullUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Open full demo →
        </a>
      </div>
    </div>
  );
}
