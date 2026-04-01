import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import type {
  ASTNode, ParseError, CompilationResult, WitnessResult, CheckResult,
  FailureTrace, ConstraintAnalysis,
} from './dsl/types';
import type { GraphLayout } from './layout';
import type { CanvasCamera } from '@/hooks/useCanvasCamera';
import { parse } from './dsl/parser';
import { compile } from './dsl/compiler';
import { evaluateWitnessFromAST } from './dsl/witness';
import { checkConstraints } from './dsl/checker';
import { traceFailure } from './dsl/tracer';
import { analyzeConstraints } from './dsl/analyzer';
import { computeLayout } from './layout';
import { DEFAULT_CIRCUITS } from './dsl/defaults';
import { useMode } from '@/modes/ModeProvider';
import { getSearchParam, setSearchParams } from '@/lib/urlState';
import { exportCanvasPng } from '@/lib/canvas';
import { showDownloadToast } from '@/lib/toast';
import type { DemoId } from '@/types';

/** Decode base64-encoded DSL source from URL. */
function decodeDebugSource(param: string | null): string | null {
  if (!param) return null;
  try { return decodeURIComponent(atob(param)); } catch { return null; }
}

/** Parse `name:value,...` input string from URL. */
function parseDebugInputs(param: string | null): Map<string, bigint> | null {
  if (!param) return null;
  const m = new Map<string, bigint>();
  for (const pair of param.split(',')) {
    const idx = pair.indexOf(':');
    if (idx > 0) {
      try { m.set(pair.slice(0, idx), BigInt(pair.slice(idx + 1))); } catch { /* skip */ }
    }
  }
  return m.size > 0 ? m : null;
}

interface DebugContextValue {
  source: string;
  setSource: (s: string) => void;
  fieldSize: bigint;
  setFieldSize: (s: bigint) => void;
  inputValues: Map<string, bigint>;
  setInputValue: (name: string, value: bigint) => void;
  autoEvaluate: boolean;
  setAutoEvaluate: (v: boolean) => void;

  ast: ASTNode[];
  parseErrors: ParseError[];
  compilation: CompilationResult | null;
  witness: WitnessResult | null;
  checks: CheckResult | null;
  failureTrace: FailureTrace | null;
  analysis: ConstraintAnalysis | null;
  layout: GraphLayout | null;

  selectedWire: number | null;
  setSelectedWire: (id: number | null) => void;
  selectedConstraint: number | null;
  setSelectedConstraint: (id: number | null) => void;
  hoveredElement: { type: 'wire' | 'constraint'; id: number } | null;
  setHoveredElement: (el: { type: 'wire' | 'constraint'; id: number } | null) => void;
  witnessStep: number;
  setWitnessStep: (step: number) => void;

  evaluate: () => void;

  /** Build URL search params for sharing debug state. */
  buildShareParams: () => { src: string; inputs: string; field: string | null };
  /** Export the debug canvas as PNG. */
  exportPng: () => void;
  /** Refs set by DebugCanvas for PNG export. */
  _canvasEl: React.MutableRefObject<HTMLCanvasElement | null>;
  _camera: React.MutableRefObject<CanvasCamera | null>;
  _fitToView: React.MutableRefObject<((opts?: { instant?: boolean }) => void) | null>;
}

const defaultCtx: DebugContextValue = {
  source: '', setSource: () => {},
  fieldSize: 101n, setFieldSize: () => {},
  inputValues: new Map(), setInputValue: () => {},
  autoEvaluate: true, setAutoEvaluate: () => {},
  ast: [], parseErrors: [],
  compilation: null, witness: null, checks: null,
  failureTrace: null, analysis: null, layout: null,
  selectedWire: null, setSelectedWire: () => {},
  selectedConstraint: null, setSelectedConstraint: () => {},
  hoveredElement: null, setHoveredElement: () => {},
  witnessStep: 0, setWitnessStep: () => {},
  evaluate: () => {},
  buildShareParams: () => ({ src: '', inputs: '', field: null }),
  exportPng: () => {},
  _canvasEl: { current: null },
  _camera: { current: null },
  _fitToView: { current: null },
};

const DebugContext = createContext<DebugContextValue>(defaultCtx);

export function DebugProvider({ activeDemo: _activeDemo, children }: { activeDemo: DemoId; children: ReactNode }) {
  const { mode } = useMode();
  const defaultCircuit = DEFAULT_CIRCUITS[0]!;

  const [source, setSource] = useState(() =>
    decodeDebugSource(getSearchParam('src')) ?? defaultCircuit.source,
  );
  const [fieldSize, setFieldSize] = useState<bigint>(() => {
    const fp = getSearchParam('field');
    if (fp) { const f = parseInt(fp, 10); if (f > 1 && f < 10000) return BigInt(f); }
    return 101n;
  });
  const [inputValues, setInputValues] = useState<Map<string, bigint>>(() => {
    const fromUrl = parseDebugInputs(getSearchParam('inputs'));
    if (fromUrl) return fromUrl;
    const m = new Map<string, bigint>();
    for (const [k, v] of Object.entries(defaultCircuit.defaultInputs)) {
      m.set(k, BigInt(v));
    }
    return m;
  });
  const [autoEvaluate, setAutoEvaluate] = useState(true);

  const [ast, setAst] = useState<ASTNode[]>([]);
  const [parseErrors, setParseErrors] = useState<ParseError[]>([]);
  const [compilation, setCompilation] = useState<CompilationResult | null>(null);
  const [witness, setWitness] = useState<WitnessResult | null>(null);
  const [checks, setChecks] = useState<CheckResult | null>(null);
  const [failureTrace, setFailureTrace] = useState<FailureTrace | null>(null);
  const [analysis, setAnalysis] = useState<ConstraintAnalysis | null>(null);
  const [layout, setLayout] = useState<GraphLayout | null>(null);

  const [selectedWire, setSelectedWire] = useState<number | null>(null);
  const [selectedConstraint, setSelectedConstraint] = useState<number | null>(null);
  const [hoveredElement, setHoveredElement] = useState<{ type: 'wire' | 'constraint'; id: number } | null>(null);
  const [witnessStep, setWitnessStep] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const setInputValue = useCallback((name: string, value: bigint) => {
    setInputValues((prev) => {
      const next = new Map(prev);
      next.set(name, value);
      return next;
    });
  }, []);

  const evaluate = useCallback(() => {
    // Parse
    const parseResult = parse(source);
    setAst(parseResult.ast);
    setParseErrors(parseResult.errors);

    if (!parseResult.success) {
      setCompilation(null);
      setWitness(null);
      setChecks(null);
      setFailureTrace(null);
      setAnalysis(null);
      setLayout(null);
      return;
    }

    // Compile
    const comp = compile(parseResult.ast, fieldSize);
    setCompilation(comp);

    if (!comp.success) {
      setWitness(null);
      setChecks(null);
      setFailureTrace(null);
      setLayout(null);
      return;
    }

    // Analyze
    const analysisResult = analyzeConstraints(comp);
    setAnalysis(analysisResult);

    // Layout
    const graphLayout = computeLayout(comp);
    setLayout(graphLayout);

    // Auto-fill missing input values with 0
    const allInputWires = [...comp.inputWires, ...comp.publicWires];
    const currentInputs = new Map(inputValues);
    let changed = false;
    for (const wire of allInputWires) {
      if (!currentInputs.has(wire.name)) {
        currentInputs.set(wire.name, 0n);
        changed = true;
      }
    }
    if (changed) setInputValues(currentInputs);

    // Witness evaluation
    const witnessResult = evaluateWitnessFromAST(comp, parseResult.ast, currentInputs);
    setWitness(witnessResult);

    if (!witnessResult.success) {
      setChecks(null);
      setFailureTrace(null);
      return;
    }

    // Constraint check
    const checkResult = checkConstraints(comp, witnessResult);
    setChecks(checkResult);

    // Failure trace (if any constraint fails)
    if (checkResult.firstFailure) {
      const trace = traceFailure(comp, witnessResult, checkResult, checkResult.firstFailure);
      setFailureTrace(trace);
    } else {
      setFailureTrace(null);
    }

    setWitnessStep(0);
  }, [source, fieldSize, inputValues]);

  // Auto-evaluate on source/input/field changes (debounced)
  useEffect(() => {
    if (!autoEvaluate || mode !== 'debug') return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(evaluate, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [autoEvaluate, source, inputValues, fieldSize, mode, evaluate]);

  // Initial evaluation on mount
  useEffect(() => {
    if (mode === 'debug') evaluate();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Canvas registration refs (set by DebugCanvas for PNG export)
  const _canvasEl = useRef<HTMLCanvasElement | null>(null);
  const _camera = useRef<CanvasCamera | null>(null);
  const _fitToView = useRef<((opts?: { instant?: boolean }) => void) | null>(null);

  const buildShareParams = useCallback(() => {
    const src = btoa(encodeURIComponent(source));
    const inputs = Array.from(inputValues.entries())
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return { src, inputs, field: fieldSize === 101n ? null : String(fieldSize) };
  }, [source, inputValues, fieldSize]);

  const exportPng = useCallback(() => {
    const canvas = _canvasEl.current;
    const cam = _camera.current;
    const fit = _fitToView.current;
    if (!canvas || !cam || !fit) return;
    exportCanvasPng(canvas, cam, fit, 'theora-debug-circuit.png', showDownloadToast);
  }, []);

  // Sync debug state to URL search params
  useEffect(() => {
    if (mode !== 'debug') return;
    const p = buildShareParams();
    setSearchParams({ src: p.src, inputs: p.inputs || null, field: p.field });
  }, [mode, buildShareParams]);

  return (
    <DebugContext.Provider
      value={{
        source, setSource,
        fieldSize, setFieldSize,
        inputValues, setInputValue,
        autoEvaluate, setAutoEvaluate,
        ast, parseErrors,
        compilation, witness, checks,
        failureTrace, analysis, layout,
        selectedWire, setSelectedWire,
        selectedConstraint, setSelectedConstraint,
        hoveredElement, setHoveredElement,
        witnessStep, setWitnessStep,
        evaluate,
        buildShareParams,
        exportPng,
        _canvasEl,
        _camera,
        _fitToView,
      }}
    >
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug(): DebugContextValue {
  return useContext(DebugContext);
}
