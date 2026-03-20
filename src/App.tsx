import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useActiveDemo } from '@/hooks/useActiveDemo';
import { Layout } from '@/components/layout/Layout';
import { DemoContainer } from '@/components/layout/DemoContainer';
import { DemoErrorBoundary } from '@/components/shared/DemoErrorBoundary';
import { GitHubImportModal } from '@/components/shared/GitHubImportModal';
import { MerkleDemo } from '@/demos/merkle/MerkleDemo';
import { PolynomialDemo } from '@/demos/polynomial/PolynomialDemo';
import { AccumulatorDemo } from '@/demos/accumulator/AccumulatorDemo';
import { RecursiveDemo } from '@/demos/recursive/RecursiveDemo';
import { EllipticDemo } from '@/demos/elliptic/EllipticDemo';
import { FiatShamirDemo } from '@/demos/fiat-shamir/FiatShamirDemo';
import { CircuitDemo } from '@/demos/circuit/CircuitDemo';
import { LookupDemo } from '@/demos/lookup/LookupDemo';
import { PipelineDemo } from '@/demos/pipeline/PipelineDemo';
import { DEMOS } from '@/types';

const DEMO_NAMES = {
  pipeline: 'Proof Pipeline',
  merkle: 'Merkle Tree',
  polynomial: 'Polynomial Commitments',
  accumulator: 'RSA Accumulator',
  recursive: 'Recursive Proofs',
  elliptic: 'Elliptic Curves',
  'fiat-shamir': 'Fiat-Shamir',
  circuit: 'R1CS Circuits',
  lookup: 'Lookup Arguments',
} as const;

export default function App() {
  const { theme, toggle } = useTheme();
  const { activeDemo, activeLocationKey, switchDemo } = useActiveDemo();
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add('app-shell');
    return () => document.body.classList.remove('app-shell');
  }, []);

  const navigateDemo = useCallback((dir: 1 | -1) => {
    const ids = DEMOS.map((d) => d.id);
    const idx = ids.indexOf(activeDemo);
    const next = ids[(idx + dir + ids.length) % ids.length]!;
    switchDemo(next);
  }, [activeDemo, switchDemo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'CANVAS') return;
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); navigateDemo(1); }
      if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); navigateDemo(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigateDemo]);

  const renderDemo = () => {
    switch (activeDemo) {
      case 'pipeline':
        return <PipelineDemo />;
      case 'merkle':
        return <MerkleDemo />;
      case 'polynomial':
        return <PolynomialDemo />;
      case 'accumulator':
        return <AccumulatorDemo />;
      case 'recursive':
        return <RecursiveDemo />;
      case 'elliptic':
        return <EllipticDemo />;
      case 'fiat-shamir':
        return <FiatShamirDemo />;
      case 'circuit':
        return <CircuitDemo />;
      case 'lookup':
        return <LookupDemo />;
    }
  };

  return (
    <>
      <Layout
        activeDemo={activeDemo}
        onSwitchDemo={switchDemo}
        theme={theme}
        onToggleTheme={toggle}
        onOpenImport={() => setImportOpen(true)}
      >
        <DemoContainer activeDemo={activeDemo}>
          <DemoErrorBoundary key={activeLocationKey} demoName={DEMO_NAMES[activeDemo]}>
            {renderDemo()}
          </DemoErrorBoundary>
        </DemoContainer>
      </Layout>
      <GitHubImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} activeDemo={activeDemo} />
    </>
  );
}
