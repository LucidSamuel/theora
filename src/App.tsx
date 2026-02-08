import { useTheme } from '@/hooks/useTheme';
import { useActiveDemo } from '@/hooks/useActiveDemo';
import { Layout } from '@/components/layout/Layout';
import { DemoContainer } from '@/components/layout/DemoContainer';
import { MerkleDemo } from '@/demos/merkle/MerkleDemo';
import { PolynomialDemo } from '@/demos/polynomial/PolynomialDemo';
import { AccumulatorDemo } from '@/demos/accumulator/AccumulatorDemo';
import { RecursiveDemo } from '@/demos/recursive/RecursiveDemo';

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
      <DemoContainer activeDemo={activeDemo}>{renderDemo()}</DemoContainer>
    </Layout>
  );
}
