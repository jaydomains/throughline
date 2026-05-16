// Bundle-authored regex is untrusted input (bundles load from a user-specified
// bundle_path, and once Throughline is public a shared bundle reaches every user).
// Node has no regex execution timeout and RE2 is not an available dependency, so this
// is best-effort containment: refuse the well-known catastrophic-backtracking shapes
// and over-long patterns before compiling, and cap the input length matched against.
// It eliminates the exponential families (nested / quantified-alternation quantifiers)
// while keeping the simple patterns bundle authors should be writing. A refused or
// invalid pattern returns null so the caller skips it (never blocks the repo, T-D44).

const MAX_PATTERN_LENGTH = 1000;
const MAX_INPUT_LENGTH = 4000;

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// True when a sub-expression inside a quantified group is itself unbounded/ambiguous
// (the core of exponential backtracking): an inner `*`/`+`/`{…}` quantifier or a
// top-level `|` alternation. Respects `\` escapes and `[...]` character classes so
// literals don't trip it.
function bodyIsAmbiguous(body: string): boolean {
  let inClass = false;
  let groupDepth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (inClass) {
      if (ch === ']') inClass = false;
      continue;
    }
    if (ch === '[') {
      inClass = true;
      continue;
    }
    if (ch === '(') {
      groupDepth++;
      continue;
    }
    if (ch === ')') {
      if (groupDepth > 0) groupDepth--;
      continue;
    }
    if (ch === '|' && groupDepth === 0) return true;
    if (ch === '*' || ch === '+' || ch === '{') return true;
  }
  return false;
}

function looksCatastrophic(src: string): boolean {
  if (src.length > MAX_PATTERN_LENGTH) return true;
  const groupStarts: number[] = [];
  let inClass = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (inClass) {
      if (ch === ']') inClass = false;
      continue;
    }
    if (ch === '[') {
      inClass = true;
      continue;
    }
    if (ch === '(') {
      groupStarts.push(i);
      continue;
    }
    if (ch === ')') {
      const start = groupStarts.pop();
      if (start === undefined) continue;
      const next = src[i + 1];
      // A group followed by an unbounded/range quantifier whose body is itself
      // ambiguous is the (a+)+ / (.*)* / (a|aa)+ family.
      if (next === '*' || next === '+' || next === '{') {
        if (bodyIsAmbiguous(src.slice(start + 1, i))) return true;
      }
    }
  }
  return false;
}

export function safeCompile(source: string, flags?: string): RegExp | null {
  if (typeof source !== 'string' || source.length === 0) return null;
  if (looksCatastrophic(source)) return null;
  try {
    return new RegExp(source, flags);
  } catch {
    return null;
  }
}

// Bound the matched input as a second layer (a refused pattern can't reach here, but a
// safe pattern over a pathologically long line still costs linearly).
export function safeTest(re: RegExp, input: string): boolean {
  re.lastIndex = 0;
  return re.test(input.length > MAX_INPUT_LENGTH ? input.slice(0, MAX_INPUT_LENGTH) : input);
}
