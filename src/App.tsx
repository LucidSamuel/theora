import { useTheme } from '@/hooks/useTheme';
import { useActiveDemo } from '@/hooks/useActiveDemo';
import { Layout } from '@/components/layout/Layout';
import { DemoContainer } from '@/components/layout/DemoContainer';
import { DemoErrorBoundary } from '@/components/shared/DemoErrorBoundary';
import { MerkleDemo } from '@/demos/merkle/MerkleDemo';
import { PolynomialDemo } from '@/demos/polynomial/PolynomialDemo';
import { AccumulatorDemo } from '@/demos/accumulator/AccumulatorDemo';
import { RecursiveDemo } from '@/demos/recursive/RecursiveDemo';

const DEMO_NAMES = {
  merkle: 'Merkle Tree',
  polynomial: 'Polynomial Commitments',
  accumulator: 'RSA Accumulator',
  recursive: 'Recursive Proofs',
} as const;

export default function App() {
  const { theme, toggle } = useTheme();
  const { activeDemo, switchDemo } = useActiveDemo();

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
    }
  };

  return (
    <Layout activeDemo={activeDemo} onSwitchDemo={switchDemo} theme={theme} onToggleTheme={toggle}>
      <DemoContainer activeDemo={activeDemo}>
        <DemoErrorBoundary key={activeDemo} demoName={DEMO_NAMES[activeDemo]}>
          {renderDemo()}
        </DemoErrorBoundary>
      </DemoContainer>
    </Layout>
  );
}
