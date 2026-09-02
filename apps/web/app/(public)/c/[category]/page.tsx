import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { SearchResults } from "@/features/search/components/SearchResults";
import { applyFilters } from "@/features/search/utils";
import { getCategoryBySlug, listings } from "@/lib/mock-data";

type CategoryPageProps = { params: Promise<{ category: string }> };

// The main SEO surface (SRS §6) — revalidated on an interval rather than per-request.
export const revalidate = 300;

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category } = await params;
  const cat = getCategoryBySlug(category);
  if (!cat) return { title: "Category not found — Merkeb Market" };
  return {
    title: `${cat.nameEn} for sale — Merkeb Market`,
    description: `Browse ${cat.nameEn.toLowerCase()} listings from verified sellers near you.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const cat = getCategoryBySlug(category);
  if (!cat) notFound();

  const results = applyFilters(listings, { category: cat.slug, sort: "relevance" });

  return (
    <Container className="py-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-xl" aria-hidden>
          {cat.icon}
        </span>
        <div>
          <h1 className="text-xl font-semibold text-ink">{cat.nameEn}</h1>
          <p className="text-sm text-ink-muted">{results.length} results</p>
        </div>
      </div>
      <SearchResults listings={results} />
    </Container>
  );
}
