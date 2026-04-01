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

export const EXTRA_INFO: Record<DemoId, { concepts: string[]; resources: { label: string; url: string }[] }> = {
  pipeline: {
    concepts: [
      'A proof system chains primitives: computation → constraints → polynomial → commitment → challenge → opening → verification.',
      'Fiat-Shamir replaces the interactive verifier with a hash of the transcript, making the proof non-interactive.',
      'The quotient polynomial trick proves polynomial evaluation without revealing the polynomial itself.',
    ],
    resources: [
      { label: 'Vitalik – How do SNARKs work?', url: 'https://vitalik.eth.limo/general/2021/01/26/snarks.html' },
      { label: 'ZK Whiteboard Sessions – SNARK Anatomy', url: 'https://zkhack.dev/whiteboard/' },
    ],
  },
  merkle: {
    concepts: [
      'Domain separation: leaf hashes use 0x00 prefix, internal nodes use 0x01, preventing second-preimage attacks.',
      'Proof size is O(log n): for n leaves, a proof requires only log2(n) sibling hashes.',
      'Merkle proofs are used in Bitcoin SPV clients, Ethereum state tries, and certificate transparency logs.',
    ],
    resources: [
      { label: 'RFC 6962 – Certificate Transparency', url: 'https://datatracker.ietf.org/doc/html/rfc6962' },
      { label: 'Merkle Tree – Bitcoin Wiki', url: 'https://en.bitcoin.it/wiki/Merkle_tree' },
    ],
  },
  polynomial: {
    concepts: [
      'KZG commitments use a trusted setup to generate structured reference strings (SRS) on elliptic curves.',
      'The binding property ensures the committer cannot open to a different polynomial later.',
      'Polynomial commitments are the backbone of PlonK, Marlin, and EIP-4844 (proto-danksharding).',
    ],
    resources: [
      { label: 'KZG10 – Kate, Zaverucha, Goldberg (IACR)', url: 'https://www.iacr.org/archive/asiacrypt2010/6477178/6477178.pdf' },
      { label: 'Dankrad Feist – KZG Polynomial Commitments', url: 'https://dankradfeist.de/ethereum/2020/06/16/kate-polynomial-commitments.html' },
    ],
  },
  accumulator: {
    concepts: [
      "The RSA accumulator relies on the Strong RSA assumption: given n and a random y, it's hard to find x and e>1 such that x^e = y mod n.",
      'Non-membership proofs are also possible using Bezout coefficients from the extended GCD.',
      'Accumulators are used in anonymous credentials, stateless blockchains, and revocation systems.',
    ],
    resources: [
      { label: 'Boneh et al. – Batching Techniques for RSA', url: 'https://crypto.stanford.edu/~dabo/papers/RSAgroup.pdf' },
      { label: 'Ozcelik et al. – Accumulators Survey (IACR)', url: 'https://eprint.iacr.org/2019/394' },
    ],
  },
  recursive: {
    concepts: [
      'The Pasta curves (Pallas and Vesta) have a special cycle: the scalar field of one equals the base field of the other.',
      'IVC (Incremental Verifiable Computation) compresses a chain of N computations into a single constant-size proof.',
      'Nova achieves folding without SNARKs for each step, only requiring a final SNARK at the end.',
    ],
    resources: [
      { label: 'Nova: Recursive SNARKs without SNARKs (IACR)', url: 'https://eprint.iacr.org/2021/370' },
      { label: 'Halo: Recursive Proof Composition (IACR)', url: 'https://eprint.iacr.org/2019/1021' },
    ],
  },
  elliptic: {
    concepts: [
      'Elliptic curve groups define addition geometrically, then reinterpret it over finite fields for cryptography.',
      'Scalar multiplication repeats addition with double-and-add, which is the workhorse behind commitments and signatures.',
      'Pairing-friendly and cycle-friendly curves matter because recursive proof systems need fields and curves to line up cleanly.',
    ],
    resources: [
      { label: 'Guide to Elliptic Curve Cryptography', url: 'https://link.springer.com/book/9780387952734' },
      { label: 'Electric Coin Co. – The Pasta Curves', url: 'https://electriccoin.co/blog/the-pasta-curves-for-halo-2-and-beyond/' },
    ],
  },
  'fiat-shamir': {
    concepts: [
      'The transform hashes the full public transcript to derive the verifier challenge.',
      'If a message is omitted from the transcript, the prover may be able to bias or predict the challenge.',
      'This is a transcript-binding problem, not just a hash-function problem.',
    ],
    resources: [
      { label: 'Fiat & Shamir – How To Prove Yourself (CRYPTO \'86)', url: 'https://link.springer.com/chapter/10.1007/3-540-47721-7_12' },
      { label: 'zkSecurity – Frozen Heart Transcript Bugs', url: 'https://www.zksecurity.xyz/blog/posts/frozen-heart/' },
    ],
  },
  circuit: {
    concepts: [
      'R1CS constraints take the form (A·w) * (B·w) = (C·w).',
      'A witness can satisfy some gates while still violating the full circuit if one relation is omitted.',
      'Underconstrained signals often come from assignments that never appear in a constraint.',
    ],
    resources: [
      { label: '0xPARC – R1CS Explainer', url: 'https://learn.0xparc.org/materials/circom/learning-group-1/r1cs-explainer/' },
      { label: '0xPARC – ZK Bug Tracker (Underconstrained)', url: 'https://github.com/0xPARC/zk-bug-tracker' },
    ],
  },
  lookup: {
    concepts: [
      'Lookup arguments prove that witness values belong to a fixed table of allowed values.',
      'Modern constructions reduce the problem to comparing multisets after sorting or permutation-style compression.',
      'This saves many bespoke constraints for range checks, byte decompositions, and table-heavy gadgets.',
    ],
    resources: [
      { label: 'Plookup – Gabizon & Williamson (IACR)', url: 'https://eprint.iacr.org/2020/315' },
      { label: 'LogUp – Modern Lookup Arguments (IACR)', url: 'https://eprint.iacr.org/2022/1530' },
    ],
  },
  pedersen: {
    concepts: [
      'A Pedersen commitment C = g^v · h^r mod p is perfectly hiding: given only C, every value v is equally likely regardless of the adversary\'s computing power.',
      'Binding relies on the discrete logarithm assumption: the committer cannot find two pairs (v, r) and (v\u2019, r\u2019) with the same commitment without computing log_g(h).',
      'The additive homomorphic property — C(v₁, r₁) · C(v₂, r₂) = C(v₁+v₂, r₁+r₂) — underlies many zero-knowledge proofs and confidential transaction schemes.',
    ],
    resources: [
      { label: 'Pedersen – Non-Interactive and Information-Theoretic Secure VSS (CRYPTO \'91)', url: 'https://link.springer.com/chapter/10.1007/3-540-46766-1_9' },
      { label: 'Boneh & Shoup – A Graduate Course in Applied Cryptography (Ch. 11)', url: 'https://toc.cryptobook.us/' },
    ],
  },
  plonk: {
    concepts: [
      'PLONK gates use five selector polynomials (qL, qR, qO, qM, qC) so every gate — add, multiply, constant — is a specialisation of one equation.',
      'Copy constraints are enforced via a permutation argument: the prover shows that wire values at different gate positions are equal by embedding them in a grand-product check.',
      'PlonKish systems (UltraPLONK, Halo2) extend the basic gate with custom gates and lookup arguments for efficient specialised operations.',
    ],
    resources: [
      { label: 'PLONK: Permutations over Lagrange-bases (IACR)', url: 'https://eprint.iacr.org/2019/953' },
      { label: 'Vitalik – Understanding PLONK', url: 'https://vitalik.eth.limo/general/2019/09/22/plonk.html' },
    ],
  },
  groth16: {
    concepts: [
      'Groth16 achieves O(1) proof size and verifier time: the proof is exactly three elliptic-curve group elements (A, B, C), regardless of circuit size.',
      'The trusted setup produces a circuit-specific CRS; the toxic waste must be destroyed — any leakage allows forging proofs for that circuit.',
      'The pairing equation e(A, B) = e(α, β) · e(Σ, γ) · e(C, δ) ties the wire assignments to the QAP and prevents malicious proofs.',
    ],
    resources: [
      { label: 'Groth – On the Size of Pairing-based Non-interactive Arguments (IACR)', url: 'https://eprint.iacr.org/2016/260' },
      { label: 'Nitpick – Groth16 Explained', url: 'https://www.zeroknowledgeblog.com/index.php/groth16' },
    ],
  },
  'split-accumulation': {
    concepts: [
      'Naive recursive verification embeds a full multi-scalar multiplication (MSM) at every step, making the verifier circuit enormous.',
      'Split accumulation defers the MSM into a running accumulator via cheap random linear combinations (~10 field ops per fold).',
      'A single final MSM settles all deferred work, making total cost O(n·fieldOps + MSM) instead of O(n·MSM).',
    ],
    resources: [
      { label: 'Halo: Recursive Proof Composition (IACR)', url: 'https://eprint.iacr.org/2019/1021' },
      { label: 'Nova: Recursive SNARKs without SNARKs (IACR)', url: 'https://eprint.iacr.org/2021/370' },
    ],
  },
  rerandomization: {
    concepts: [
      'Rerandomization changes every byte of a proof transcript while preserving the statement and verifier acceptance.',
      'This breaks trivial linkability based on proof bytes, commitment openings, or transcript hashes.',
      'The security goal is not hiding the statement — it is hiding whether two presentations came from the same prior proof.',
    ],
    resources: [
      { label: 'Bowe, Gabizon, Green – A Formal Treatment of Rerandomized Proofs', url: 'https://eprint.iacr.org/' },
      { label: 'Halo 2 Book – Transcript and commitments', url: 'https://zcash.github.io/halo2/' },
    ],
  },
  'oblivious-sync': {
    concepts: [
      'The wallet blinds nullifiers before sending them to the remote service, so the server never sees raw note identifiers.',
      'The service proves a set relation over the blinded batch, typically disjointness from the spent set.',
      'This is a privacy-preserving sync pattern: the wallet learns whether any note is spent without revealing which notes it owns.',
    ],
    resources: [
      { label: 'Privacy-preserving sync – Oblivious transfer foundations', url: 'https://eprint.iacr.org/' },
    ],
  },
  'constraint-counter': {
    concepts: [
      'Pedersen commitments are useful, but Pedersen hashing is relatively expensive inside zk circuits because it expands to many fixed-base scalar operations.',
      'Poseidon is designed to be arithmetization-friendly, so the same Merkle structure costs far fewer constraints.',
      'Merkle costs compound linearly along authentication paths and exponentially over full-tree construction, so per-hash savings matter a lot.',
    ],
    resources: [
      { label: 'Poseidon hash paper (IACR)', url: 'https://eprint.iacr.org/2019/458' },
      { label: 'Halo 2 gadgets – Why Poseidon replaced Pedersen for Merkle paths', url: 'https://zcash.github.io/halo2/' },
    ],
  },
};

export const MINI_GLOSSARY: Record<DemoId, { term: string; definition: string }[]> = {
  pipeline: [
    { term: 'R1CS', definition: 'Rank-1 constraint system encoding a computation.' },
    { term: 'Commitment', definition: 'Binding hash of polynomial coefficients.' },
    { term: 'Quotient', definition: 'Proof that (x−z) divides (p(x)−p(z)).' },
  ],
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
  pedersen: [
    { term: 'Hiding', definition: 'The commitment reveals nothing about the committed value.' },
    { term: 'Binding', definition: 'The committer cannot open to a different value later.' },
    { term: 'Homomorphic', definition: 'Commitments compose: C(a)·C(b) = C(a+b).' },
  ],
  plonk: [
    { term: 'Selector', definition: 'A polynomial that activates or silences a term in the gate equation.' },
    { term: 'Copy constraint', definition: 'An equality requirement between wire values at different gate positions.' },
    { term: 'Permutation', definition: 'The grand-product argument that enforces all copy constraints together.' },
  ],
  groth16: [
    { term: 'QAP', definition: 'Quadratic arithmetic program encoding the circuit as polynomial equations.' },
    { term: 'CRS', definition: 'Common reference string produced by a circuit-specific trusted setup.' },
    { term: 'Pairing', definition: 'Bilinear map used to check the proof equation without revealing inputs.' },
  ],
  'split-accumulation': [
    { term: 'MSM', definition: 'Multi-scalar multiplication — the expensive operation deferred by accumulation.' },
    { term: 'Fold', definition: 'Random linear combination that merges a new claim into the accumulator.' },
    { term: 'Settlement', definition: 'The single final MSM that verifies all accumulated claims at once.' },
  ],
  rerandomization: [
    { term: 'Transcript', definition: 'The byte-level record of commitments, openings, and proof messages.' },
    { term: 'Unlinkability', definition: 'Two valid proofs cannot be correlated just by comparing their bytes.' },
    { term: 'Rerandomizer', definition: 'Fresh randomness used to blind the existing proof transcript.' },
  ],
  'oblivious-sync': [
    { term: 'Nullifier', definition: 'A note identifier that reveals whether a note has been spent.' },
    { term: 'Blinding', definition: 'Masking the nullifier before it leaves the wallet.' },
    { term: 'Disjointness proof', definition: 'A proof that two sets do not intersect without revealing the sets themselves.' },
  ],
  'constraint-counter': [
    { term: 'Constraint', definition: 'One arithmetic relation that the prover must satisfy inside the circuit.' },
    { term: 'Merkle path', definition: 'The sequence of hashes from one leaf up to the root.' },
    { term: 'Arithmetization-friendly hash', definition: 'A hash designed to minimize circuit cost, such as Poseidon.' },
  ],
};

export const DEFAULT_NEXT_STEPS: Record<DemoId, string[]> = {
  pipeline: ['Step through all 7 stages', 'Inject a bad witness fault', 'Try weak Fiat-Shamir'],
  merkle: ['Add a leaf', 'Generate a proof', 'Step through hashing'],
  polynomial: ['Adjust coefficients', 'Commit to the polynomial', 'Challenge and verify'],
  accumulator: ['Add primes', 'Select an element', 'Compute a witness'],
  recursive: ['Build a tree', 'Run auto-verify', 'Try IVC mode'],
  'split-accumulation': ['Step through all recursive steps', 'Compare naive vs accumulated cost', 'Settle the accumulator'],
  rerandomization: ['Rerandomize the same proof again', 'Try the matching game', 'Compare changed bytes across components'],
  'oblivious-sync': ['Step through every protocol round', 'Inject a spent-note collision', 'Compare what wallet vs service learns'],
  elliptic: ['Pick two points', 'Inspect the line and reflected sum', 'Step through scalar multiplication'],
  'fiat-shamir': ['Compare interactive mode', 'Switch to a broken transcript', 'Attempt the forged proof'],
  circuit: ['Adjust witness values', 'Toggle the broken circuit', 'Inspect which constraints fail'],
  lookup: ['Edit the lookup table', 'Add wire values', 'Check the multiset permutation result'],
  pedersen: ['Set a value and commit', 'Toggle the blinding factor reveal', 'Try homomorphic addition'],
  'constraint-counter': ['Raise the tree depth', 'Compare path cost against full-tree cost', 'Use the ratio to explain why Poseidon wins in Merkle circuits'],
  plonk: ['Inspect gate selectors', 'Trace the copy constraints', 'Add a custom gate'],
  groth16: ['Step through the QAP encoding', 'Inspect the trusted setup output', 'Verify the pairing equation'],
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
      className="hidden lg:flex flex-col h-full overflow-y-auto py-5 px-5 border-l panel-surface"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--bg-primary)',
        width: 288,
        padding: '24px 20px 32px',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <h3 className="text-[11px] font-bold uppercase tracking-wider mb-2 font-display" style={{ color: demo.accent }}>
        About {demo.title}
      </h3>
      <p className="text-xs leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
        {demo.description}
      </p>

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

      <CollapsibleSection title="Key Concepts" accent="var(--text-muted)" defaultOpen>
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
            <li key={i}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12,
                  color: demo.accent,
                  textDecoration: 'none',
                  borderBottom: `1px solid transparent`,
                  paddingBottom: 1,
                  transition: 'border-color 120ms ease',
                  display: 'inline',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.borderBottomColor = demo.accent)}
                onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.borderBottomColor = 'transparent')}
              >
                {r.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </CollapsibleSection>
    </aside>
  );
}
