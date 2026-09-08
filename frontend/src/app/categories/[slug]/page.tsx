import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Layers, ArrowLeft, Filter } from 'lucide-react';
import { fetchProducts } from '@/lib/api';
import ProductCard from '@/components/ProductCard';

interface Props {
  params: { slug: string };
  searchParams: { q?: string; page?: string };
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const categoryName = decodeURIComponent(params.slug).replace(/-/g, ' ');
  const title = `${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} Collections | Ropenix Collections`;
  return {
    title,
    description: `Explore ${categoryName} performance gear and electronics at Ropenix Collections East Africa. Fast shipping to Kenya, Uganda, Tanzania & Rwanda.`,
    alternates: {
      canonical: `https://ropenix.co.ke/categories/${params.slug}`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const categorySlug = decodeURIComponent(params.slug);
  const { hits: products, totalHits } = await fetchProducts({
    category: categorySlug,
    query: searchParams.q,
    page: searchParams.page ? parseInt(searchParams.page) : 1,
  });

  const displayName = categorySlug.replace(/-/g, ' ').toUpperCase();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Category Header */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-8 sm:p-12 shadow-xl">
        <nav className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-4">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="text-indigo-400 font-semibold">{displayName}</span>
        </nav>

        <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight">
          {displayName}
        </h1>
        <p className="text-sm text-slate-300 font-light mt-2 max-w-xl">
          Engineered for active lifestyles. Showing {products.length} products available for instant regional dispatch.
        </p>
      </div>

      {/* Product Grid */}
      {products.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="py-20 text-center space-y-4 bg-white rounded-3xl border border-slate-100 p-8">
          <Layers className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-lg font-bold text-slate-700">No items found in this category</h3>
          <p className="text-xs text-slate-400 font-light">
            Check back soon for new arrivals or explore other collections.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Home
          </Link>
        </div>
      )}
    </div>
  );
}
