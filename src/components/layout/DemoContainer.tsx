import { useState, useEffect, type ReactNode } from 'react';
import type { DemoId } from '@/types';

interface DemoContainerProps {
  activeDemo: DemoId;
  children: ReactNode;
}

export function DemoContainer({ activeDemo, children }: DemoContainerProps) {
  const [visible, setVisible] = useState(true);
  const [rendered, setRendered] = useState(activeDemo);

  useEffect(() => {
    if (activeDemo !== rendered) {
      setVisible(false);
      const timer = setTimeout(() => {
        setRendered(activeDemo);
        setVisible(true);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeDemo, rendered]);

  return (
    <div
      className="flex-1 h-full overflow-hidden transition-opacity duration-150"
      style={{ opacity: visible ? 1 : 0 }}
      key={rendered}
    >
      {children}
    </div>
  );
}
