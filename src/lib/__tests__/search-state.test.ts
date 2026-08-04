import { describe, it, expect } from "vitest";
import { resolveSearch, type SearchAnswer } from "@/lib/search-state";

type Hit = { id: string };
const hits = (...ids: string[]): Hit[] => ids.map((id) => ({ id }));

describe("resolveSearch", () => {
  it("stays idle below the minimum length", () => {
    const s = resolveSearch<Hit>("ش", null);
    expect(s.active).toBe(false);
    expect(s.searching).toBe(false);
    expect(s.results).toBeNull();
  });

  it("trims before measuring, so spaces don't start a lookup", () => {
    expect(resolveSearch<Hit>("  ش  ", null).active).toBe(false);
    expect(resolveSearch<Hit>("  شاورما  ", null).term).toBe("شاورما");
  });

  it("is searching once the term is long enough and no answer has arrived", () => {
    const s = resolveSearch<Hit>("شاورما", null);
    expect(s.active).toBe(true);
    expect(s.searching).toBe(true);
    expect(s.results).toBeNull();
  });

  it("shows the hits once the answer matches the term", () => {
    const answer: SearchAnswer<Hit> = { term: "شاورما", hits: hits("a", "b") };
    const s = resolveSearch("شاورما", answer);
    expect(s.searching).toBe(false);
    expect(s.results).toHaveLength(2);
  });

  // The bug this whole shape exists to prevent: a slow response for an earlier
  // word used to lower the flag, stopping the spinner while the user was still
  // waiting on the word they had actually typed.
  it("keeps searching when the held answer belongs to an earlier term", () => {
    const stale: SearchAnswer<Hit> = { term: "شاور", hits: hits("a") };
    const s = resolveSearch("شاورما", stale);
    expect(s.searching).toBe(true);
    expect(s.results).toBeNull();
  });

  it("never shows another term's hits, even after the user types on", () => {
    const answer: SearchAnswer<Hit> = { term: "لحمة", hits: hits("x", "y", "z") };
    expect(resolveSearch("لحمة بقر", answer).results).toBeNull();
  });

  it("distinguishes a failed lookup from one that found nothing", () => {
    expect(resolveSearch("شاورما", { term: "شاورما", hits: null }).results).toBeNull();
    expect(resolveSearch("شاورما", { term: "شاورما", hits: [] }).results).toEqual([]);
    // Both stop the spinner: an answer arrived either way.
    expect(resolveSearch("شاورما", { term: "شاورما", hits: null }).searching).toBe(false);
    expect(resolveSearch("شاورما", { term: "شاورما", hits: [] }).searching).toBe(false);
  });

  it("drops back to idle when the query is cleared, without a stale flag", () => {
    const answer: SearchAnswer<Hit> = { term: "شاورما", hits: hits("a") };
    const s = resolveSearch("", answer);
    expect(s.active).toBe(false);
    expect(s.searching).toBe(false);
    expect(s.results).toBeNull();
  });

  it("honours a custom minimum length", () => {
    expect(resolveSearch<Hit>("ab", null, 3).active).toBe(false);
    expect(resolveSearch<Hit>("abc", null, 3).active).toBe(true);
  });
});
