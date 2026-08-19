import { describe, expect, it } from "vitest";
import { assetLinksDocument, parseFingerprints } from "@/lib/assetlinks";
import { config as proxyConfig } from "@/proxy";

// A fingerprint that is wrong by one character does not throw and does not warn
// — Android simply never verifies the domain and every https link keeps opening
// the browser. So the validation has to be strict, and the forgiveness has to be
// limited to things that are unambiguously the same fingerprint.

const PLAY = "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";

describe("parseFingerprints", () => {
  it("treats an unset variable as nothing configured, not as an empty list", () => {
    expect(parseFingerprints(undefined)).toEqual({
      fingerprints: [],
      invalid: [],
    });
    expect(parseFingerprints("")).toEqual({ fingerprints: [], invalid: [] });
    expect(parseFingerprints("   ")).toEqual({ fingerprints: [], invalid: [] });
  });

  it("accepts the canonical keytool form", () => {
    expect(parseFingerprints(PLAY).fingerprints).toEqual([PLAY]);
  });

  it("accepts lowercase and stray whitespace, because that is what gets pasted", () => {
    const pasted = `  ${PLAY.toLowerCase().replace(":66:", ":66:\n")}  `;
    expect(parseFingerprints(pasted).fingerprints).toEqual([PLAY]);
  });

  it("accepts 64 bare hex characters and puts the colons back", () => {
    expect(parseFingerprints(PLAY.replace(/:/g, "")).fingerprints).toEqual([
      PLAY,
    ]);
  });

  it("keeps several fingerprints so a Play build and a local build both verify", () => {
    const local = PLAY.replace(/^AA/, "01");
    const parsed = parseFingerprints(`${PLAY}, ${local}`);
    expect(parsed.fingerprints).toEqual([PLAY, local]);
    expect(parsed.invalid).toEqual([]);
  });

  it("de-duplicates rather than serving the same key twice", () => {
    expect(parseFingerprints(`${PLAY},${PLAY.toLowerCase()}`).fingerprints)
      .toEqual([PLAY]);
  });

  it.each([
    ["too short", PLAY.slice(0, -3)],
    ["too long", `${PLAY}:AA`],
    ["not hex", PLAY.replace("AA", "ZZ")],
    ["a SHA-1 fingerprint", "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD"],
    ["the docs placeholder text", "PASTE_YOUR_FINGERPRINT_HERE"],
    ["a keytool line rather than the value", `SHA256: ${PLAY}`],
  ])("rejects %s so the route can fail loudly", (_label, value) => {
    const parsed = parseFingerprints(value);
    expect(parsed.fingerprints).toEqual([]);
    expect(parsed.invalid).toEqual([value]);
  });

  it("reports the good ones and the bad ones separately", () => {
    const parsed = parseFingerprints(`${PLAY},nonsense`);
    expect(parsed.fingerprints).toEqual([PLAY]);
    expect(parsed.invalid).toEqual(["nonsense"]);
  });
});

// The route can be perfect and App Links still fail, because the locale proxy
// redirects `/x` to `/ar/x` and Android's verifier counts any redirect as a
// failure. This asserts the exclusion rather than trusting the comment.
describe("proxy matcher", () => {
  const matcher = new RegExp(`^${proxyConfig.matcher[0]}$`);

  it("does not run on the assetlinks path, so it is never redirected", () => {
    expect(matcher.test("/.well-known/assetlinks.json")).toBe(false);
  });

  it("does not run on any .well-known path", () => {
    expect(matcher.test("/.well-known/apple-app-site-association")).toBe(false);
    expect(matcher.test("/.well-known/")).toBe(false);
  });

  it("still runs on the pages that need the locale redirect", () => {
    expect(matcher.test("/")).toBe(true);
    expect(matcher.test("/ar/merchant")).toBe(true);
    expect(matcher.test("/store/abc")).toBe(true);
  });
});

describe("assetLinksDocument", () => {
  it("is the exact shape Android's verifier expects", () => {
    expect(assetLinksDocument([PLAY])).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: "com.matjarlb.app",
          sha256_cert_fingerprints: [PLAY],
        },
      },
    ]);
  });
});
