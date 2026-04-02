import type { DemoId } from '@/types';

export interface WalkthroughReference {
  id: string;
  title: string;
  authors?: string;
  year?: number;
  url?: string;
  note?: string;
}

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
  references?: WalkthroughReference[];
  generatedBy: 'curated' | 'ai';
  generatedAt?: string;
}

export interface WalkthroughSection {
  id: string;
  sectionRef?: string;
  title: string;
  summary: string;
  keyInsight?: string;
  citations?: string[];
  demo?: WalkthroughDemo;
}

export interface WalkthroughDemo {
  demoId: DemoId;
  state: Record<string, unknown>;
  caption: string;
  interactionHints: string[];
}
