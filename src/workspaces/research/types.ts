import type { DemoId } from '@/types';

export interface Walkthrough {
  id: string;
  paper: {
    title: string;
    authors: string;
    year: number;
    eprintId?: string;
    eprintUrl?: string;
    abstractSummary: string;
  };
  sections: WalkthroughSection[];
  generatedBy: 'curated' | 'ai';
  generatedAt?: string;
}

export interface WalkthroughSection {
  id: string;
  sectionRef?: string;
  title: string;
  summary: string;
  keyInsight?: string;
  demo?: WalkthroughDemo;
}

export interface WalkthroughDemo {
  demoId: DemoId;
  state: Record<string, unknown>;
  caption: string;
  interactionHints: string[];
}
