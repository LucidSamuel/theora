import type { ReactNode } from 'react';

type SidebarWidth = 'standard' | 'compact';
type AsideWidth = 'compact' | 'narrow';
type AsideSide = 'left' | 'right';

interface DemoLayoutProps {
  children: ReactNode;
}

interface DemoSidebarProps {
  children: ReactNode;
  width?: SidebarWidth;
}

interface DemoCanvasAreaProps {
  children: ReactNode;
}

interface DemoAsideProps {
  children: ReactNode;
  side?: AsideSide;
  width?: AsideWidth;
}

export function DemoLayout({ children }: DemoLayoutProps) {
  return <div className="demo-layout">{children}</div>;
}

export function DemoSidebar({ children, width = 'standard' }: DemoSidebarProps) {
  return <div className={`demo-sidebar demo-sidebar--${width}`}>{children}</div>;
}

export function DemoCanvasArea({ children }: DemoCanvasAreaProps) {
  return <div className="demo-canvas-area">{children}</div>;
}

export function DemoAside({ children, side = 'right', width = 'compact' }: DemoAsideProps) {
  return <div className={`demo-aside demo-aside--${side} demo-aside--${width}`}>{children}</div>;
}
