// --- AST Types ---

export type ASTNode =
  | InputDecl
  | PublicDecl
  | WireDecl
  | AssertStmt
  | CommentNode;

export interface InputDecl {
  type: 'input';
  name: string;
  line: number;
}

export interface PublicDecl {
  type: 'public';
  name: string;
  line: number;
}

export interface WireDecl {
  type: 'wire';
  name: string;
  expr: Expr;
  line: number;
}

export interface AssertStmt {
  type: 'assert';
  left: Expr;
  right: Expr;
  line: number;
}

export interface CommentNode {
  type: 'comment';
  text: string;
  line: number;
}

export type Expr =
  | ConstExpr
  | VarExpr
  | AddExpr
  | SubExpr
  | MulExpr
  | NegExpr;

export interface ConstExpr {
  type: 'const';
  value: number;
}

export interface VarExpr {
  type: 'var';
  name: string;
}

export interface AddExpr {
  type: 'add';
  left: Expr;
  right: Expr;
}

export interface SubExpr {
  type: 'sub';
  left: Expr;
  right: Expr;
}

export interface MulExpr {
  type: 'mul';
  left: Expr;
  right: Expr;
}

export interface NegExpr {
  type: 'neg';
  operand: Expr;
}

// --- Parse Result ---

export interface ParseResult {
  success: boolean;
  ast: ASTNode[];
  errors: ParseError[];
}

export interface ParseError {
  line: number;
  column: number;
  message: string;
  hint?: string;
}

// --- Compilation Types ---

export interface Wire {
  id: number;
  name: string;
  type: 'input' | 'public' | 'intermediate' | 'one';
  sourceLine: number;
}

export interface Constraint {
  id: number;
  a: Map<number, bigint>;
  b: Map<number, bigint>;
  c: Map<number, bigint>;
  sourceLine: number;
  sourceExpr: string;
  constraintType: 'multiplication' | 'definition' | 'assertion';
  definesWireId: number | null;
}

export interface CompilationResult {
  success: boolean;
  wires: Wire[];
  constraints: Constraint[];
  fieldSize: bigint;
  errors: CompileError[];
  wireByName: Map<string, Wire>;
  inputWires: Wire[];
  publicWires: Wire[];
}

export interface CompileError {
  line: number;
  message: string;
}

// --- Witness Types ---

export interface WitnessStep {
  wireId: number;
  wireName: string;
  expression: string;
  inputs: { name: string; value: bigint }[];
  operation: 'multiply' | 'add' | 'subtract' | 'constant' | 'input' | 'negate' | 'scalar_mul';
  result: bigint;
  sourceLine: number;
  status: 'ok' | 'overflow';
}

export interface WitnessResult {
  success: boolean;
  values: Map<number, bigint>;
  steps: WitnessStep[];
  errors: WitnessError[];
}

export interface WitnessError {
  wireId: number;
  wireName: string;
  message: string;
}

// --- Constraint Check Types ---

export interface ConstraintCheckResult {
  constraintId: number;
  satisfied: boolean;
  a_value: bigint;
  b_value: bigint;
  c_value: bigint;
  ab_product: bigint;
  mismatch?: {
    expected: bigint;
    actual: bigint;
    difference: bigint;
  };
  sourceExpr: string;
  sourceLine: number;
}

export interface CheckResult {
  allSatisfied: boolean;
  checks: ConstraintCheckResult[];
  failedConstraints: ConstraintCheckResult[];
  firstFailure: ConstraintCheckResult | null;
}

// --- Tracer Types ---

export interface DependencyNode {
  wireId: number;
  wireName: string;
  value: bigint;
  dependsOn: number[];
  feedsInto: number[];
  constraintStatus: 'ok' | 'failed' | 'unchecked';
}

export interface FailureTrace {
  failedConstraint: ConstraintCheckResult;
  traceBack: DependencyNode[];
  rootCause: {
    wireId: number;
    wireName: string;
    explanation: string;
  };
}

// --- Analyzer Types ---

export interface ConstraintAnalysis {
  unconstrainedWires: Wire[];
  overconstrainedWires: Wire[];
  constraintCount: number;
  wireCount: number;
  inputCount: number;
  publicCount: number;
  degreesOfFreedom: number;
}

// --- Exhaustive Check Types ---

export interface ExhaustiveResult {
  totalCombinations: number;
  tested: number;
  allSatisfied: boolean;
  counterexample?: {
    inputs: Map<string, bigint>;
    failedConstraints: number[];
    explanation: string;
  };
  uniqueOutputs: number;
  isInputDetermined: boolean;
}

// --- Linear Combination (used internally by compiler) ---

/** Represents a linear combination: sum of (wire_id → coefficient) pairs. */
export type LinComb = Map<number, bigint>;
