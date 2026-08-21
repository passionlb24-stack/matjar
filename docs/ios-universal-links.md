# iOS Universal Links — the owner's checklist (B-26)

**What this is for.** Tapping a `matjarlb.com` link on an iPhone that has the
Matjar app installed currently opens **Safari**, not the app. Every link the
platform sends — a push notification, an order confirmation, a merchant sharing
their shop on WhatsApp — lands in the browser. This is the list of steps that
fixes that on iPhone. It needs no programming and takes a few minutes.

The Android equivalent is a separate file, `docs/android-app-links.md`, and a
separate value. Doing one does not do the other.

**Why it is not already done.** iOS only opens links in the app if the website
publicly says "yes, that app is mine". It says so by serving one small file, and
that file has to name your **Apple Team ID** — a ten-character code that
identifies your Apple Developer account. That code lives in your Apple account,
not in this repository. Nobody but you can read it. So the site was built to
serve the file with a blank where the Team ID goes, and you fill the blank in.

**What is already done (nothing to do here):**

- The website serves the file at
  `https://matjarlb.com/.well-known/apple-app-site-association`, from
  `src/app/.well-known/apple-app-site-association/route.ts`.
- It is served with no file extension and as `application/json`, which is what
  Apple requires. Either one wrong and iOS never fetches it.
- That address is excluded from the Arabic/English URL redirect, so it answers
  directly. Apple treats *any* redirect on this path as a failure. There is a
  test asserting the exclusion in `src/lib/__tests__/applinks.test.ts`.
- Password-reset and `/api/` links are deliberately excluded from opening in the
  app. A recovery link that opens the app strands you, because the recovery
  token gets used up by the browser session.
- Until you complete step 2, that address answers **503** with
  `{"error":"not_configured"}` and writes a line into the Vercel logs. That is
  deliberate: a broken setup that is loud beats one that quietly serves an empty
  file and looks finished.

---

## Step 1 — Copy your Apple Team ID

1. Sign in at **developer.apple.com/account**.
2. In the sidebar, open **Membership** (on some accounts it reads **Membership
   details**).
3. Find the line labelled **Team ID**. It is exactly ten characters, letters and
   digits, like `A1B2C3D4E5`.
4. Copy it.

If you see several teams, pick the one the Matjar app is published under. If the
app is not published yet, pick the team you will publish it under — this can be
changed later by repeating these steps.

## Step 2 — Paste it into Vercel

1. Open **vercel.com** → your Matjar project → **Settings** → **Environment
   Variables**.
2. **Add New**.
   - Name: `IOS_APP_TEAM_ID`
   - Value: the ten characters from step 1
   - Environment: **Production** (tick Preview too if you want it working on
     preview builds)
3. **Save**.

You may paste either the bare Team ID (`A1B2C3D4E5`) or the full form
(`A1B2C3D4E5.com.matjarlb.app`). Both are accepted. Capitals and stray spaces
are cleaned up automatically.

## Step 3 — Redeploy

Vercel does not apply a new environment variable to the site that is already
running. Go to **Deployments**, click the **⋯** menu on the newest one, and
choose **Redeploy**.

## Step 4 — Check it worked

Open this in a browser:

```
https://matjarlb.com/.well-known/apple-app-site-association
```

You should see a block of text containing your Team ID followed by
`.com.matjarlb.app`. If you instead see `{"error": ...}`, use the table below.

| What you see | What it means | What to do |
|---|---|---|
| `"error":"not_configured"` | The variable is not on the deployment | You saved it to the wrong environment, or did not redeploy. Redo steps 2–3. |
| `"error":"invalid_team_id"` | The value is not a ten-character Team ID | You copied the wrong line, or copied an App ID belonging to another bundle. Redo step 1. |
| A page of Arabic text | The address got redirected | Report this — the redirect exclusion has regressed. |
| Your Team ID | Correct | Continue to step 5. |

## Step 5 — Test on a real iPhone

This is the only step that proves it, and it needs a physical device.

1. Install the Matjar app on the iPhone.
2. Send yourself a `matjarlb.com` link — a shop link works well — in **Messages**
   or **Notes**. Do *not* type it into Safari's address bar; typed URLs
   deliberately never open apps.
3. Tap it. It should open **inside the Matjar app**.

If it opens Safari, and step 4 showed your Team ID, the usual cause is that
Apple's servers still hold the previous version of the file. Apple caches it on
their own CDN rather than fetching it from the device, so a fix can take up to
24 hours to reach phones. Deleting and reinstalling the app forces a fresh
check.

---

## The one thing to be careful about later

If you ever change the Apple account the app is published under, the Team ID
changes, and Universal Links stop working on every installed iPhone until you
repeat step 2 with the new value. There is no warning when this happens: links
simply start opening Safari again. If a merchant reports that "links stopped
opening the app", check step 4 first.
