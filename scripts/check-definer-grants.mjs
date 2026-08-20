#!/usr/bin/env node
// ===========================================================================
// The SECURITY DEFINER convention, enforced.
// ===========================================================================
//
// WHY THIS EXISTS
//
// Migrations 0281, 0284 and 0285 established a convention for every
// `SECURITY DEFINER` function in schema `public`:
//
//   1. It states its audience explicitly —
//        revoke all on function public.f(args) from public, anon, authenticated;
//        grant execute on function public.f(args) to <the roles that should>;
//      Naming all three roles matters: 0258's lesson is that revoking from
//      `public` alone leaves anon's and authenticated's own direct grants
//      intact. A function whose privileges "came out right" from whatever role
//      created it, with no migration saying so, hands itself back to `anon` the
//      next time it is replaced under a different role or restored into a fresh
//      project.
//
//   2. It pins `search_path = ''` (the empty string, not `public`) so no
//      unqualified name it resolves can be shadowed — 0285 demonstrated
//      pg_temp shadowing against production for `search_path = public`.
//
// Migration 0290 had to clean up two functions written *the same day* 0285 was
// enforcing that convention. A convention that needs a person to remember it,
// on the day they are busy enforcing it, is a convention that needs a gate.
//
// This is STATIC ANALYSIS over supabase/migrations/*.sql. CI cannot reach the
// database, so this checks what the migration files *instruct*, which is the
// thing that survives a restore into a fresh project. It cannot see privileges
// that exist in production but were never written down — that gap is precisely
// the drift 0284 found and is a reason to check the files, not a weakness of
// checking them.
//
// Run:  node scripts/check-definer-grants.mjs        (or: npm run check:migrations)
//       node scripts/check-definer-grants.mjs --list  to dump every definer
//                                                     function it found.
//
// ---------------------------------------------------------------------------
// WHAT IT CATCHES / WHAT IT DOES NOT — read before trusting a green run.
// See the block comment above `main()` at the bottom of this file.
// ---------------------------------------------------------------------------

import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "supabase",
  "migrations",
);

// ===========================================================================
// 1. Lexing: strip comments, keep strings and dollar-quoted bodies intact,
//    then split into statements at top-level semicolons.
// ===========================================================================

/**
 * Removes `--` line comments and `/* *\/` block comments, replacing each with a
 * single space so token boundaries survive. Text inside single-quoted strings
 * and inside `$tag$ ... $tag$` dollar quotes is left exactly as it was — a
 * function body is allowed to contain `--`, and 0284's prose comment contains
 * the literal words "revoke ... on function", which would otherwise be parsed
 * as an instruction.
 *
 * Returns the cleaned SQL plus, for every dollar-quoted run, the [start, end)
 * offsets it occupies in the cleaned text — so a caller can ask "is this match
 * in a function body or in its header?".
 */
function stripComments(sql) {
  let out = "";
  const bodySpans = [];
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const two = sql.slice(i, i + 2);

    // -- line comment
    if (two === "--") {
      while (i < n && sql[i] !== "\n") i++;
      out += " ";
      continue;
    }

    // /* block comment */ — nestable in PostgreSQL.
    if (two === "/*") {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (sql.slice(i, i + 2) === "/*") {
          depth++;
          i += 2;
        } else if (sql.slice(i, i + 2) === "*/") {
          depth--;
          i += 2;
        } else {
          if (sql[i] === "\n") out += "\n";
          i++;
        }
      }
      out += " ";
      continue;
    }

    // 'single quoted string' with '' as the escape
    if (sql[i] === "'") {
      out += sql[i++];
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          out += "''";
          i += 2;
          continue;
        }
        out += sql[i];
        if (sql[i] === "'") {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // "quoted identifier"
    if (sql[i] === '"') {
      out += sql[i++];
      while (i < n) {
        out += sql[i];
        if (sql[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // $tag$ dollar-quoted body $tag$
    const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
    if (dollar) {
      const tag = dollar[0];
      const start = out.length;
      out += tag;
      i += tag.length;
      const close = sql.indexOf(tag, i);
      const end = close === -1 ? n : close + tag.length;
      out += sql.slice(i, end);
      i = end;
      bodySpans.push([start, out.length]);
      continue;
    }

    out += sql[i++];
  }

  return { sql: out, bodySpans };
}

/** Splits cleaned SQL at semicolons that are not inside a string or a body. */
function splitStatements(cleaned) {
  const { sql, bodySpans } = cleaned;
  const inBody = (pos) => bodySpans.some(([a, b]) => pos >= a && pos < b);
  const statements = [];
  let start = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < sql.length; i++) {
    if (inBody(i)) continue;
    const ch = sql[i];
    if (ch === "'" && !inDouble) {
      if (inSingle && sql[i + 1] === "'") {
        i++;
        continue;
      }
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === ";" && !inSingle && !inDouble) {
      const text = sql.slice(start, i);
      if (text.trim()) statements.push({ text, offset: start });
      start = i + 1;
    }
  }
  const tail = sql.slice(start);
  if (tail.trim()) statements.push({ text: tail, offset: start });
  return statements;
}

// ===========================================================================
// 2. Signatures
// ===========================================================================

/** Normalises `PUBLIC."Foo"` / `foo` / `public.foo` to `public.foo`. */
function normaliseName(raw) {
  const parts = raw
    .split(".")
    .map((p) => p.replace(/^"(.*)"$/, "$1"))
    .map((p) => (/^[A-Za-z0-9_]+$/.test(p) ? p.toLowerCase() : p));
  return parts.length === 1 ? `public.${parts[0]}` : parts.join(".");
}

/**
 * Reads the balanced argument list starting at `openParen`. Returns the raw
 * inner text and the index just past the closing paren, or null if unbalanced.
 */
function readParens(text, openParen) {
  let depth = 0;
  let inSingle = false;
  for (let i = openParen; i < text.length; i++) {
    const ch = text[i];
    if (inSingle) {
      if (ch === "'") {
        if (text[i + 1] === "'") i++;
        else inSingle = false;
      }
      continue;
    }
    if (ch === "'") inSingle = true;
    else if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return { inner: text.slice(openParen + 1, i), end: i + 1 };
    }
  }
  return null;
}

/**
 * Argument COUNT, splitting only on top-level commas so `default coalesce(a,b)`
 * and `default 'a,b'` count as one argument each.
 *
 * Count, not types: a `create` writes `p_store_id uuid`, a `revoke` writes
 * `uuid`, and reconciling those two spellings (domains, `public.lead_status`,
 * `character varying` vs `varchar`, argument modes) is a parser I do not want
 * to be wrong in either direction. Name + arity is the identity used here; the
 * `--list` output shows what was matched to what.
 */
function arity(inner) {
  const trimmed = inner.trim();
  if (!trimmed) return 0;
  let depth = 0;
  let inSingle = false;
  let count = 1;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inSingle) {
      if (ch === "'") {
        if (trimmed[i + 1] === "'") i++;
        else inSingle = false;
      }
      continue;
    }
    if (ch === "'") inSingle = true;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) count++;
  }
  return count;
}

const key = (name, n) => `${name}/${n}`;

// ===========================================================================
// 3. Collecting facts from every migration
// ===========================================================================

// ---------------------------------------------------------------------------
// WHERE THE FAILING BAR IS, AND WHY IT IS THERE AND NOT HIGHER
// ---------------------------------------------------------------------------
//
// This was calibrated against the corpus, not assumed. Enforcing 0281's exact
// spelling on all 197 live definer functions produces 84 failures — in files
// that are already applied to production and that nobody is going to rewrite.
// A gate like that is switched off inside a week, and then it catches nothing
// at all. So the bar is set at the thing that is actually a defect, and the
// weaker-but-deliberate spellings are reported as non-failing notes.
//
// Three spellings appear in this repo, and ALL THREE state an audience:
//
//   0281's, the current house style — narrow by revocation, then re-grant:
//     revoke all on function f from public, anon, authenticated;
//     grant execute on function f to authenticated;
//
//   the pre-0281 short form, ~50 functions — drop the blanket, then say who:
//     revoke all on function f from public;
//     grant execute on function f to anon, authenticated;
//
//   the pre-0281 revoke-only form, ~51 functions — anon explicitly cut:
//     revoke all on function f from public, anon;
//
// The first two end in the same ACL as each other whenever the grant matches;
// the third ends in the same ACL as the first with `grant ... to authenticated`.
// Insisting on one spelling over the others is style, and style is what code
// review is for.
//
// What is NOT style, and is what this gate fails on:
//
//   (1) SILENCE. No revoke and no grant anywhere for the signature. Supabase
//       grants EXECUTE to anon and authenticated by default, so a definer
//       function that says nothing is callable by every visitor holding the
//       anon key — a key that ships inside the JavaScript bundle. Nothing in
//       the migration files records a decision, so a restore into a fresh
//       project reproduces the exposure rather than the intent.
//
//   (2) THE 0258 TRAP. `revoke ... from public;` and nothing else. This LOOKS
//       like a lockdown and is not one: revoking from PUBLIC does not touch
//       anon's and authenticated's own direct grants, so the function stays
//       exactly as callable as it was. An author who writes this believes they
//       have closed something.
//
// Everything narrower than that is a note, not a failure.
// ---------------------------------------------------------------------------

/** The spelling 0281 uses; anything short of it is a note, not a failure. */
const ROLES_IDEAL = ["public", "anon", "authenticated"];

/**
 * `set search_path = ''` — the empty string, in either quoting style, with
 * `=` or `to`. `set search_path = public` deliberately does NOT match: that is
 * the exact setting 0285 removed.
 */
const PINS_EMPTY_SEARCH_PATH =
  /\bset\s+search_path\s*(?:=|to)\s*(?:''|""|'\s*')/i;
const SETS_SEARCH_PATH_AT_ALL = /\bset\s+search_path\s*(?:=|to)\s*/i;

function collect() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  /** @type {Map<string, {name:string, arity:number, file:string, index:number, line:number, pinned:boolean, setsSearchPathToSomethingElse:boolean, orReplace:boolean}>} */
  const definers = new Map();
  /** @type {Map<string, {file:string, roles:string[], index:number}[]>} */
  const revokes = new Map();
  /** @type {Map<string, {file:string, roles:string[], index:number}[]>} */
  const grants = new Map();
  /** @type {Map<string, {file:string, index:number}[]>} */
  const alterPins = new Map();
  /** @type {string[]} */
  const wildcardRevokes = [];
  /** @type {string[]} */
  const parseWarnings = [];
  /**
   * Migration index of the last DROP of each signature. DROP is the one thing
   * that resets a function's ACL, so a revoke written before it no longer
   * counts. `create or replace` does NOT reset the ACL (0285 relies on that
   * explicitly), so it does not appear here.
   */
  /** @type {Map<string, number>} */
  const lastDrop = new Map();
  let droppedSignatures = 0;

  files.forEach((file, index) => {
    const raw = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const cleaned = stripComments(raw);
    const lineOf = (offset) =>
      cleaned.sql.slice(0, offset).split("\n").length;

    for (const { text, offset } of splitStatements(cleaned)) {
      const stmt = text.trim();

      // ---- drop function ------------------------------------------------
      // Ordered simulation: the migrations are replayed in filename order and
      // a dropped signature LEAVES the live set. Without this, every superseded
      // overload stays in the set forever and gets reported as an unrevoked
      // definer function — five of them on this branch, including three dead
      // signatures of place_guest_order. Those are the loudest possible false
      // positives: the money path, flagged, wrongly, on every run.
      const drop = /^drop\s+function\s+(if\s+exists\s+)?([A-Za-z0-9_."]+)\s*(\()?/i.exec(
        stmt,
      );
      if (drop) {
        const name = normaliseName(drop[2]);
        if (drop[3]) {
          const args = readParens(stmt, stmt.indexOf("(", drop[0].length - 1));
          if (args) {
            const k = key(name, arity(args.inner));
            if (definers.delete(k)) droppedSignatures++;
            lastDrop.set(k, index);
          }
        } else {
          // `drop function public.f;` with no argument list — legal when the
          // name is unambiguous. Drops every arity this parser knows of.
          for (const k of [...definers.keys()]) {
            if (k.split("/")[0] === name) {
              definers.delete(k);
              droppedSignatures++;
              lastDrop.set(k, index);
            }
          }
        }
        continue;
      }

      // ---- create [or replace] function -------------------------------
      const create =
        /^create\s+(or\s+replace\s+)?function\s+([A-Za-z0-9_."]+)\s*\(/i.exec(
          stmt,
        );
      if (create) {
        const args = readParens(stmt, stmt.indexOf("(", create[0].length - 1));
        if (!args) {
          parseWarnings.push(
            `${file}: could not read the argument list of ${create[2]} — its signature was skipped.`,
          );
          continue;
        }
        // The header is everything between the closing paren of the argument
        // list and the start of the body. `security definer` and
        // `set search_path` are header clauses; an occurrence inside the body
        // (e.g. a function that itself executes `set search_path`) must not
        // count.
        const bodyStart = stmt.search(/\$[A-Za-z_0-9]*\$/);
        const header = stmt.slice(
          args.end,
          bodyStart > args.end ? bodyStart : stmt.length,
        );

        if (!/\bsecurity\s+definer\b/i.test(header)) continue;

        const name = normaliseName(create[2]);
        const n = arity(args.inner);
        // Last create wins: a later `create or replace` is the definition that
        // ends up deployed, and it is the one whose header must carry the pin,
        // because CREATE OR REPLACE rewrites the SET clauses.
        definers.set(key(name, n), {
          name,
          arity: n,
          file,
          index,
          line: lineOf(offset),
          // `returns trigger` changes the SEVERITY, not the rule. PostgREST does
          // not expose trigger-returning functions as /rpc/ endpoints, so a
          // browser role cannot call one however its EXECUTE stands; and firing
          // a trigger does not consult EXECUTE at all (0120's precedent). 0281
          // still revoked all of them — group (c) — because a privilege nobody
          // needs is a privilege that should not be there. The message says
          // which kind it is so a reviewer can prioritise honestly.
          returnsTrigger: /\breturns\s+trigger\b/i.test(header),
          pinned: PINS_EMPTY_SEARCH_PATH.test(header),
          setsSearchPathToSomethingElse:
            SETS_SEARCH_PATH_AT_ALL.test(header) &&
            !PINS_EMPTY_SEARCH_PATH.test(header),
          orReplace: !!create[1],
        });
        continue;
      }

      // ---- revoke / grant ... on function ... from|to <roles> ----------
      const isRevoke = /^revoke\b/i.test(stmt);
      const isGrant = /^grant\b/i.test(stmt);
      if ((isRevoke || isGrant) && /\bon\s+function\b/i.test(stmt)) {
        if (/\bon\s+all\s+functions\s+in\s+schema\b/i.test(stmt)) {
          if (isRevoke)
            wildcardRevokes.push(`${file}: ${stmt.trim().replace(/\s+/g, " ")}`);
          continue;
        }
        // The role list is everything after the LAST `from` / `to`, so a
        // function argument of type `text` or a schema called `to_something`
        // cannot be mistaken for the keyword.
        const kw = isRevoke ? /\bfrom\b/gi : /\bto\b/gi;
        let roleAt = -1;
        for (let m2; (m2 = kw.exec(stmt)); ) roleAt = m2.index;
        const roles =
          roleAt === -1
            ? []
            : stmt
                .slice(roleAt + (isRevoke ? 4 : 2))
                .split(",")
                .map((r) => r.trim().replace(/^"(.*)"$/, "$1").toLowerCase())
                .filter(Boolean);

        // A single REVOKE/GRANT may name several functions.
        const targetText = roleAt === -1 ? stmt : stmt.slice(0, roleAt);
        const re = /([A-Za-z0-9_."]+)\s*\(/g;
        let m;
        while ((m = re.exec(targetText))) {
          if (
            /^(revoke|grant|all|execute|on|function|privileges)$/i.test(m[1])
          )
            continue;
          const args = readParens(targetText, m.index + m[1].length);
          if (!args) continue;
          const k = key(normaliseName(m[1]), arity(args.inner));
          const bucket = isRevoke ? revokes : grants;
          if (!bucket.has(k)) bucket.set(k, []);
          bucket.get(k).push({ file, roles, index });
          re.lastIndex = args.end;
        }
        continue;
      }

      // ---- alter function ... set search_path = '' ----------------------
      const alter = /^alter\s+function\s+([A-Za-z0-9_."]+)\s*\(/i.exec(stmt);
      if (alter && PINS_EMPTY_SEARCH_PATH.test(stmt)) {
        const args = readParens(stmt, stmt.indexOf("(", alter[0].length - 1));
        if (!args) continue;
        const k = key(normaliseName(alter[1]), arity(args.inner));
        if (!alterPins.has(k)) alterPins.set(k, []);
        alterPins.get(k).push({ file, index });
      }
    }
  });

  return {
    files,
    definers,
    revokes,
    grants,
    alterPins,
    wildcardRevokes,
    parseWarnings,
    lastDrop,
    droppedSignatures,
  };
}

// ===========================================================================
// 4. Judging
// ===========================================================================

/**
 * A revoke covers a function when it names ALL THREE of public, anon and
 * authenticated. Naming only `public` is 0258's trap and is reported as a
 * distinct, more specific failure than "no revoke at all", because the two have
 * different fixes.
 */
function revokeVerdict(entries, grantEntries, droppedAt) {
  const after = (e) => droppedAt === undefined || e.index >= droppedAt;
  const live = (entries ?? []).filter(after);
  const grants = (grantEntries ?? []).filter(after);

  // (1) SILENCE — nothing in any migration says who may execute this.
  if (live.length === 0 && grants.length === 0) {
    return {
      ok: false,
      kind: "silent",
      staleOnly: (entries ?? []).length + (grantEntries ?? []).length > 0,
      droppedAt,
    };
  }

  const namesPublic = (e) => e.roles.includes("public");
  const namesAnon = (e) => e.roles.includes("anon");

  // House style: all three revoked, audience re-granted.
  const full = live.find((e) => ROLES_IDEAL.every((r) => e.roles.includes(r)));
  if (full) return { ok: true, kind: "explicit", file: full.file };

  // Revoke-only short form: anon is cut by name.
  const cutsAnon = live.find((e) => namesPublic(e) && namesAnon(e));
  if (cutsAnon)
    return {
      ok: true,
      kind: "anon-revoked-only",
      file: cutsAnon.file,
      roles: cutsAnon.roles,
    };

  // Grant-based short form: blanket dropped, audience named out loud.
  const droppedBlanket = live.find(namesPublic);
  if (droppedBlanket && grants.length > 0)
    return {
      ok: true,
      kind: "granted",
      file: droppedBlanket.file,
      grantFile: grants[0].file,
      grantRoles: grants[0].roles,
    };

  // (2) THE 0258 TRAP — a revoke that only drops the blanket PUBLIC grant,
  // with no grant afterwards to say what the audience actually is.
  if (droppedBlanket)
    return { ok: false, kind: "public-only", file: droppedBlanket.file };

  // A revoke that names neither public nor a grant — it removed something, but
  // the blanket PUBLIC grant survives it.
  if (grants.length > 0)
    return {
      ok: true,
      kind: "granted-no-public-revoke",
      grantFile: grants[0].file,
      grantRoles: grants[0].roles,
      roles: live[0]?.roles ?? [],
    };

  return { ok: false, kind: "public-only", file: live[0].file };
}

function judge(facts) {
  const { definers, revokes, grants, alterPins, lastDrop } = facts;
  const violations = [];
  const notes = [];

  for (const [k, fn] of [...definers].sort(([a], [b]) => a.localeCompare(b))) {
    const sig = `${fn.name}/${fn.arity}`;

    // --- audience -------------------------------------------------------
    const verdict = revokeVerdict(revokes.get(k), grants.get(k), lastDrop.get(k));

    if (verdict.ok && verdict.kind === "anon-revoked-only") {
      notes.push(
        `${sig} (created ${fn.file}) — revoke in ${verdict.file} names ` +
          `[${verdict.roles.join(", ")}], not \`authenticated\`. anon is cut, which is the part that ` +
          `matters; but authenticated then holds EXECUTE by Supabase default rather than by instruction.`,
      );
    } else if (verdict.ok && verdict.kind === "granted") {
      notes.push(
        `${sig} (created ${fn.file}) — pre-0281 spelling: \`revoke ... from public\` (${verdict.file}) ` +
          `then \`grant execute ... to ${verdict.grantRoles.join(", ")}\` (${verdict.grantFile}). The audience ` +
          `IS stated; anon's own default grant is simply left standing rather than revoked and re-granted.`,
      );
    } else if (verdict.ok && verdict.kind === "granted-no-public-revoke") {
      notes.push(
        `${sig} (created ${fn.file}) — grants execute to [${verdict.grantRoles.join(", ")}] ` +
          `(${verdict.grantFile}) but no revoke names \`public\`, so the blanket PUBLIC grant survives ` +
          `and a future role inheriting from PUBLIC would pick this up.`,
      );
    }

    if (!verdict.ok && verdict.kind === "silent" && verdict.staleOnly) {
      violations.push({
        sig,
        kind: "acl-reset-by-drop",
        file: fn.file,
        line: fn.line,
        problem:
          `every revoke/grant for this signature predates the \`drop function\` in ` +
          `${facts.files[verdict.droppedAt]}. DROP resets a function's ACL, so the re-created function ` +
          `came back with Supabase's default grants to anon and authenticated and nothing since has said ` +
          `otherwise. Re-issue the revoke after the drop.`,
      });
    } else if (!verdict.ok && verdict.kind === "silent") {
      // Same name, different arity: an overload whose revoke line was written
      // for a sibling signature. A REVOKE names exactly one signature, so the
      // sibling's line does nothing for this one — but the fix is "add the
      // missing signature", not "adopt the convention", so say that instead.
      const sibling = [...revokes.keys()].find(
        (rk) => rk.split("/")[0] === fn.name && rk !== k,
      );
      violations.push({
        sig,
        kind: sibling ? "overload-uncovered" : "silent",
        file: fn.file,
        line: fn.line,
        problem: sibling
          ? `no \`revoke\` and no \`grant execute\` for \`${fn.name}\` with ${fn.arity} argument(s) anywhere in ` +
            `supabase/migrations. There IS a revoke for ${sibling.replace("/", " with ")} argument(s) — a REVOKE ` +
            `names ONE signature, so this overload is still on Supabase's defaults and is callable by anon. ` +
            `Give it its own line.`
          : `SECURITY DEFINER, and no migration anywhere says who may execute it — no \`revoke ... on function ` +
            `${fn.name}(...)\`, no \`grant execute\`. Supabase grants EXECUTE to anon and authenticated by ` +
            `default, so as written this runs with the owner's privileges for any visitor holding the anon key ` +
            `(which ships in the JavaScript bundle). 0281 and 0284 are the worked examples. If it is meant to ` +
            `stay anon-callable that is fine — say so out loud: revoke from public, anon, authenticated, then ` +
            `grant execute to anon, authenticated.`,
      });
    } else if (!verdict.ok && verdict.kind === "public-only") {
      violations.push({
        sig,
        kind: "public-only",
        file: fn.file,
        line: fn.line,
        problem:
          `its only privilege statement is \`revoke ... from public\` (${verdict.file}), with no \`grant ` +
          `execute\` afterwards to say what the audience is. That looks like a lockdown and is not one: ` +
          `revoking from PUBLIC does not touch anon's and authenticated's OWN direct grants, which Supabase ` +
          `issues by default — the function is exactly as callable as before. That is 0258's lesson. Either ` +
          `name the roles in the revoke (\`from public, anon, authenticated\`) or add the \`grant execute\` ` +
          `that states who this is for.` +
          (fn.returnsTrigger
            ? ` NOTE: this one \`returns trigger\`, so PostgREST does not expose it as an /rpc/ endpoint and ` +
              `no browser role can reach it — the exposure is a stray privilege, not a live hole. 0281 group ` +
              `(c) revoked exactly this class anyway.`
            : ""),
      });
    }

    // --- search_path ----------------------------------------------------
    const pins = alterPins.get(k) ?? [];
    const laterAlter = pins.find((p) => p.index >= fn.index);
    if (!fn.pinned && !laterAlter) {
      const earlierAlter = pins.find((p) => p.index < fn.index);
      violations.push({
        sig,
        kind: fn.setsSearchPathToSomethingElse
          ? "search-path-not-empty"
          : "search-path-unpinned",
        file: fn.file,
        line: fn.line,
        problem: fn.setsSearchPathToSomethingElse
          ? `it sets search_path to something other than the empty string. ` +
            `\`search_path = public\` does not list pg_temp, which PostgreSQL searches FIRST for relations — ` +
            `0285 demonstrated a pg_temp table shadowing \`bookings\` under exactly that setting. Use \`set search_path = ''\` ` +
            `and schema-qualify every name in the body.`
          : `SECURITY DEFINER without \`set search_path = ''\` in its header` +
            (earlierAlter
              ? `. There is an \`alter function ... set search_path\` in ${earlierAlter.file}, but that migration runs BEFORE ` +
                `this ${fn.orReplace ? "create or replace" : "create"} — and CREATE OR REPLACE rewrites the SET clauses, so the ` +
                `earlier ALTER is undone. Put the pin in the header.`
              : `, and no later \`alter function ... set search_path = ''\`. An unpinned definer function resolves unqualified ` +
                `names through the caller's search_path.`),
      });
    }
  }

  return { violations, notes };
}

// ===========================================================================
// 5. main
// ===========================================================================
//
// ---------------------------------------------------------------------------
// WHAT THIS GATE CATCHES  (each of these was verified by planting one and
// watching the gate go red; the controls below were verified the same way)
// ---------------------------------------------------------------------------
//  * SILENCE — a `security definer` function for which NO migration anywhere
//    contains a `revoke` or a `grant execute` on that signature. Supabase grants
//    EXECUTE to anon and authenticated by default, so this is a definer function
//    callable by anyone holding the anon key, with nothing on record saying that
//    was intended.
//  * THE 0258 TRAP — `revoke ... from public;` and nothing else. Looks like a
//    lockdown, is not one: anon and authenticated keep their own direct grants.
//  * A definer function whose header does not pin `search_path = ''`, with no
//    later `alter function ... set search_path = ''` to rescue it.
//  * `set search_path = public` (or any non-empty value) — its own message,
//    because that is the 0285 defect rather than an omission.
//  * An ALTER that pins search_path but is then undone by a later
//    CREATE OR REPLACE, which rewrites SET clauses.
//  * A NEW OVERLOAD of an already-covered name that did not get its own line —
//    a REVOKE names exactly one signature.
//  * A signature whose only revoke/grant PREDATES a `drop function` on it. DROP
//    resets the ACL; the re-created function is back on Supabase's defaults.
//
// DELIBERATE NON-FAILURES — the false positives it was built to avoid
//  * `create or replace` of an existing function. The corpus is searched as a
//    whole, not per-file, so the revoke may live in any migration.
//  * A revoke in a LATER migration than the create — which is how 0281 and 0284
//    did it, in bulk, for functions created hundreds of migrations earlier.
//  * The ~39 functions that stay anon-callable on purpose. The convention is
//    "state your audience", not "lock everyone out". `revoke ... from public,
//    anon, authenticated;` + `grant execute ... to anon, authenticated;` passes,
//    and so does the pre-0281 short form `revoke ... from public;` +
//    `grant execute ... to anon, authenticated;`.
//  * The ~69 functions using a pre-0281 spelling. Reported as notes, never as
//    failures. Enforcing 0281's exact spelling corpus-wide produces 84 failures
//    in already-applied migrations, which is how a gate gets switched off.
//  * SUPERSEDED SIGNATURES. Migrations are replayed in order and `drop function`
//    removes a signature from the live set. Without this the gate reported five
//    dead overloads — three of them `place_guest_order` — which is the loudest
//    possible false positive: the money path, flagged wrongly, on every run.
//  * SECURITY INVOKER functions, of any kind. Out of scope by design; 0290
//    pinned six invoker trigger guards as tidiness, not as a rule.
//  * Anything written inside a `--` or block comment. 0284's prose contains the
//    literal words "revoke ... on function"; comments are stripped first.
//
// ---------------------------------------------------------------------------
// WHAT IT DOES NOT CATCH — a green run does not mean any of these are true
// ---------------------------------------------------------------------------
//  1. IT NEVER READS THE DATABASE. It checks what the migration files instruct.
//     A privilege granted by hand in the Supabase dashboard, or a function that
//     exists in production but in no migration, is invisible to it. The useful
//     direction is the converse: the files are what a restore replays, and
//     0284's whole finding was privileges that production had but no file did.
//  2. It matches on NAME + ARGUMENT COUNT, not argument types. Two overloads
//     with the same name and the same arity but different types are one function
//     to this gate, so one revoke line is credited to both.
//  3. It does not judge whether the GRANT is CORRECT. `grant execute to anon` on
//     a function that should have been admin-only passes cleanly. The gate
//     enforces that an audience is stated, never that a human picked the right
//     one — that judgement is 0281's prose and is still a human's to make. This
//     is the single biggest thing it does not do.
//  4. It does not read the function BODY. A pinned `search_path = ''` over an
//     unqualified `bookings` is a runtime failure this will not predict; 0285's
//     "QUALIFY FIRST, THEN TIGHTEN" is still on you.
//  5. It does not model `alter function ... owner to`, `alter default
//     privileges`, or role membership. A grant to a role that anon inherits
//     reads as a grant to that role only.
//  6. It does not check RLS, policies, tables, or views. 0290's "RLS enabled,
//     no policies" reasoning is out of scope.
//  7. Statement splitting is regex-and-scanner based, not a real PostgreSQL
//     parser. It handles `--`, `/* nested */`, '...' strings, "identifiers" and
//     $tag$ bodies; it would mis-handle exotica such as `E'\\'` escape strings.
//     Anything it cannot parse is announced as a `note:` line rather than being
//     silently skipped.
//  8. Entries in scripts/definer-baseline.json are forgiven by signature+kind.
//     A DIFFERENT kind of violation on a baselined function still fails.
// ---------------------------------------------------------------------------

/**
 * Splits violations into the ones the baseline forgives and the ones it does
 * not, and reports baseline entries that no longer correspond to anything (so
 * the file shrinks as things get fixed instead of rotting).
 */
function applyBaseline(violations) {
  let baseline = { grandfathered: [] };
  const path = join(dirname(fileURLToPath(import.meta.url)), "definer-baseline.json");
  try {
    baseline = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  const entries = baseline.grandfathered ?? [];
  const seen = new Set();
  const fresh = [];
  const forgiven = [];
  for (const v of violations) {
    const hit = entries.find(
      (e) => e.signature === v.sig && e.kind === v.kind,
    );
    if (hit) {
      seen.add(`${hit.signature}::${hit.kind}`);
      forgiven.push({ ...v, reason: hit.reason });
    } else {
      fresh.push(v);
    }
  }
  const stale = entries.filter(
    (e) => !seen.has(`${e.signature}::${e.kind}`),
  );
  return { fresh, forgiven, stale };
}

function main() {
  const listMode = process.argv.includes("--list");
  const verbose = listMode || process.argv.includes("--notes");
  const facts = collect();
  const { violations: allViolations, notes } = judge(facts);
  const { fresh: violations, forgiven, stale } = applyBaseline(allViolations);

  const total = facts.definers.size;
  console.log(
    `SECURITY DEFINER convention check — ${facts.files.length} migrations replayed in order; ` +
      `${total} definer signature(s) live at HEAD ` +
      `(${facts.droppedSignatures} superseded signature(s) dropped along the way and not checked).`,
  );

  if (listMode) {
    for (const [k, fn] of [...facts.definers].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const rv = revokeVerdict(
        facts.revokes.get(k),
        facts.grants.get(k),
        facts.lastDrop.get(k),
      );
      const pinned =
        fn.pinned ||
        (facts.alterPins.get(k) ?? []).some((p) => p.index >= fn.index);
      console.log(
        `  ${rv.ok && pinned ? "ok  " : "FAIL"} ${k.padEnd(56)} ` +
          `revoke:${(rv.ok ? rv.file.slice(0, 4) : rv.kind).padEnd(8)} ` +
          `search_path:${pinned ? "''      " : "UNPINNED"} created:${fn.file.slice(0, 4)}`,
      );
    }
  }

  for (const w of facts.parseWarnings) console.log(`  note: ${w}`);
  for (const w of facts.wildcardRevokes) {
    console.log(
      `  note: a schema-wide REVOKE was found and is NOT treated as covering ` +
        `individual functions (it does not survive a later CREATE) — ${w}`,
    );
  }

  if (notes.length > 0) {
    console.log(
      `\n${notes.length} function(s) state their audience in a pre-0281 spelling. Not failures — ` +
        `see 'WHERE THE FAILING BAR IS' in this file for why.` +
        (verbose ? "" : " Run with --notes to list them."),
    );
    if (verbose) for (const n of notes) console.log(`  - ${n}`);
  }

  if (forgiven.length > 0) {
    console.log(
      `\n${forgiven.length} known violation(s) grandfathered by scripts/definer-baseline.json ` +
        `(already applied to production; fixing one needs a NEW migration):`,
    );
    for (const v of forgiven) console.log(`  - ${v.sig} [${v.kind}] — ${v.reason}`);
  }

  for (const e of stale) {
    console.log(
      `\n  note: scripts/definer-baseline.json still grandfathers ${e.signature} [${e.kind}], ` +
        `which no longer violates. Delete that entry — a baseline that is not pruned stops meaning anything.`,
    );
  }

  if (violations.length === 0) {
    console.log(
      "\nPASS — no NEW violation. Every live SECURITY DEFINER function outside the baseline says who " +
        "may execute it and pins search_path = ''.",
    );
    console.log(
      "Read the 'WHAT IT DOES NOT CATCH' block in this file before treating that as a security clearance.",
    );
    return 0;
  }

  console.log(
    `\n${violations.length} NEW violation(s) of the SECURITY DEFINER convention ` +
      `(established in migrations 0281, 0284, 0285; re-broken and re-fixed in 0290):\n`,
  );
  const byFile = new Map();
  for (const v of violations) {
    if (!byFile.has(v.file)) byFile.set(v.file, []);
    byFile.get(v.file).push(v);
  }
  for (const [file, list] of byFile) {
    console.log(`  ${file}`);
    for (const v of list) {
      console.log(`    line ${v.line}  ${v.sig}`);
      console.log(`        ${v.problem}`);
    }
    console.log("");
  }
  console.log(
    "Fix by adding the missing lines to the migration that creates the function, " +
      "or — if it is already deployed — in a NEW migration. Do not silence this by " +
      "deleting `security definer`: that changes who the function runs as.",
  );
  return 1;
}

process.exit(main());
