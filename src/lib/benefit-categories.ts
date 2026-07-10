import type { BenefitCategory } from "./types";

export type BenefitTabCategory = "workshop" | "bootcamp" | "vl" | "lainnya";

export const BENEFIT_CATEGORY_OPTIONS: Array<{ value: BenefitCategory; label: string; description: string }> = [
  { value: "vl", label: "Video Learning", description: "Kursus rekaman mandiri" },
  { value: "wpb", label: "WPB (Legacy)", description: "Kategori lama, tampil di tab Video Learning" },
  { value: "bootcamp", label: "Bootcamp", description: "Program intensif dengan mentor" },
  { value: "workshop", label: "Workshop", description: "Kelas online terjadwal" },
  { value: "review_cv", label: "Review CV", description: "Benefit bonus lainnya" },
  { value: "downloadable", label: "Downloadable", description: "E-book, template, atau file bonus" },
];

const VALID_BENEFIT_CATEGORIES = new Set<BenefitCategory>([
  "vl",
  "wpb",
  "bootcamp",
  "workshop",
  "review_cv",
  "downloadable",
]);

function cleanBenefitCategories(value: unknown): BenefitCategory[] {
  if (!Array.isArray(value)) return [];
  const unique: BenefitCategory[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    if (!VALID_BENEFIT_CATEGORIES.has(item as BenefitCategory)) continue;
    if (!unique.includes(item as BenefitCategory)) unique.push(item as BenefitCategory);
  }
  return unique;
}

export function getExplicitBenefitCategories(eventData: any): BenefitCategory[] {
  const topLevel = cleanBenefitCategories(eventData?.benefitCategories);
  if (topLevel.length > 0) return topLevel;
  return cleanBenefitCategories(eventData?.beasiswaConfig?.benefitCategories);
}

export function resolveBenefitCategories(eventData: any): BenefitCategory[] | null {
  const explicit = getExplicitBenefitCategories(eventData);
  if (explicit.length > 0) return explicit;

  const legacyType = eventData?.beasiswaConfig?.type;
  if (typeof legacyType === "string" && VALID_BENEFIT_CATEGORIES.has(legacyType as BenefitCategory)) {
    return [legacyType as BenefitCategory];
  }

  return null;
}

export function isBenefitCategoryAllowed(topicCategory: string | undefined | null, allowed: BenefitCategory[] | null): boolean {
  if (!allowed || allowed.length === 0) return true;
  const category = (topicCategory || "vl") as BenefitCategory;
  if (category === "wpb" && allowed.includes("vl")) return true;
  if (category === "vl" && allowed.includes("wpb")) return true;
  return allowed.includes(category);
}

export function isBenefitTabAllowed(tab: BenefitTabCategory, allowed: BenefitCategory[] | null): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (tab === "vl") return allowed.includes("vl") || allowed.includes("wpb");
  if (tab === "lainnya") return allowed.includes("review_cv") || allowed.includes("downloadable");
  return allowed.includes(tab);
}
