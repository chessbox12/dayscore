import { expect } from "vitest";
import { ISODate } from "../dates";

/** Assert + print "expected vs calculated" for the verification report. */
export function eq<T>(desc: string, actual: T, expected: T): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  console.log(`${a === e ? "PASS" : "FAIL"}  ${desc}  |  expected ${e}  |  got ${a}`);
  expect(actual).toEqual(expected);
}

export function scoresFrom(pairs: [ISODate, number][]): Record<ISODate, number> {
  return Object.fromEntries(pairs);
}

/** Minimal localStorage shim for storage-backed tests in Node. */
export function installLocalStorage(): void {
  const map = new Map<string, string>();
  const shim = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => void map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
  (globalThis as Record<string, unknown>).localStorage = shim;
  (globalThis as Record<string, unknown>).window = globalThis;
}
