import { Container } from "@/components/ui/container";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the categories page: a title, then the category tile grid
// (2-up mobile, 3-up desktop).
export default function CategoriesLoading() {
  return (
    <div className="pt-8">
      <Container>
        <Skeleton className="h-9 w-40" />
      </Container>
      <section className="py-14 sm:py-16">
        <Container>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-2xl sm:h-40" />
            ))}
          </div>
        </Container>
      </section>
    </div>
  );
}
