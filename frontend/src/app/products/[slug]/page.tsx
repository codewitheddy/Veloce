import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Star, ShieldCheck, Truck, RotateCcw, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchProductBySlug, fetchProducts } from '@/lib/api';
import AddToCartButton from '@/components/AddToCartButton';
import ProductCard from '@/components/ProductCard';
import { formatRichDescription } from '@/lib/formatDescription';

interface Props {
  params: { slug: string };
}

export const revalidate = 60; // ISR cache revalidation

// 1. Dynamic SEO Metadata Generation for Googlebot
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await fetchProductBySlug(params.slug);
  if (!product) {
    return {
      title: 'Product Not Found | Ropenix Collections',
    };
  }

  const title = `${product.name} | Ropenix Collections East Africa`;
  const description =
    product.description ||
    `Shop ${product.name} at Ropenix Collections. High-quality performance wear and electronics with instant M-Pesa checkout and regional delivery.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://ropenix.co.ke/products/${product.slug || product.id}`,
      images: product.image_url ? [{ url: product.image_url }] : [],
      type: 'article',
    },
    alternates: {
      canonical: `https://ropenix.co.ke/products/${product.slug || product.id}`,
    },
  };
}

// 2. React Server Component (RSC)
export default async function ProductDetailPage({ params }: Props) {
  const product = await fetchProductBySlug(params.slug);
  if (!product) {
    notFound();
  }

  const { hits: related } = await fetchProducts({
    category: product.category,
    pageSize: 4,
  });

  // 3. Schema.org JSON-LD Structured Data for Google Rich Snippets
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    image: product.image_url ? [product.image_url] : [],
    description: product.description || product.name,
    sku: product.sku,
    brand: {
      '@type': 'Brand',
      name: product.brand || 'Ropenix Collections',
    },
    offers: {
      '@type': 'Offer',
      url: `https://ropenix.co.ke/products/${product.slug || product.id}`,
      priceCurrency: 'KES',
      price: product.price,
      priceValidUntil: '2027-12-31',
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@type': 'Organization',
        name: 'Ropenix Collections East Africa',
      },
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: product.rating || 5.0,
      reviewCount: product.reviews_count || 1,
    },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-16">
      {/* JSON-LD Script Tag */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs font-mono text-slate-500">
        <Link href="/" className="hover:text-indigo-600 transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link
          href={`/categories/${encodeURIComponent(product.category?.toLowerCase() || 'general')}`}
          className="hover:text-indigo-600 transition-colors"
        >
          {product.category || 'Apparel'}
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-semibold truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Product Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Gallery / Image View */}
        <div className="space-y-4">
          <div className="relative aspect-square w-full rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-md">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold">
                ROPENIX
              </div>
            )}
          </div>
        </div>

        {/* Product Purchase Box */}
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono uppercase">
                {product.category || 'Veloce Series'}
              </span>
              <span className="text-xs font-mono text-slate-400">SKU: {product.sku}</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black font-display text-slate-900 tracking-tight">
              {product.name}
            </h1>

            {/* Ratings & Social Proof */}
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-xs font-bold text-slate-700 font-mono">
                {product.rating || 5.0} ({product.reviews_count || 12} reviews)
              </span>
            </div>
          </div>

          {/* Pricing Display */}
          <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-baseline gap-3">
            <span className="text-3xl font-black font-mono text-slate-900">
              KSh {Number(product.price).toLocaleString()}
            </span>
            {product.original_price && (
              <span className="text-sm font-mono text-slate-400 line-through">
                KSh {Number(product.original_price).toLocaleString()}
              </span>
            )}
          </div>

          {/* Description */}
          <div
            className="prose prose-sm text-slate-600 font-normal leading-relaxed space-y-2"
            dangerouslySetInnerHTML={{
              __html: formatRichDescription(
                product.description ||
                  'High-performance materials tailored for ultimate durability, breathable comfort, and modern styling. Engineered for active lifestyles across East Africa.'
              ),
            }}
          />

          {/* Interactive Client Add To Cart (Hooked to Zustand) */}
          <AddToCartButton product={product} />

          {/* Value Badges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>Express Regional Dispatch</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-violet-600 shrink-0" />
              <span>Official Warranty</span>
            </div>
            <div className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600 shrink-0" />
              <span>7-Day Return Drop</span>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <div className="space-y-6 pt-12 border-t border-slate-100">
          <h3 className="text-xl font-black font-display text-slate-900">
            You May Also Like
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related
              .filter((p) => p.id !== product.id)
              .slice(0, 4)
              .map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
