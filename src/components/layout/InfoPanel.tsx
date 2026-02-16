import { useState } from 'react';
import { DEMOS, type DemoId } from '@/types';
import { useInfoPanel } from './InfoContext';

interface InfoPanelProps {
  activeDemo: DemoId;
  isOpen: boolean;
}

interface CollapsibleSectionProps {
  title: string;
  accent: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({ title, accent, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left cursor-pointer py-1"
        style={{ background: 'none', border: 'none', padding: 0 }}
      >
        <h4
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: accent }}
        >
          {title}
        </h4>
        <span
          className="text-[10px] transition-transform"
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            display: 'inline-block',
          }}
        >
          ▸
        </span>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

const EXTRA_INFO: Record<DemoId, { concepts: string[]; resources: string[] }> = {
  merkle: {
    concepts: [
      'Domain separation: leaf hashes use 0x00 prefix, internal nodes use 0x01, preventing second-preimage attacks.',
      'Proof size is O(log n): for n leaves, a proof requires only log2(n) sibling hashes.',
      'Merkle proofs are used in Bitcoin SPV clients, Ethereum state tries, and certificate transparency logs.',
    ],
    resources: ['RFC 6962 - Certificate Transparency', 'Merkle Tree in Bitcoin Wiki'],
  },
  polynomial: {
    concepts: [
      'KZG commitments use a trusted setup to generate structured reference strings (SRS) on elliptic curves.',
      'The binding property ensures the committer cannot open to a different polynomial later.',
      'Polynomial commitments are the backbone of PlonK, Marlin, and EIP-4844 (proto-danksharding).',
    ],
    resources: ['KZG10 paper by Kate, Zaverucha, Goldberg', 'Dankrad Feist - KZG Commitments'],
  },
  accumulator: {
    concepts: [
      'The RSA accumulator relies on the Strong RSA assumption: given n and a random y, it\'s hard to find x and e>1 such that x^e = y mod n.',
      'Non-membership proofs are also possible using Bezout coefficients from the extended GCD.',
      'Accumulators are used in anonymous credentials, stateless blockchains, and revocation systems.',
    ],
    resources: ['Boneh et al. - RSA Accumulators', 'Ozcelik et al. - Accumulators Survey'],
  },
  recursive: {
    concepts: [
      'The Pasta curves (Pallas and Vesta) have a special cycle: the scalar field of one equals the base field of the other.',
      'IVC (Incremental Verifiable Computation) compresses a chain of N computations into a single constant-size proof.',
      'Nova achieves folding without SNARKs for each step, only requiring a final SNARK at the end.',
    ],
    resources: ['Nova: Recursive SNARKs without SNARKs', 'Halo: Recursive Proof Composition'],
  },
};

const MINI_GLOSSARY: Record<DemoId, { term: string; definition: string }[]> = {
  merkle: [
    { term: 'Leaf hash', definition: 'Hash of raw data at the tree edge.' },
    { term: 'Internal node', definition: 'Hash of left + right child hashes.' },
    { term: 'Proof path', definition: 'Sibling hashes needed to recompute the root.' },
  ],
  polynomial: [
    { term: 'Commitment', definition: 'Binding handle to a polynomial.' },
    { term: 'Challenge z', definition: 'Verifier\u2019s random evaluation point.' },
    { term: 'Quotient', definition: 'q(x) where p(x)=(x\u2212z)q(x)+p(z).' },
  ],
  accumulator: [
    { term: 'Accumulator', definition: 'Compact value representing a set.' },
    { term: 'Witness', definition: 'Proof of membership for one element.' },
    { term: 'Strong RSA', definition: 'Hardness behind RSA accumulators.' },
  ],
  recursive: [
    { term: 'Recursive SNARK', definition: 'Proof verifies another proof.' },
    { term: 'IVC', definition: 'Incremental verifiable computation chain.' },
    { term: 'Pasta cycle', definition: 'Pallas/Vesta curve alternation.' },
  ],
};

const DEFAULT_NEXT_STEPS: Record<DemoId, string[]> = {
  merkle: ['Add a leaf', 'Generate a proof', 'Step through hashing'],
  polynomial: ['Adjust coefficients', 'Commit to the polynomial', 'Challenge and verify'],
  accumulator: ['Add primes', 'Select an element', 'Compute a witness'],
  recursive: ['Build a tree', 'Run auto-verify', 'Try IVC mode'],
};

export function InfoPanel({ activeDemo, isOpen }: InfoPanelProps) {
  const demo = DEMOS.find((d) => d.id === activeDemo)!;
  const extra = EXTRA_INFO[activeDemo];
  const { entries } = useInfoPanel();
  const contextEntry = entries[activeDemo];
  const glossary = contextEntry?.glossary ?? MINI_GLOSSARY[activeDemo];
  const nextSteps = contextEntry?.nextSteps ?? DEFAULT_NEXT_STEPS[activeDemo];

  if (!isOpen) return null;

  return (
    <aside
      className="hidden lg:flex flex-col h-full overflow-y-auto py-4 px-4 border-l panel-surface"
      style={{
        borderColor: 'var(--border)',
        width: 300,
      }}
    >
      <h3 className="text-xs font-bold uppercase tracking-wider mb-1 font-display" style={{ color: demo.accent }}>
        About {demo.title}
      </h3>
      <p className="text-xs leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
        {demo.description}
      </p>

      {contextEntry && (
        <CollapsibleSection title="Live Context" accent="var(--text-muted)" defaultOpen>
          <div className="rounded border px-3 py-3 panel-inset" style={{ borderColor: 'var(--border)' }}>
            <div className="text-[11px] font-semibold mb-1" style={{ color: demo.accent }}>
              {contextEntry.title}
            </div>
            <div className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {contextEntry.body}
            </div>
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Suggested Next" accent="var(--text-muted)" defaultOpen>
        <ul className="space-y-3">
          {nextSteps.map((step, i) => (
            <li key={i} className="text-[11px] leading-relaxed pl-3 border-l-2" style={{ color: 'var(--text-secondary)', borderColor: demo.accent }}>
              {step}
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Key Concepts" accent="var(--text-muted)">
        <ul className="space-y-3">
          {extra.concepts.map((c, i) => (
            <li key={i} className="text-[11px] leading-relaxed pl-3 border-l-2" style={{ color: 'var(--text-secondary)', borderColor: demo.accent }}>
              {c}
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Mini Glossary" accent="var(--text-muted)">
        <ul className="space-y-3">
          {glossary.map((item, i) => (
            <li key={i} className="text-[11px] leading-relaxed">
              <span className="font-semibold" style={{ color: demo.accent }}>
                {item.term}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}> — {item.definition}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Further Reading" accent="var(--text-muted)">
        <ul className="space-y-1">
          {extra.resources.map((r, i) => (
            <li key={i} className="text-[11px]" style={{ color: demo.accent }}>
              {r}
            </li>
          ))}
        </ul>
      </CollapsibleSection>
    </aside>
  );
}
