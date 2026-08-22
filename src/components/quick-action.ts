// The store profile's phone-sized quick actions (§17).
//
// The top of a business profile has to answer "what can I do" in one row. It
// used to answer it with seven labelled pills — تابِع, مشاركة, راسل المتجر,
// اتصال, واتساب, إنستغرام, فيسبوك — which at 390px wrapped over three rows,
// occupied 130px of an 844px screen, and were 38px tall: every one of them
// under the 44px minimum, measured with the ::before hit area included.
//
// These two class strings are the shared answer, so the three client buttons
// (follow / share / message) and the plain anchors in StoreHeader cannot drift
// apart by a pixel. Mobile-first: the base classes ARE the phone presentation
// and every `lg:` token restores the desktop pill exactly as it was, so a
// caller that opts in changes nothing at 1024px and up.
//
// 40 × 44 visually, 44 × 44 to a thumb: the extra 4px of width comes from the
// transparent `before:-inset-x-0.5` hit area this repo uses everywhere, so five
// actions still fit one row inside a 320px viewport (5×40 + 4×6 = 224 ≤ 240)
// without any of them being a 40px target.
export const QUICK_ACTION_BASE =
  "relative h-11 w-10 justify-center before:absolute before:-inset-x-0.5 before:content-[''] " +
  "lg:h-auto lg:w-auto lg:justify-start lg:px-4 lg:py-2 lg:before:content-none";

/** Wraps the button's own words: gone on a phone, back from lg up. */
export const QUICK_ACTION_LABEL = "hidden lg:inline";
