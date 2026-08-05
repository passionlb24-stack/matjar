// A duplicate key in a dictionary is invisible to every normal check.
//
// JSON.parse accepts it and silently keeps the LAST one, so the file parses,
// TypeScript is happy, and the Dictionary type still lists the key exactly
// once. The only symptom is that the wrong string reaches the user.
//
// It cost us two real bugs: merchants finishing their free trial were shown
// the platform's internal "time to collect payment" copy, and Pro-upgrade
// notifications lost the {store} placeholder — the store name just vanished
// from the message.
//
// Catching this has to happen on the raw text, before the parser throws the
// evidence away. Hence the hand-rolled scan below rather than a schema check.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DICT_DIR = join(process.cwd(), "src/i18n/dictionaries");

/** Every key declared twice in the same object, as "key (line A & line B)". */
function duplicateKeys(source: string): string[] {
  // One frame per open object/array; each frame maps a key to the line it was
  // first seen on. Nesting is tracked by counting brackets, which is sound here
  // because these files hold no multi-line strings and no brackets inside keys.
  const stack: Record<string, number>[] = [{}];
  const dups: string[] = [];

  source.split("\n").forEach((line, i) => {
    const key = line.match(/^\s*"([^"]+)"\s*:/)?.[1];
    if (key) {
      const frame = stack[stack.length - 1];
      if (frame[key]) dups.push(`${key} (line ${frame[key]} & line ${i + 1})`);
      frame[key] = i + 1;
    }
    const opens = (line.match(/[{[]/g) ?? []).length;
    const closes = (line.match(/[}\]]/g) ?? []).length;
    for (let n = 0; n < opens; n++) stack.push({});
    // Guard the pop: a malformed file should fail the assertion below, not
    // crash the test with an empty stack.
    for (let n = 0; n < closes; n++) if (stack.length > 1) stack.pop();
  });

  return dups;
}

describe("dictionaries", () => {
  it.each(["ar", "en"])("%s.json declares every key once", (locale) => {
    const source = readFileSync(join(DICT_DIR, `${locale}.json`), "utf8");
    expect(duplicateKeys(source)).toEqual([]);
  });

  it("finds a duplicate the JSON parser would hide", () => {
    const shadowed = '{\n  "a": {\n    "k": "first"\n  },\n  "k": "x",\n  "k": "y"\n}';
    // Proof the parser is no defence: it keeps the last value without complaint.
    expect(JSON.parse(shadowed).k).toBe("y");
    expect(duplicateKeys(shadowed)).toEqual(["k (line 5 & line 6)"]);
  });
});
