import type { Walkthrough, WalkthroughSection, WalkthroughDemo } from './types';
import { isDemoId, type DemoId } from '@/types';

const PAPER_ANALYSIS_SYSTEM_PROMPT = `You are analyzing a cryptography paper to create an interactive walkthrough using theora, a cryptographic primitive visualizer. theora has these interactive demos:

DEMOS:
- merkle: Merkle trees, inclusion proofs, hash cascading
- polynomial: Polynomial commitments, KZG flow (commit/challenge/open/verify)
- accumulator: RSA accumulators, membership/non-membership witnesses
- recursive: Recursive proof composition trees, IVC chains, Pasta curve cycle
- elliptic: Elliptic curve point addition, scalar multiplication
- fiat-shamir: Fiat-Shamir transform, correct vs broken transcript
- circuit: R1CS constraints, wire values, underconstrained exploits
- lookup: Lookup arguments, table/wire multiset checks
- pedersen: Pedersen commitments, homomorphic addition
- groth16: R1CS → QAP → trusted setup → prove → pairing verification
- plonk: PLONK gate equations, selector polynomials, copy constraints
- pipeline: End-to-end proof pipeline with fault injection
- constraint-counter: Pedersen vs Poseidon constraint comparison
- split-accumulation: Deferred IPA verification across recursive steps
- rerandomization: Proof unlinkability via commitment rerandomization

For each paper section that discusses a cryptographic primitive covered by a theora demo, create a walkthrough section with:
- A 2-4 sentence summary in plain language
- A key insight (one sentence)
- A demo mapping with the demo ID and suggested interaction hints

Respond with ONLY a JSON object matching this schema:
{
  "paper": {
    "title": "string",
    "authors": "string",
    "year": number,
    "abstractSummary": "2-3 sentence summary"
  },
  "sections": [
    {
      "id": "kebab-case-id",
      "sectionRef": "Section N.N (optional)",
      "title": "string",
      "summary": "2-4 sentences",
      "keyInsight": "one sentence (optional)",
      "demo": {
        "demoId": "one of the demo IDs listed above",
        "caption": "what this demo shows in context of the paper",
        "interactionHints": ["hint 1", "hint 2"]
      } or null if no demo maps to this section
    }
  ]
}

Rules:
- Only map sections to demos that genuinely match. Not every section needs a demo.
- Summaries should explain the concept, not describe the paper's prose.
- Interaction hints should tell the user what to DO in the demo, not what to read.
- If a section discusses a primitive not in theora, include it as a section with demo: null and a summary explaining the concept.
- Order sections as they appear in the paper.
- Keep the total to 5-10 sections. Not every subsection needs its own entry.
- Do NOT include any text outside the JSON object.`;

interface AnalysisResult {
  walkthrough: Walkthrough | null;
  error: string | null;
}

export async function analyzePaper(
  pdfBase64: string,
  apiKey: string,
): Promise<AnalysisResult> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: PAPER_ANALYSIS_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: 'Analyze this cryptography paper and create a walkthrough mapping its key sections to theora demos. Return ONLY the JSON object as specified.',
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      if (response.status === 400 && errBody.includes('prompt is too long')) {
        return {
          walkthrough: null,
          error: 'This PDF is too large for analysis (exceeds the model\'s 200k token context window). Try a shorter paper, or upload only the relevant pages as a separate PDF.',
        };
      }
      return { walkthrough: null, error: `API error ${response.status}: ${errBody.slice(0, 200)}` };
    }

    const data = await response.json();
    const textBlock = data.content?.find((b: { type: string }) => b.type === 'text');
    if (!textBlock?.text) {
      return { walkthrough: null, error: 'No text in API response' };
    }

    return { walkthrough: parseWalkthroughResponse(textBlock.text), error: null };
  } catch (err) {
    return { walkthrough: null, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

function parseWalkthroughResponse(text: string): Walkthrough {
  // Try to extract JSON from the response (handle markdown code blocks)
  let jsonStr = text.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) jsonStr = fenceMatch[1]!.trim();

  const raw = JSON.parse(jsonStr);

  const sections: WalkthroughSection[] = (raw.sections ?? []).map((s: Record<string, unknown>) => {
    let demo: WalkthroughDemo | undefined;
    const rawDemo = s.demo as Record<string, unknown> | null | undefined;
    if (rawDemo && typeof rawDemo.demoId === 'string' && isDemoId(rawDemo.demoId)) {
      demo = {
        demoId: rawDemo.demoId as DemoId,
        state: {},
        caption: String(rawDemo.caption ?? ''),
        interactionHints: Array.isArray(rawDemo.interactionHints)
          ? rawDemo.interactionHints.map(String)
          : [],
      };
    }

    return {
      id: String(s.id ?? `section-${Math.random().toString(36).slice(2, 6)}`),
      sectionRef: typeof s.sectionRef === 'string' ? s.sectionRef : undefined,
      title: String(s.title ?? 'Untitled'),
      summary: String(s.summary ?? ''),
      keyInsight: typeof s.keyInsight === 'string' ? s.keyInsight : undefined,
      demo,
    };
  });

  return {
    id: `ai-${Date.now()}`,
    paper: {
      title: String(raw.paper?.title ?? 'Untitled Paper'),
      authors: String(raw.paper?.authors ?? 'Unknown'),
      year: Number(raw.paper?.year) || new Date().getFullYear(),
      abstractSummary: String(raw.paper?.abstractSummary ?? ''),
    },
    sections,
    generatedBy: 'ai',
    generatedAt: new Date().toISOString(),
  };
}

/** Convert a File to base64 string. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (data:application/pdf;base64,)
      const base64 = result.split(',')[1] ?? result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
