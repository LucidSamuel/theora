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

      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 200ms ease',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div style={{ marginTop: 14 }}>
            {children}
          </div>
        </div>
      </div>
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
  elliptic: {
    concepts: [
      'Elliptic curve groups define addition geometrically, then reinterpret it over finite fields for cryptography.',
      'Scalar multiplication repeats addition with double-and-add, which is the workhorse behind commitments and signatures.',
      'Pairing-friendly and cycle-friendly curves matter because recursive proof systems need fields and curves to line up cleanly.',
    ],
    resources: ['Guide to Elliptic Curve Cryptography', 'Electric Coin Co. - The Pasta Curves'],
  },
  'fiat-shamir': {
    concepts: [
      'The transform hashes the full public transcript to derive the verifier challenge.',
      'If a message is omitted from the transcript, the prover may be able to bias or predict the challenge.',
      'This is a transcript-binding problem, not just a hash-function problem.',
    ],
    resources: ['Fiat-Shamir heuristic overview', 'zkSecurity - Frozen Heart style transcript bugs'],
  },
  circuit: {
    concepts: [
      'R1CS constraints take the form (A·w) * (B·w) = (C·w).',
      'A witness can satisfy some gates while still violating the full circuit if one relation is omitted.',
      'Underconstrained signals often come from assignments that never appear in a constraint.',
    ],
    resources: ['R1CS explained', 'Underconstrained circuit research and audit reports'],
  },
  lookup: {
    concepts: [
      'Lookup arguments prove that witness values belong to a fixed table of allowed values.',
      'Modern constructions reduce the problem to comparing multisets after sorting or permutation-style compression.',
      'This saves many bespoke constraints for range checks, byte decompositions, and table-heavy gadgets.',
    ],
    resources: ['Plookup paper', 'LogUp and modern lookup summaries'],
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
  elliptic: [
    { term: 'Point addition', definition: 'Group law combining two points into a third.' },
    { term: 'Scalar multiplication', definition: 'Repeated doubling and addition of one point.' },
    { term: 'Generator', definition: 'Base point used to span a subgroup.' },
  ],
  'fiat-shamir': [
    { term: 'Transcript', definition: 'Ordered list of messages seen so far.' },
    { term: 'Challenge', definition: 'Verifier randomness or its hashed replacement.' },
    { term: 'Forgery', definition: 'A proof assembled after exploiting a predictable challenge.' },
  ],
  circuit: [
    { term: 'Witness', definition: 'Concrete assignment to all circuit wires.' },
    { term: 'Constraint', definition: 'Equation that the witness must satisfy.' },
    { term: 'Underconstrained', definition: 'A signal can vary without violating the circuit.' },
  ],
  lookup: [
    { term: 'Table', definition: 'Allowed values committed by the circuit designer.' },
    { term: 'Wire value', definition: 'Witness entry that must match the table.' },
    { term: 'Multiset check', definition: 'Comparison proving both collections match with multiplicity.' },
  ],
};

const DEFAULT_NEXT_STEPS: Record<DemoId, string[]> = {
  merkle: ['Add a leaf', 'Generate a proof', 'Step through hashing'],
  polynomial: ['Adjust coefficients', 'Commit to the polynomial', 'Challenge and verify'],
  accumulator: ['Add primes', 'Select an element', 'Compute a witness'],
  recursive: ['Build a tree', 'Run auto-verify', 'Try IVC mode'],
  elliptic: ['Pick two points', 'Inspect the line and reflected sum', 'Step through scalar multiplication'],
  'fiat-shamir': ['Compare interactive mode', 'Switch to a broken transcript', 'Attempt the forged proof'],
  circuit: ['Adjust witness values', 'Toggle the broken circuit', 'Inspect which constraints fail'],
  lookup: ['Edit the lookup table', 'Add wire values', 'Check the multiset permutation result'],
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
