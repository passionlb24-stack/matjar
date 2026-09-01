import type { ProfessionalDict } from "./copy";

// Skill chips.
//
// A list, not prose, because this is the block a customer scans rather than
// reads. And nothing at all when the list is empty — which is every professional
// on the platform today, so this component's most common rendering is `null`.

export function ProfessionalSkills({
  skills,
  dict,
  title,
  id,
  className = "",
}: {
  skills: string[];
  dict: ProfessionalDict;
  /** `null` suppresses the heading; omitted uses the dictionary's. */
  title?: string | null;
  id?: string;
  className?: string;
}) {
  if (!skills.length) return null;

  const heading =
    title === undefined ? dict.professional.skills.title : title;

  return (
    <section id={id} className={className}>
      {heading && <h2 className="mb-3 text-lg font-extrabold">{heading}</h2>}
      <ul className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <li
            key={skill}
            dir="auto"
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-bold text-muted-foreground"
          >
            {skill}
          </li>
        ))}
      </ul>
    </section>
  );
}
