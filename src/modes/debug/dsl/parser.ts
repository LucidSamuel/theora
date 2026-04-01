import type { ASTNode, Expr, ParseResult, ParseError } from './types';

// --- Tokenizer ---

type TokenType =
  | 'input' | 'public' | 'wire' | 'assert'
  | 'ident' | 'number'
  | 'eq' | 'eqeq' | 'plus' | 'minus' | 'star'
  | 'lparen' | 'rparen'
  | 'comment' | 'newline' | 'eof';

interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

const KEYWORDS = new Set(['input', 'public', 'wire', 'assert']);

function tokenize(source: string): { tokens: Token[]; errors: ParseError[] } {
  const tokens: Token[] = [];
  const errors: ParseError[] = [];
  const lines = source.split('\n');

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineText = lines[lineIdx]!;
    const lineNum = lineIdx + 1;
    let col = 0;

    while (col < lineText.length) {
      const ch = lineText[col]!;

      // Whitespace
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        col++;
        continue;
      }

      // Comment
      if (ch === '/' && lineText[col + 1] === '/') {
        tokens.push({ type: 'comment', value: lineText.slice(col), line: lineNum, column: col + 1 });
        break; // rest of line is comment
      }

      // Operators and punctuation
      if (ch === '=' && lineText[col + 1] === '=') {
        tokens.push({ type: 'eqeq', value: '==', line: lineNum, column: col + 1 });
        col += 2;
        continue;
      }
      if (ch === '=') {
        tokens.push({ type: 'eq', value: '=', line: lineNum, column: col + 1 });
        col++;
        continue;
      }
      if (ch === '+') { tokens.push({ type: 'plus', value: '+', line: lineNum, column: col + 1 }); col++; continue; }
      if (ch === '-') { tokens.push({ type: 'minus', value: '-', line: lineNum, column: col + 1 }); col++; continue; }
      if (ch === '*') { tokens.push({ type: 'star', value: '*', line: lineNum, column: col + 1 }); col++; continue; }
      if (ch === '(') { tokens.push({ type: 'lparen', value: '(', line: lineNum, column: col + 1 }); col++; continue; }
      if (ch === ')') { tokens.push({ type: 'rparen', value: ')', line: lineNum, column: col + 1 }); col++; continue; }

      // Number
      if (ch >= '0' && ch <= '9') {
        let num = '';
        const startCol = col;
        while (col < lineText.length && lineText[col]! >= '0' && lineText[col]! <= '9') {
          num += lineText[col];
          col++;
        }
        tokens.push({ type: 'number', value: num, line: lineNum, column: startCol + 1 });
        continue;
      }

      // Identifier or keyword
      if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
        let ident = '';
        const startCol = col;
        while (col < lineText.length && /[a-zA-Z0-9_]/.test(lineText[col]!)) {
          ident += lineText[col];
          col++;
        }
        const tokType = KEYWORDS.has(ident) ? ident as TokenType : 'ident';
        tokens.push({ type: tokType, value: ident, line: lineNum, column: startCol + 1 });
        continue;
      }

      // Unknown character
      errors.push({ line: lineNum, column: col + 1, message: `Unexpected character '${ch}'` });
      col++;
    }

    tokens.push({ type: 'newline', value: '\n', line: lineNum, column: lineText.length + 1 });
  }

  tokens.push({ type: 'eof', value: '', line: lines.length + 1, column: 1 });
  return { tokens, errors };
}

// --- Levenshtein Distance ---

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i]![0] = i;
  for (let j = 0; j <= n; j++) d[0]![j] = j;
  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + cost,
      );
    }
  }
  return d[m]![n]!;
}

function suggestVariable(name: string, known: string[]): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const k of known) {
    const dist = levenshtein(name, k);
    if (dist < bestDist && dist <= 2) {
      bestDist = dist;
      best = k;
    }
  }
  return best;
}

// --- Recursive Descent Parser ---

export function parse(source: string): ParseResult {
  const { tokens, errors: tokenErrors } = tokenize(source);
  const errors: ParseError[] = [...tokenErrors];
  const ast: ASTNode[] = [];
  const declaredVars = new Map<string, number>(); // name → line
  let pos = 0;

  function peek(): Token {
    return tokens[pos] ?? { type: 'eof', value: '', line: 0, column: 0 };
  }

  function advance(): Token {
    const t = peek();
    pos++;
    return t;
  }

  function expect(type: TokenType, context: string): Token | null {
    const t = peek();
    if (t.type === type) return advance();
    errors.push({
      line: t.line,
      column: t.column,
      message: `Expected ${type} ${context}, got '${t.value || t.type}'`,
    });
    return null;
  }

  function skipNewlines(): void {
    while (peek().type === 'newline' || peek().type === 'comment') {
      if (peek().type === 'comment') {
        ast.push({ type: 'comment', text: peek().value, line: peek().line });
      }
      advance();
    }
  }

  // --- Expression parsing ---

  function containsMul(e: Expr): boolean {
    if (e.type === 'mul') return true;
    if (e.type === 'add' || e.type === 'sub') return containsMul(e.left) || containsMul(e.right);
    if (e.type === 'neg') return containsMul(e.operand);
    return false;
  }

  function parseFactor(): Expr | null {
    const t = peek();

    if (t.type === 'number') {
      advance();
      return { type: 'const', value: parseInt(t.value, 10) };
    }

    if (t.type === 'ident') {
      advance();
      if (!declaredVars.has(t.value)) {
        const suggestion = suggestVariable(t.value, [...declaredVars.keys()]);
        errors.push({
          line: t.line,
          column: t.column,
          message: `Undefined variable '${t.value}'`,
          hint: suggestion ? `Did you mean '${suggestion}'?` : undefined,
        });
      }
      return { type: 'var', name: t.value };
    }

    if (t.type === 'lparen') {
      advance();
      const inner = parseExpr();
      if (!inner) return null;
      expect('rparen', 'after expression');
      return inner;
    }

    if (t.type === 'minus') {
      advance();
      const operand = parseFactor();
      if (!operand) return null;
      return { type: 'neg', operand };
    }

    errors.push({
      line: t.line,
      column: t.column,
      message: `Expected expression, got '${t.value || t.type}'`,
    });
    return null;
  }

  function parseTerm(): Expr | null {
    let left = parseFactor();
    if (!left) return null;

    if (peek().type === 'star') {
      advance();
      const right = parseFactor();
      if (!right) return null;

      // Check for chained multiplication: a * b * c
      if (peek().type === 'star') {
        const t = peek();
        errors.push({
          line: t.line,
          column: t.column,
          message: 'Multiple multiplications in one expression',
          hint: 'Each multiplication creates a constraint. Break this into separate wire declarations: `wire t = a * b` then `wire u = t * c`',
        });
        // Consume but continue to avoid cascade errors
        advance();
        parseFactor();
      }

      left = { type: 'mul', left, right };
    }

    return left;
  }

  function parseExpr(): Expr | null {
    let left = parseTerm();
    if (!left) return null;

    while (peek().type === 'plus' || peek().type === 'minus') {
      const op = advance();
      const right = parseTerm();
      if (!right) return null;

      // Check: multiplication inside an add/sub after a mul is ambiguous
      // e.g. `a * b + c * d` — two multiplications
      if (containsMul(left) && containsMul(right)) {
        errors.push({
          line: op.line,
          column: op.column,
          message: 'Expression contains two multiplications',
          hint: 'Break each multiplication into a separate `wire` declaration.',
        });
      }

      left = op.type === 'plus'
        ? { type: 'add', left, right }
        : { type: 'sub', left, right };
    }

    return left;
  }

  // --- Statement parsing ---

  function parseStatement(): void {
    const t = peek();

    if (t.type === 'input') {
      advance();
      const nameToken = expect('ident', 'after "input"');
      if (nameToken) {
        if (declaredVars.has(nameToken.value)) {
          errors.push({
            line: nameToken.line,
            column: nameToken.column,
            message: `Variable '${nameToken.value}' is already declared on line ${declaredVars.get(nameToken.value)}`,
          });
        } else {
          declaredVars.set(nameToken.value, t.line);
        }
        ast.push({ type: 'input', name: nameToken.value, line: t.line });
      }
      return;
    }

    if (t.type === 'public') {
      advance();
      const nameToken = expect('ident', 'after "public"');
      if (nameToken) {
        if (declaredVars.has(nameToken.value)) {
          errors.push({
            line: nameToken.line,
            column: nameToken.column,
            message: `Variable '${nameToken.value}' is already declared on line ${declaredVars.get(nameToken.value)}`,
          });
        } else {
          declaredVars.set(nameToken.value, t.line);
        }
        ast.push({ type: 'public', name: nameToken.value, line: t.line });
      }
      return;
    }

    if (t.type === 'wire') {
      advance();
      const nameToken = expect('ident', 'after "wire"');
      if (!nameToken) return;
      if (declaredVars.has(nameToken.value)) {
        errors.push({
          line: nameToken.line,
          column: nameToken.column,
          message: `Variable '${nameToken.value}' is already declared on line ${declaredVars.get(nameToken.value)}`,
        });
      } else {
        declaredVars.set(nameToken.value, t.line);
      }
      if (!expect('eq', 'after wire name')) return;
      const expr = parseExpr();
      if (!expr) return;
      ast.push({ type: 'wire', name: nameToken.value, expr, line: t.line });
      return;
    }

    if (t.type === 'assert') {
      advance();
      const left = parseExpr();
      if (!left) return;
      if (!expect('eqeq', 'in assert statement')) return;
      const right = parseExpr();
      if (!right) return;
      ast.push({ type: 'assert', left, right, line: t.line });
      return;
    }

    // Skip unknown tokens
    if (t.type !== 'eof' && t.type !== 'newline' && t.type !== 'comment') {
      errors.push({
        line: t.line,
        column: t.column,
        message: `Unexpected '${t.value}'. Expected 'input', 'public', 'wire', or 'assert'.`,
      });
      advance();
    }
  }

  // --- Main parse loop ---
  skipNewlines();
  while (peek().type !== 'eof') {
    parseStatement();
    skipNewlines();
  }

  return {
    success: errors.length === 0,
    ast,
    errors,
  };
}
