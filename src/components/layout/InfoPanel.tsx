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

function CollapsibleSection({ title, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        paddingTop: 18,
        paddingBottom: 18,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <span
          className="text-[10px] font-bold uppercase"
          style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
        >
          {title}
        </span>
        <span
          className="text-[10px]"
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            display: 'inline-block',
            transition: 'transform 150ms ease',
          }}
        >
          ▸
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          {children}
        </div>
      )}
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
      "The RSA accumulator relies on the Strong RSA assumption: given n and a random y, it's hard to find x and e>1 such that x^e = y mod n.",
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
      className="hidden lg:flex flex-col h-full overflow-y-auto border-l"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--bg-primary)',
        width: 288,
        padding: '24px 20px 32px',
      }}
    >
      {/* Demo title + description */}
      <div style={{ paddingBottom: 20, marginBottom: 2 }}>
        <h3
          className="text-[10px] font-bold uppercase font-display"
          style={{ color: demo.accent, letterSpacing: '0.1em', marginBottom: 10 }}
        >
          About {demo.title}
        </h3>
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}
        >
          {demo.description}
        </p>
      </div>

      {/* Collapsible sections */}
      {contextEntry && (
        <CollapsibleSection title="Live Context" accent="var(--text-muted)" defaultOpen>
          <div
            className="rounded-lg"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              padding: '12px 14px',
            }}
          >
            <div
              className="text-[11px] font-semibold"
              style={{ color: demo.accent, marginBottom: 6 }}
            >
              {contextEntry.title}
            </div>
            <div
              className="text-[12px] leading-relaxed"
              style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}
            >
              {contextEntry.body}
            </div>
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Suggested Next" accent="var(--text-muted)" defaultOpen>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {nextSteps.map((step, i) => (
            <li
              key={i}
              style={{
                fontSize: 12,
                lineHeight: 1.55,
                color: 'var(--text-secondary)',
                paddingLeft: 12,
                borderLeft: `2px solid ${demo.accent}`,
              }}
            >
              {step}
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Key Concepts" accent="var(--text-muted)">
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {extra.concepts.map((c, i) => (
            <li
              key={i}
              style={{
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--text-secondary)',
                paddingLeft: 12,
                borderLeft: `2px solid ${demo.accent}`,
              }}
            >
              {c}
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Mini Glossary" accent="var(--text-muted)">
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {glossary.map((item, i) => (
            <li key={i} style={{ fontSize: 12, lineHeight: 1.55 }}>
              <span style={{ fontWeight: 600, color: demo.accent }}>{item.term}</span>
              <span style={{ color: 'var(--text-secondary)' }}> — {item.definition}</span>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Further Reading" accent="var(--text-muted)">
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {extra.resources.map((r, i) => (
            <li key={i} style={{ fontSize: 12, color: demo.accent }}>
              {r}
            </li>
          ))}
        </ul>
      </CollapsibleSection>
    </aside>
  );
}
