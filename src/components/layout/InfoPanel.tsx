import { useId, useState } from 'react';
import { DEMOS, type DemoId } from '@/types';
import { useInfoPanel, type SecurityState } from './InfoContext';

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
  const sectionId = useId();
  const buttonId = `${sectionId}-button`;
  const panelId = `${sectionId}-panel`;
  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        paddingTop: 18,
        paddingBottom: 18,
      }}
    >
      <button
        id={buttonId}
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left"
        aria-expanded={open}
        aria-controls={panelId}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
      >
        <span
          className="text-[10px] font-bold uppercase"
          style={{ color: accent, letterSpacing: '0.1em' }}
        >
          {title}
        </span>
        <span
          className="text-[10px]"
          style={{
            color: accent,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            display: 'inline-block',
            transition: 'transform 150ms ease',
          }}
        >
          ▸
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
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

interface SecurityParamsEntry {
  demoField: string;
  productionField: string;
  comparisons: string[];
}

/** Compute soundness error bounds from live demo state. */
function computeSoundnessErrors(state: SecurityState): { demoError: string; productionError: string; formula: string } | null {
  const p = state.fieldSize;
  const d = state.degree ?? 1;

  // FRI: error ≤ (d/|F|)^Q per query repetition
  if (state.numQueries != null) {
    const ratio = d / Number(p);
    const demoErr = ratio ** state.numQueries;
    const prodRatio = d / 2 ** 255;
    const prodErr = prodRatio ** state.numQueries;
    return {
      formula: `(d/|F|)^Q = (${d}/${p})^${state.numQueries}`,
      demoError: demoErr < 0.001 ? demoErr.toExponential(2) : demoErr.toFixed(4),
      productionError: `\u2248 2^{${Math.round(Math.log2(prodErr))}}`,
    };
  }

  // Sumcheck / GKR: error ≤ n·d / |F| per round (union bound)
  if (state.numRounds != null) {
    const rounds = state.numRounds;
    const demoErr = (rounds * d) / Number(p);
    const prodBits = Math.round(Math.log2(Number(p))) >= 64 ? 254 : 254;
    return {
      formula: `n\u00B7d/|F| = ${rounds}\u00B7${d}/${p}`,
      demoError: demoErr < 0.001 ? demoErr.toExponential(2) : demoErr.toFixed(4),
      productionError: `\u2248 2^{${Math.round(Math.log2(rounds * d) - prodBits)}}`,
    };
  }

  // GKR with layers: total error ≤ layers · (sumcheck rounds per layer) · d / |F|
  if (state.numLayers != null) {
    const layers = state.numLayers;
    const roundsPerLayer = Math.ceil(Math.log2(8)); // typical gate fan-in bits
    const totalRounds = layers * roundsPerLayer;
    const demoErr = (totalRounds * d) / Number(p);
    return {
      formula: `layers\u00B7rounds\u00B7d/|F| \u2248 ${layers}\u00B7${roundsPerLayer}\u00B7${d}/${p}`,
      demoError: demoErr < 0.001 ? demoErr.toExponential(2) : demoErr.toFixed(4),
      productionError: `\u2248 2^{${Math.round(Math.log2(totalRounds * d) - 254)}}`,
    };
  }

  return null;
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
  sumcheck: {
    concepts: [
      'The sumcheck protocol reduces checking a sum over 2^n hypercube points to a single oracle evaluation, using n rounds with one univariate polynomial each.',
      'At each round i, the prover sends g_i(x) and the verifier checks g_i(0)+g_i(1) equals the running expected sum before issuing a fresh challenge r_i.',
      'If the prover lies about the sum, the oracle query at the end will disagree with the final round polynomial with overwhelming probability (by Schwartz-Zippel).',
    ],
    resources: [
      { label: 'Proofs, Arguments, and Zero-Knowledge (Ch. 4) – Justin Thaler', url: 'https://people.cs.georgetown.edu/jthaler/ProofsArgsAndZK.pdf' },
      { label: 'Sumcheck protocol – ZKProof Community Reference', url: 'https://zkproof.org/2020/03/16/introduction-into-sum-check-protocol/' },
    ],
  },
  fri: {
    concepts: [
      'FRI proves a function is close to a low-degree polynomial by halving the evaluation domain in each round.',
      'Each round uses a random challenge alpha to fold f(x) into f_even(x\u00b2) + alpha\u00b7f_odd(x\u00b2), halving the degree.',
      'After log\u2082(n) rounds, only a constant remains. Query phase verifies folding consistency at random positions.',
    ],
    resources: [
      { label: 'STARK Math \u2014 Anatomy of a STARK, Part 3 (Starkware)', url: 'https://starkware.co/stark-math/' },
      { label: 'FRI-based Polynomial Commitments (Ulrich Hab\u00f6ck)', url: 'https://eprint.iacr.org/2022/1216' },
    ],
  },
  nova: {
    concepts: [
      'Relaxed R1CS extends standard R1CS with a scalar u and error vector E: Az \u2218 Bz = u\u00B7Cz + E.',
      'Folding compresses two instances into one using a random challenge r: W\u2019 = W\u2081 + r\u00B7W\u2082, E\u2019 = E\u2081 + r\u00B7T + r\u00B2\u00B7E\u2082.',
      'The cross-term T captures the "interaction" between instances \u2014 it makes folding algebraically sound.',
    ],
    resources: [
      { label: 'Nova: Recursive Zero-Knowledge Arguments from Folding Schemes (Kothapalli et al.)', url: 'https://eprint.iacr.org/2021/370' },
      { label: 'Nova and beyond \u2014 Microsoft Research', url: 'https://www.microsoft.com/en-us/research/blog/nova/' },
    ],
  },
  mle: {
    concepts: [
      'A multilinear extension uniquely extends f:{0,1}^n \u2192 F to a degree-1-per-variable polynomial over F^n.',
      'The eq basis eq(r,v) = \u03A0_i (v_i\u00B7r_i + (1-v_i)\u00B7(1-r_i)) is the multilinear Lagrange basis.',
      'Partial evaluation fixes variables one at a time, reducing the hypercube dimension \u2014 this is exactly what sumcheck does.',
    ],
    resources: [
      { label: 'Proofs, Arguments, and Zero-Knowledge \u2014 Ch. 4 (Justin Thaler)', url: 'https://people.cs.georgetown.edu/jthaler/ProofsArgsAndZK.html' },
    ],
  },
  gkr: {
    concepts: [
      'GKR reduces verifying a layered circuit output to checking input values, one layer at a time via sumcheck.',
      'At each layer, the verifier checks V_i(r) = \u03A3 add_i(r,x,y)\u00B7(V_{i+1}(x)+V_{i+1}(y)) + mul_i(r,x,y)\u00B7V_{i+1}(x)\u00B7V_{i+1}(y).',
      'The prover does O(S\u00B7log(S)) work per layer; the verifier does O(n\u00B7log(n)) total \u2014 exponentially faster than re-executing.',
    ],
    resources: [
      { label: 'Proofs, Arguments, and Zero-Knowledge \u2014 Ch. 4.6 (Justin Thaler)', url: 'https://people.cs.georgetown.edu/jthaler/ProofsArgsAndZK.html' },
      { label: 'Delegating Computation (Goldwasser, Kalai, Rothblum)', url: 'https://eprint.iacr.org/2018/601' },
    ],
  },
  'constraint-editor': {
    concepts: [
      'An R1CS constraint has the form A\u00b7w \u00d7 B\u00b7w = C\u00b7w \u2014 one multiplication of linear combinations per constraint.',
      'A circuit is underconstrained when some wire value is not uniquely determined by the inputs; the prover can then choose it freely and prove false statements.',
      'Exhaustive checking over a toy field enumerates every input assignment \u2014 a luxury impossible over 2\u00b2\u2075\u2075-element production fields, where formal tools take its place.',
    ],
    resources: [
      { label: 'Circom documentation \u2014 constraint generation', url: 'https://docs.circom.io/circom-language/constraint-generation/' },
      { label: 'Chaliasos et al. \u2014 SoK: What don\u2019t we know? Understanding Security Vulnerabilities in SNARKs', url: 'https://arxiv.org/abs/2402.15293' },
    ],
  },
  'proof-trace': {
    concepts: [
      'A transcript records every message of a proof execution: absorbs, challenges, commitments, folds, queries, and checks.',
      'Hashing a canonical serialization of the transcript yields a fingerprint that identifies the exact interaction \u2014 any change to any message changes it.',
      'The same idea powers Fiat-Shamir: challenges are derived by hashing the transcript so far, binding the prover to its earlier messages.',
    ],
    resources: [
      { label: 'Fiat-Shamir transform (Wikipedia)', url: 'https://en.wikipedia.org/wiki/Fiat%E2%80%93Shamir_heuristic' },
      { label: 'Merlin transcripts \u2014 composable proof transcripts', url: 'https://merlin.cool/' },
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
  sumcheck: [
    { term: 'Boolean hypercube', definition: '{0,1}^n — the set of all binary assignments to n variables.' },
    { term: 'Round polynomial', definition: 'g_i(x): univariate polynomial the prover sends in round i.' },
    { term: 'Oracle query', definition: 'The final verifier call to evaluate f at (r_1,…,r_n) to confirm the last round.' },
  ],
  fri: [
    { term: 'Evaluation domain', definition: 'Powers of a root of unity \u03c9 \u2014 the points where the polynomial is evaluated.' },
    { term: 'Fold challenge', definition: 'Random \u03b1 from the verifier: f\u2032(x) = f_even(x) + \u03b1\u00b7f_odd(x).' },
    { term: 'Query consistency', definition: 'Checking that f(x), f(-x), and the folded value agree at random positions.' },
    { term: 'IOPP', definition: 'Interactive Oracle Proof of Proximity \u2014 FRI proves closeness to RS codes.' },
  ],
  nova: [
    { term: 'Relaxed R1CS', definition: 'Az \u2218 Bz = u\u00B7Cz + E \u2014 generalizes standard R1CS (u=1, E=0).' },
    { term: 'Cross-term T', definition: 'Az\u2081\u2218Bz\u2082 + Az\u2082\u2218Bz\u2081 \u2212 u\u2081\u00B7Cz\u2082 \u2212 u\u2082\u00B7Cz\u2081 \u2014 captures interaction.' },
    { term: 'Folding challenge', definition: 'Random r from the verifier: z\u2019 = z\u2081 + r\u00B7z\u2082.' },
    { term: 'IVC', definition: 'Incrementally Verifiable Computation \u2014 each step proves all prior steps.' },
  ],
  mle: [
    { term: 'Boolean hypercube', definition: '{0,1}^n \u2014 the 2^n binary points where f is defined.' },
    { term: 'eq basis', definition: 'eq(r,v) = \u03A0_i (v_i\u00B7r_i + (1-v_i)(1-r_i)) \u2014 multilinear Lagrange basis.' },
    { term: 'Multilinear', definition: 'Degree at most 1 in each variable individually.' },
    { term: 'Partial evaluation', definition: 'Fix some variables to field values, reducing the dimension.' },
  ],
  gkr: [
    { term: 'Layered circuit', definition: 'Circuit where gates at layer i only take inputs from layer i+1.' },
    { term: 'Wiring predicate', definition: 'add_i(g,x,y) / mul_i(g,x,y) \u2014 encodes circuit structure as MLEs.' },
    { term: 'Layer reduction', definition: 'Sumcheck reduces a claim about V_i to a claim about V_{i+1}.' },
    { term: 'Oracle query', definition: 'Final check: evaluate input MLE at the reduced point.' },
  ],
  'constraint-editor': [
    { term: 'R1CS', definition: 'Rank-1 constraint system: every constraint is one multiplication of linear combinations of wires.' },
    { term: 'Underconstrained wire', definition: 'A wire whose value is not pinned down by the constraints \u2014 the prover picks it freely.' },
    { term: 'Witness', definition: 'The full assignment of values to every wire, including intermediates.' },
  ],
  'proof-trace': [
    { term: 'Transcript', definition: 'The ordered sequence of messages exchanged during one proof execution.' },
    { term: 'Fiat–Shamir transform', definition: 'Deriving verifier challenges by hashing the transcript, removing interaction.' },
    { term: 'Fingerprint', definition: 'Deterministic visual derived from the transcript hash — an identicon for a proof run.' },
  ],
};

export const SECURITY_PARAMS: Record<DemoId, SecurityParamsEntry | null> = {
  pipeline: {
    demoField: 'Toy field (configurable)',
    productionField: 'BN254 / BLS12-381 scalar field (~2\u00B2\u2075\u2074 elements)',
    comparisons: [
      'Demo: all operations over small primes where discrete log is trivial.',
      'Production: 254-bit prime fields backed by elliptic curve pairings. Discrete log takes longer than the age of the universe.',
      'Protocol structure is identical — only field size differs.',
    ],
  },
  merkle: {
    demoField: 'SHA-256 truncated to hex display',
    productionField: 'SHA-256 / Poseidon (256-bit output)',
    comparisons: [
      'Demo uses real SHA-256 — hash security is production-grade.',
      'Collision resistance: ~2\u00B9\u00B2\u2078 operations (128-bit security).',
      'In-circuit Merkle proofs replace SHA-256 with Poseidon (~63 R1CS vs ~25,210).',
    ],
  },
  polynomial: {
    demoField: 'Plain-number polynomial math + SHA-256 stand-in commitment',
    productionField: 'KZG over BLS12-381 / BN254 scalar field (~2\u00B2\u2075\u2075 elements)',
    comparisons: [
      'Demo: coefficients, evaluations, and quotient polynomial are shown directly; the “commitment” is a simplified hash of the coefficients.',
      'Production: the commitment is an elliptic-curve point [p(\u03C4)] built from a trusted setup over a 255-bit field.',
      'The opening flow is still structurally right: commit, sample z, reveal p(z), then prove divisibility with the quotient polynomial.',
    ],
  },
  accumulator: {
    demoField: 'RSA modulus: ~2\u2076\u2070 (two 30-bit primes)',
    productionField: 'RSA modulus: 2048-bit or larger',
    comparisons: [
      'Demo: n = p\u00B7q with p,q \u2248 10\u2079. Factorable in milliseconds.',
      'Production: 2048-bit RSA modulus. Factoring would take billions of years.',
      'Strong RSA assumption holds structurally in both — only hardness differs.',
    ],
  },
  recursive: {
    demoField: 'Simplified Pallas/Vesta cycle visualization',
    productionField: 'Pallas: ~2\u00B2\u2075\u2075 base, Vesta: ~2\u00B2\u2075\u2075 base',
    comparisons: [
      'Demo: illustrates the cycle-of-curves structure without real curve arithmetic.',
      'Production: each scalar multiplication = 255 doublings + ~128 additions.',
      'IVC security: 128-bit from the curve cycle. Demo shows protocol flow, not hardness.',
    ],
  },
  elliptic: {
    demoField: 'y\u00B2 = x\u00B3 + ax + b over GF(97) (97 elements)',
    productionField: 'Pallas/Vesta: y\u00B2 = x\u00B3 + 5 over ~2\u00B2\u2075\u2075-element field',
    comparisons: [
      'Demo: all ~100 curve points visible and enumerable. ECDLP solvable by brute force.',
      'Production: ~2\u00B2\u2075\u2075 points. ECDLP requires ~2\u00B9\u00B2\u2078 group operations (128-bit security).',
      'Point addition geometry is identical — the group law does not change with field size.',
    ],
  },
  'fiat-shamir': {
    demoField: 'GF(97) — 97 elements, generator g = 7',
    productionField: 'BN254 scalar field (~2\u00B2\u2075\u2074 elements)',
    comparisons: [
      'Demo: discrete log in GF(97) solvable in microseconds by exhaustive search.',
      'Production: discrete log over a 254-bit prime field is computationally infeasible.',
      'Transcript-binding security is structural — the Fiat-Shamir bug patterns are real regardless of field size.',
    ],
  },
  circuit: {
    demoField: 'Optional field (0 = integers, or small configurable prime)',
    productionField: 'BN254 / Pasta scalar field (~2\u00B2\u2075\u2074 elements)',
    comparisons: [
      'Demo: constraint satisfaction is checkable by hand over small fields.',
      'Production: witness satisfiability is checked over 254-bit fields inside the prover.',
      'Underconstrained bugs are field-size-independent — they exist at any scale.',
    ],
  },
  lookup: {
    demoField: 'Small configurable table and field',
    productionField: 'Tables up to 2\u00B2\u2070 rows over ~2\u00B2\u2075\u2074 field',
    comparisons: [
      'Demo: table is small enough to inspect every entry visually.',
      'Production: LogUp soundness error \u2248 table_size / |F| \u2248 2\u00B2\u2070/2\u00B2\u2075\u2074 \u2248 2\u207B\u00B2\u00B3\u2074.',
      'Multiset check structure is identical at any scale.',
    ],
  },
  pedersen: {
    demoField: 'Z*\u2089\u2087 — p = 97, g = 5, h = 47',
    productionField: 'Jubjub / Pallas curve group (~2\u00B2\u2075\u2075 elements)',
    comparisons: [
      'Demo: log\u2085(47) = 39 mod 96 is trivially computable. Binding is broken.',
      'Production: computing log_g(h) on a 255-bit curve is infeasible (128-bit security).',
      'Hiding is perfect at any field size. Binding requires the DLP to be hard.',
    ],
  },
  plonk: {
    demoField: 'GF(101) — 101 elements',
    productionField: 'BN254 scalar field (~2\u00B2\u2075\u2074 elements)',
    comparisons: [
      'Demo: all 101 field elements visible. Polynomial identity testing over GF(101) has error \u2248 d/101.',
      'Production: Schwartz-Zippel error \u2248 d/2\u00B2\u2075\u2074 \u2248 negligible for any practical degree d.',
      'Gate structure (qL\u00B7a + qR\u00B7b + qO\u00B7c + qM\u00B7a\u00B7b + qC = 0) is field-independent.',
    ],
  },
  groth16: {
    demoField: 'GF(101) — 101 elements',
    productionField: 'BN254 scalar field (~2\u00B2\u2075\u2074), BN254 curve for pairings',
    comparisons: [
      'Demo: "pairings" are g^(ab) mod 101 — no real bilinear map.',
      'Production: e(g\u00B9, g\u00B2) on BN254 with 128-bit security. Proof is 3 curve elements (192 bytes).',
      'QAP structure and trusted setup ceremony are structurally identical.',
    ],
  },
  sumcheck: {
    demoField: 'GF(101) — 101 elements',
    productionField: 'Goldilocks (2\u2076\u2074 \u2212 2\u00B3\u00B2 + 1) or BN254 scalar field',
    comparisons: [
      'Demo: soundness error per round = d/101 where d is the polynomial degree.',
      'Production: soundness error per round = d/2\u2076\u2074 or d/2\u00B2\u2075\u2074 — negligible.',
      'Total protocol error over n rounds: \u2264 n\u00B7d/|F|. Demo makes this ratio visible.',
    ],
  },
  fri: {
    demoField: 'GF(257) — 257 elements, \u03C9 = 3 (256th root of unity)',
    productionField: 'Goldilocks field (2\u2076\u2074 \u2212 2\u00B3\u00B2 + 1) or BabyBear (2\u00B3\u00B9 \u2212 2\u00B2\u2077 + 1)',
    comparisons: [
      'Demo: 256-point evaluation domain. All folding steps visible.',
      'Production: domains of 2\u00B2\u2070\u207A points. FRI proximity gap gives ~100-bit soundness.',
      'Folding mechanics (f\u2032(x) = f_even(x) + \u03B1\u00B7f_odd(x)) are identical at any scale.',
    ],
  },
  nova: {
    demoField: 'GF(101) — 101 elements',
    productionField: 'Pasta scalar field (~2\u00B2\u2075\u2075 elements)',
    comparisons: [
      'Demo: folding with r \u2208 GF(101). Cross-term T visible in small field.',
      'Production: r is a 255-bit random challenge. Folding soundness \u2248 1/2\u00B2\u2075\u2075 per step.',
      'Relaxed R1CS structure (Az \u2218 Bz = u\u00B7Cz + E) is field-independent.',
    ],
  },
  mle: {
    demoField: 'GF(101) — 101 elements (configurable)',
    productionField: 'Goldilocks or BN254 scalar field',
    comparisons: [
      'Demo: hypercube {0,1}^n evaluations mod 101. All eq-basis weights visible.',
      'Production: same multilinear extension formula over 64-bit or 254-bit fields.',
      'MLE uniqueness and partial evaluation properties are field-size-independent.',
    ],
  },
  gkr: {
    demoField: 'GF(101) — 101 elements',
    productionField: 'Goldilocks or BN254 scalar field',
    comparisons: [
      'Demo: layer reduction via sumcheck over GF(101). All intermediate values visible.',
      'Production: sumcheck soundness error per layer \u2248 d/|F| — negligible over large fields.',
      'Circuit wiring predicates and layer structure are field-independent.',
    ],
  },
  'split-accumulation': {
    demoField: 'Simplified MSM cost model',
    productionField: 'Pallas/Vesta curves (~2\u00B2\u2075\u2075 scalar field)',
    comparisons: [
      'Demo: illustrates fold-vs-naive MSM cost ratio without real curve operations.',
      'Production: one MSM over n Pallas points \u2248 n\u00B7255 doublings + additions.',
      'Accumulation savings are proportional — the ratio is the same at any scale.',
    ],
  },
  rerandomization: null,
  'oblivious-sync': null,
  'constraint-counter': null,
  'proof-trace': null,
  'constraint-editor': null,
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
  sumcheck: ['Run all rounds to see the full protocol', 'Toggle cheat mode to see detection', 'Change the number of variables'],
  fri: ['Run the commit phase to see domain folding', 'Inspect query consistency checks', 'Try different domain sizes', 'See how FRI relates to Polynomial Commitments'],
  nova: ['Fold one step to see the cross-term', 'Run all steps to see the full IVC chain', 'Check that each folded instance is satisfied', 'See full recursive proof trees in Recursive Proofs'],
  mle: ['Edit hypercube values and evaluate at a non-boolean point', 'Use partial evaluation to see dimension reduction', 'Compare the eq-basis weights at different points'],
  gkr: ['Prove to see layer-by-layer reduction', 'Step through to watch each sumcheck', 'Change input values and re-prove'],
  'proof-trace': ['Load a bundled sample trace', 'Compare fingerprints of an honest and corrupted run', 'Step through the timeline view'],
  'constraint-editor': ['Load a buggy preset and find the flaw', 'Run the exhaustive check for a counterexample', 'Write a circuit from scratch and share it'],
};

export function InfoPanel({ activeDemo, isOpen }: InfoPanelProps) {
  const demo = DEMOS.find((d) => d.id === activeDemo)!;
  const extra = EXTRA_INFO[activeDemo];
  const { entries } = useInfoPanel();
  const contextEntry = entries[activeDemo];
  const glossary = contextEntry?.glossary ?? MINI_GLOSSARY[activeDemo];
  const nextSteps = contextEntry?.nextSteps ?? DEFAULT_NEXT_STEPS[activeDemo];
  const securityParams = SECURITY_PARAMS[activeDemo];
  const soundness = contextEntry?.securityState ? computeSoundnessErrors(contextEntry.securityState) : null;

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

      {securityParams && (
        <CollapsibleSection title="Security Parameters" accent="var(--text-muted)">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 8,
              }}
            >
              <div
                className="rounded-lg"
                style={{
                  minWidth: 0,
                  padding: '10px 12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="text-[9px] font-bold uppercase"
                  style={{ color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 4 }}
                >
                  This demo
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {securityParams.demoField}
                </div>
              </div>
              <div
                className="rounded-lg"
                style={{
                  minWidth: 0,
                  padding: '10px 12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <div
                  className="text-[9px] font-bold uppercase"
                  style={{ color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 4 }}
                >
                  Production
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {securityParams.productionField}
                </div>
              </div>
            </div>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {securityParams.comparisons.map((c, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: 11,
                    lineHeight: 1.6,
                    color: 'var(--text-secondary)',
                    paddingLeft: 10,
                    borderLeft: '2px solid var(--text-muted)',
                  }}
                >
                  {c}
                </li>
              ))}
            </ul>
            {soundness && (
              <div
                className="rounded-lg"
                style={{
                  padding: '10px 12px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  marginTop: 4,
                }}
              >
                <div
                  className="text-[9px] font-bold uppercase"
                  style={{ color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}
                >
                  Live Soundness Error
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                  {soundness.formula}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div>
                    <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 2 }}>
                      Demo
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>
                      {soundness.demoError}
                    </div>
                  </div>
                  <div style={{ width: 1, background: 'var(--border)' }} />
                  <div>
                    <div className="text-[9px] uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 2 }}>
                      Production
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success)', fontFamily: 'var(--font-mono)' }}>
                      {soundness.productionError}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

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
