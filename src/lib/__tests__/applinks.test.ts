import { describe, expect, it } from "vitest";
import { IOS_BUNDLE_ID, appSiteAssociation, parseAppId } from "@/lib/applinks";
import { config as proxyConfig } from "@/proxy";

// Universal Links fail in total silence. There is no error on the device, no
// warning in a log, no failed request to notice — iOS simply keeps opening
// Safari, and the only symptom is a user saying "the link doesn't open the app",
// which is indistinguishable from them not having it installed. So the parsing
// is strict and the tests are about the ways a real person's clipboard is wrong.

const TEAM = "ABCDE12345";

describe("parseAppId", () => {
  it("treats an unset variable as unconfigured rather than as an empty document", () => {
    // The distinction matters: unconfigured must produce a 503, whereas an
    // "empty but valid" AASA is a document Apple's CDN will happily cache and
    // then serve to devices as proof that this domain vouches for nothing.
    expect(parseAppId(undefined)).toEqual({ ok: false, reason: "missing" });
    expect(parseAppId("")).toEqual({ ok: false, reason: "missing" });
    expect(parseAppId("   ")).toEqual({ ok: false, reason: "missing" });
  });

  it("accepts the bare Team ID, which is what the Membership page shows", () => {
    expect(parseAppId(TEAM)).toEqual({
      ok: true,
      appId: `${TEAM}.${IOS_BUNDLE_ID}`,
      teamId: TEAM,
    });
  });

  it("accepts a full App ID, which is what most tutorials show", () => {
    expect(parseAppId(`${TEAM}.${IOS_BUNDLE_ID}`)).toEqual({
      ok: true,
      appId: `${TEAM}.${IOS_BUNDLE_ID}`,
      teamId: TEAM,
    });
  });

  it("forgives case and stray whitespace from a paste", () => {
    expect(parseAppId(`  ${TEAM.toLowerCase()}  `).ok).toBe(true);
    expect(parseAppId(`${TEAM.toLowerCase()}.${IOS_BUNDLE_ID}`)).toEqual({
      ok: true,
      appId: `${TEAM}.${IOS_BUNDLE_ID}`,
      teamId: TEAM,
    });
  });

  it("rejects a Team ID of the wrong length", () => {
    // Apple Team IDs are exactly ten characters. Nine or eleven is a mis-paste,
    // and coercing it would serve a document that verifies nothing.
    expect(parseAppId("ABCDE1234").ok).toBe(false);
    expect(parseAppId("ABCDE123456").ok).toBe(false);
  });

  it("rejects a Team ID containing characters Apple does not issue", () => {
    expect(parseAppId("ABCDE-1234").ok).toBe(false);
    expect(parseAppId("ABCDE_1234").ok).toBe(false);
  });

  it("refuses to pair our Team ID with somebody else's bundle", () => {
    // This is the one that matters beyond typos. A document naming a bundle we
    // do not control would hand this domain's links to another party's app.
    expect(parseAppId(`${TEAM}.com.someone.else`)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });
});

describe("appSiteAssociation", () => {
  const doc = appSiteAssociation(`${TEAM}.${IOS_BUNDLE_ID}`);
  const components = doc.applinks.details[0].components;

  it("names exactly the one app", () => {
    expect(doc.applinks.details).toHaveLength(1);
    expect(doc.applinks.details[0].appIDs).toEqual([`${TEAM}.${IOS_BUNDLE_ID}`]);
  });

  it("claims no capability it does not have", () => {
    // `webcredentials` would claim password autofill and `appclips` an App Clip.
    // Neither exists; declaring either is a promise with nothing behind it.
    expect(doc).not.toHaveProperty("webcredentials");
    expect(doc).not.toHaveProperty("appclips");
  });

  it("keeps password recovery in the browser", () => {
    // The recovery token is consumed by the web session. A reset link that opens
    // the app strands the user mid-recovery with a token already spent — the
    // classic universal-links footgun, and the reason exclusions exist.
    const excluded = components
      .filter((c) => "exclude" in c && c.exclude)
      .map((c) => c["/"]);
    expect(excluded).toEqual(
      expect.arrayContaining([
        "/api/*",
        "/*/reset-password*",
        "/*/forgot-password*",
        "/auth/*",
      ]),
    );
  });

  it("puts the catch-all last, because iOS takes the first match", () => {
    // Order is load-bearing: `/*` ahead of an exclusion would swallow it.
    const last = components[components.length - 1];
    expect(last).toEqual({ "/": "/*" });
    expect(components.filter((c) => c["/"] === "/*")).toHaveLength(1);
  });
});

describe("the proxy must not touch the verification path", () => {
  it("excludes .well-known, so iOS never sees a redirect", () => {
    // Apple treats any redirect on this path as a failure. The locale proxy
    // would otherwise send /.well-known/... to /ar/.well-known/... and break
    // Universal Links for every installed app, silently.
    expect(proxyConfig.matcher.some((m) => m.includes("\\.well-known"))).toBe(
      true,
    );
  });
});
