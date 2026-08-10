/**
 * Micro-implémentation de l'API Vitest utilisée par la suite de tests.
 *
 * Raison d'être : l'environnement de dev de cette session n'a pas accès à
 * registry.npmjs.org, donc `npm install vitest` est impossible. Ce shim permet
 * d'exécuter réellement les tests avec le type-stripping natif de Node
 * (`npm run test:offline`). Les fichiers de test importent `vitest` normalement
 * et tournent tels quels sous le vrai Vitest (`npm test`) une fois les
 * dépendances installées. Ce fichier n'est jamais chargé par l'application.
 */

export const suites = [];
const stack = [];

function currentScope() {
  return stack[stack.length - 1] ?? null;
}

export function describe(name, fn) {
  const suite = { name, tests: [], before: [], after: [], children: [] };
  const parent = currentScope();
  if (parent) parent.children.push(suite);
  else suites.push(suite);
  stack.push(suite);
  try {
    fn();
  } finally {
    stack.pop();
  }
}
describe.skip = (name) => {
  const parent = currentScope();
  const suite = { name, tests: [], before: [], after: [], children: [], skip: true };
  if (parent) parent.children.push(suite);
  else suites.push(suite);
};

export function it(name, fn) {
  const scope = currentScope();
  if (!scope) throw new Error(`it("${name}") hors de tout describe()`);
  scope.tests.push({ name, fn });
}
it.skip = (name) => {
  const scope = currentScope();
  if (scope) scope.tests.push({ name, fn: null, skip: true });
};
export const test = it;

export function beforeEach(fn) {
  const scope = currentScope();
  if (scope) scope.before.push(fn);
}
export function afterEach(fn) {
  const scope = currentScope();
  if (scope) scope.after.push(fn);
}

// --- assertions -------------------------------------------------------------

function fmt(value, depth = 0) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value !== 'object') return String(value);
  if (depth > 2) return Array.isArray(value) ? '[…]' : '{…}';
  if (Array.isArray(value)) {
    return `[${value.map((v) => fmt(v, depth + 1)).join(', ')}]`;
  }
  const entries = Object.entries(value).map(
    ([k, v]) => `${k}: ${fmt(v, depth + 1)}`,
  );
  return `{ ${entries.join(', ')} }`;
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}

function matchesObject(actual, expected) {
  if (typeof expected !== 'object' || expected === null) {
    return deepEqual(actual, expected);
  }
  if (typeof actual !== 'object' || actual === null) return false;
  return Object.entries(expected).every(([k, v]) =>
    typeof v === 'object' && v !== null
      ? matchesObject(actual[k], v)
      : deepEqual(actual[k], v),
  );
}

class AssertionError extends Error {}

function assert(ok, negated, message) {
  if (ok === negated) throw new AssertionError(message);
}

function captureThrow(fn) {
  if (typeof fn !== 'function') {
    throw new AssertionError('toThrow() attend une fonction');
  }
  try {
    fn();
    return { threw: false, error: null };
  } catch (error) {
    return { threw: true, error };
  }
}

function build(actual, negated) {
  const api = {
    toBe(expected) {
      assert(
        Object.is(actual, expected),
        negated,
        `attendu ${fmt(expected)}, reçu ${fmt(actual)}`,
      );
    },
    toEqual(expected) {
      assert(
        deepEqual(actual, expected),
        negated,
        `attendu ${fmt(expected)}, reçu ${fmt(actual)}`,
      );
    },
    toStrictEqual(expected) {
      api.toEqual(expected);
    },
    toMatchObject(expected) {
      assert(
        matchesObject(actual, expected),
        negated,
        `${fmt(actual)} ne correspond pas à ${fmt(expected)}`,
      );
    },
    toBeTruthy() {
      assert(Boolean(actual), negated, `${fmt(actual)} n'est pas truthy`);
    },
    toBeFalsy() {
      assert(!actual, negated, `${fmt(actual)} n'est pas falsy`);
    },
    toBeNull() {
      assert(actual === null, negated, `${fmt(actual)} n'est pas null`);
    },
    toBeUndefined() {
      assert(actual === undefined, negated, `${fmt(actual)} n'est pas undefined`);
    },
    toBeDefined() {
      assert(actual !== undefined, negated, `valeur undefined`);
    },
    toContain(item) {
      const ok =
        typeof actual === 'string'
          ? actual.includes(item)
          : Array.from(actual ?? []).includes(item);
      assert(ok, negated, `${fmt(actual)} ne contient pas ${fmt(item)}`);
    },
    toContainEqual(item) {
      const ok = Array.from(actual ?? []).some((x) => deepEqual(x, item));
      assert(ok, negated, `${fmt(actual)} ne contient pas ${fmt(item)}`);
    },
    toHaveLength(n) {
      assert(
        actual?.length === n,
        negated,
        `longueur ${actual?.length}, attendue ${n}`,
      );
    },
    toHaveProperty(key, value) {
      const has = actual != null && Object.hasOwn(actual, key);
      const ok =
        arguments.length > 1 ? has && deepEqual(actual[key], value) : has;
      assert(ok, negated, `propriété ${key} absente ou différente`);
    },
    toBeGreaterThan(n) {
      assert(actual > n, negated, `${fmt(actual)} n'est pas > ${n}`);
    },
    toBeGreaterThanOrEqual(n) {
      assert(actual >= n, negated, `${fmt(actual)} n'est pas >= ${n}`);
    },
    toBeLessThan(n) {
      assert(actual < n, negated, `${fmt(actual)} n'est pas < ${n}`);
    },
    toBeLessThanOrEqual(n) {
      assert(actual <= n, negated, `${fmt(actual)} n'est pas <= ${n}`);
    },
    toThrow(expected) {
      const { threw, error } = captureThrow(actual);
      let ok = threw;
      if (threw && expected !== undefined) {
        if (typeof expected === 'string') {
          ok = String(error?.message ?? '').includes(expected);
        } else if (expected instanceof RegExp) {
          ok = expected.test(String(error?.message ?? ''));
        } else if (typeof expected === 'function') {
          ok = error instanceof expected;
        }
      }
      assert(
        ok,
        negated,
        threw
          ? `erreur inattendue : ${error?.message}`
          : "aucune erreur n'a été levée",
      );
    },
  };
  api.toThrowError = api.toThrow;
  return api;
}

export function expect(actual) {
  const api = build(actual, false);
  api.not = build(actual, true);
  return api;
}

export default { describe, it, test, expect, beforeEach, afterEach };
