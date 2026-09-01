import { ProfessionalAboutText } from "./professional-about-text";
import type { ProfessionalDict } from "./copy";

// The professional's own words about themselves.
//
// `null` on an empty or whitespace-only bio — the same test `profileBlocks()`
// uses in lib/professional, so the block resolver and this component can never
// disagree about whether there is an "about" to show. A bio of "   " is not a
// bio.
//
// The section is a server component and only the two expander labels cross into
// the client, so the dictionary is not serialised into the page.

export function ProfessionalAbout({
  bio,
  dict,
  title,
  id,
  className = "",
}: {
  bio?: string | null;
  dict: ProfessionalDict;
  /** `null` suppresses the heading; omitted uses the dictionary's. */
  title?: string | null;
  id?: string;
  className?: string;
}) {
  const text = (bio ?? "").trim();
  if (!text) return null;

  const t = dict.professional.about;
  const heading = title === undefined ? t.title : title;

  return (
    <section id={id} className={className}>
      {heading && <h2 className="mb-3 text-lg font-extrabold">{heading}</h2>}
      <ProfessionalAboutText text={text} more={t.more} less={t.less} />
    </section>
  );
}
