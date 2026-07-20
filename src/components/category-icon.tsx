import {
  Building2,
  Car,
  ShoppingBag,
  Stethoscope,
  UtensilsCrossed,
  Wrench,
  Scissors,
  Dumbbell,
  Trophy,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import type { CategoryKey } from "@/lib/catalog";

export const categoryIcons: Record<CategoryKey, LucideIcon> = {
  food: UtensilsCrossed,
  retail: ShoppingBag,
  services: Wrench,
  healthcare: Stethoscope,
  realEstate: Building2,
  automotive: Car,
  beauty: Scissors,
  fitness: Dumbbell,
  sportsCourts: Trophy,
  education: GraduationCap,
};
