import { Search, ShoppingBag, Truck, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Container } from "@/components/ui/container";

const stepIcons: LucideIcon[] = [Search, ShoppingBag, Truck];

export function HowItWorks({ dict }: { dict: Dictionary }) {
  return (
    <section className="py-14 sm:py-16">
      <Container>
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight">
            {dict.howItWorks.title}
          </h2>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {dict.howItWorks.steps.map((step, i) => {
            const Icon = stepIcons[i];
            return (
              <div key={step.title} className="text-center">
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                  <Icon className="h-7 w-7" />
                  <span className="absolute -end-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold">{step.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-muted-foreground">
                  {step.body}
                </p>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
