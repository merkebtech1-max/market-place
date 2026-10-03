import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { CategoryName } from "@/features/catalog/components/CategoryName";
import { SearchResults } from "@/features/search/components/SearchResults";
import { applyFilters } from "@/features/search/utils";
import { T } from "@/il8n/T";
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
    <Container className="py-4 sm:py-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-primary-soft sm:h-14 sm:w-14">
          <Image
            src={cat.imageUrl}
            alt=""
            fill
            quality={90}
            sizes="56px"
            className="object-contain p-0.5"
          />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-ink sm:text-xl">
            <CategoryName category={cat} />
          </h1>
          <p className="text-sm text-ink-muted">
            {results.length} <T k="common.results" />
          </p>
        </div>
      </div>
      <SearchResults listings={results} />
    </Container>
  );
}
