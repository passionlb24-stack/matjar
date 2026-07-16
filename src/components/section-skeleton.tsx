import { Container } from "@/components/ui/container";

// Streaming placeholder for the homepage's async data sections. Rendered in the
// static shell so the Hero paints instantly; the real section streams in when
// its query resolves.
export function SectionSkeleton({
  cards = 4,
  grid = true,
}: {
  cards?: number;
  grid?: boolean;
}) {
  return (
    <div className="py-8">
      <Container>
        <div className="h-7 w-52 max-w-[60%] animate-pulse rounded-lg bg-surface-muted" />
        <div
          className={
            grid
              ? "mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
              : "mt-6 space-y-3"
          }
        >
          {Array.from({ length: cards }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-2xl border border-border bg-surface-muted"
            />
          ))}
        </div>
      </Container>
    </div>
  );
}
