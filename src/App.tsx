import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useActiveDemo } from '@/hooks/useActiveDemo';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { GitHubProvider } from '@/hooks/useGitHub';
import { ModeProvider, useMode, PlaceholderMode, AttackMode, PredictMode, DebugMode } from '@/modes';
import { Layout } from '@/components/layout/Layout';
import { DemoContainer } from '@/components/layout/DemoContainer';
import { DemoErrorBoundary } from '@/components/shared/DemoErrorBoundary';
import { GitHubImportModal } from '@/components/shared/GitHubImportModal';
import { GitHubConnectModal } from '@/components/shared/GitHubConnectModal';
import { MySavesModal } from '@/components/shared/MySavesModal';
import { MerkleDemo } from '@/demos/merkle/MerkleDemo';
import { PolynomialDemo } from '@/demos/polynomial/PolynomialDemo';
import { AccumulatorDemo } from '@/demos/accumulator/AccumulatorDemo';
import { RecursiveDemo } from '@/demos/recursive/RecursiveDemo';
import { EllipticDemo } from '@/demos/elliptic/EllipticDemo';
import { FiatShamirDemo } from '@/demos/fiat-shamir/FiatShamirDemo';
import { CircuitDemo } from '@/demos/circuit/CircuitDemo';
import { LookupDemo } from '@/demos/lookup/LookupDemo';
import { PedersenDemo } from '@/demos/pedersen/PedersenDemo';
import { PlonkDemo } from '@/demos/plonk/PlonkDemo';
import { Groth16Demo } from '@/demos/groth16/Groth16Demo';
import { PipelineDemo } from '@/demos/pipeline/PipelineDemo';
import { ConstraintCounterDemo } from '@/demos/constraint-counter/ConstraintCounterDemo';
import { ObliviousSyncDemo } from '@/demos/oblivious-sync/ObliviousSyncDemo';
import { RerandomizationDemo } from '@/demos/rerandomization/RerandomizationDemo';
import { SplitAccumulationDemo } from '@/demos/split-accumulation/SplitAccumulationDemo';
import { DEMOS, type DemoId } from '@/types';

const DEMO_NAMES = {
  pipeline: 'Proof Pipeline',
  merkle: 'Merkle Tree',
  polynomial: 'Polynomial Commitments',
  accumulator: 'RSA Accumulator',
  recursive: 'Recursive Proofs',
  'split-accumulation': 'Split Accumulation',
  rerandomization: 'Proof Rerandomization',
  'oblivious-sync': 'Oblivious Sync',
  elliptic: 'Elliptic Curves',
  'fiat-shamir': 'Fiat-Shamir',
  circuit: 'R1CS Circuits',
  lookup: 'Lookup Arguments',
  pedersen: 'Pedersen Commitments',
  'constraint-counter': 'Pedersen vs Poseidon',
  plonk: 'PLONK Arithmetization',
  groth16: 'Groth16 zkSNARK',
} as const;

export default function App() {
  const { theme, toggle } = useTheme();
  const { activeDemo, activeLocationKey, switchDemo } = useActiveDemo();
  const isMobile = useMediaQuery('(max-width: 767px)');
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
    if (isMobile) return;

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'CANVAS') return;
      if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); navigateDemo(1); }
      if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); navigateDemo(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobile, navigateDemo]);

  const renderDemo = () => {
    switch (activeDemo) {
      case 'merkle':
        return <MerkleDemo />;
      case 'polynomial':
        return <PolynomialDemo />;
      case 'accumulator':
        return <AccumulatorDemo />;
      case 'recursive':
        return <RecursiveDemo />;
      case 'split-accumulation':
        return <SplitAccumulationDemo />;
      case 'rerandomization':
        return <RerandomizationDemo />;
      case 'oblivious-sync':
        return <ObliviousSyncDemo />;
      case 'elliptic':
        return <EllipticDemo />;
      case 'fiat-shamir':
        return <FiatShamirDemo />;
      case 'circuit':
        return <CircuitDemo />;
      case 'lookup':
        return <LookupDemo />;
      case 'pedersen':
        return <PedersenDemo />;
      case 'constraint-counter':
        return <ConstraintCounterDemo />;
      case 'plonk':
        return <PlonkDemo />;
      case 'groth16':
        return <Groth16Demo />;
      case 'pipeline':
        return <PipelineDemo />;
    }
  };

  return (
    <ModeProvider>
      <GitHubProvider>
        <Layout
          activeDemo={activeDemo}
          onSwitchDemo={switchDemo}
          theme={theme}
          onToggleTheme={toggle}
          onOpenImport={() => setImportOpen(true)}
        >
          <AppContent
            activeDemo={activeDemo}
            activeLocationKey={activeLocationKey}
            renderDemo={renderDemo}
          />
        </Layout>
        <GitHubImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} activeDemo={activeDemo} />
        <GitHubConnectModal />
        <MySavesModal />
      </GitHubProvider>
    </ModeProvider>
  );
}

function AppContent({
  activeDemo,
  activeLocationKey,
  renderDemo,
}: {
  activeDemo: DemoId;
  activeLocationKey: string;
  renderDemo: () => JSX.Element;
}) {
  const { mode } = useMode();

  if (mode === 'attack') {
    return (
      <AttackMode activeDemo={activeDemo}>
        <DemoErrorBoundary key={`${activeLocationKey}-attack`} demoName={DEMO_NAMES[activeDemo]}>
          {renderDemo()}
        </DemoErrorBoundary>
      </AttackMode>
    );
  }

  if (mode === 'predict') {
    return (
      <PredictMode activeDemo={activeDemo}>
        <DemoErrorBoundary key={`${activeLocationKey}-predict`} demoName={DEMO_NAMES[activeDemo]}>
          {renderDemo()}
        </DemoErrorBoundary>
      </PredictMode>
    );
  }

  if (mode === 'debug') {
    return (
      <DebugMode activeDemo={activeDemo}>
        <DemoErrorBoundary key={`${activeLocationKey}-debug`} demoName={DEMO_NAMES[activeDemo]}>
          {renderDemo()}
        </DemoErrorBoundary>
      </DebugMode>
    );
  }

  if (mode !== 'explore') {
    return <PlaceholderMode modeId={mode} />;
  }

  return (
    <DemoContainer activeDemo={activeDemo}>
      <DemoErrorBoundary key={activeLocationKey} demoName={DEMO_NAMES[activeDemo]}>
        {renderDemo()}
      </DemoErrorBoundary>
    </DemoContainer>
  );
}
