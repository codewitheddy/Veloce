import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, ShieldCheck, Zap, TrendingUp, Layers } from 'lucide-react';
import { fetchProducts } from '@/lib/api';
import ProductCard from '@/components/ProductCard';

export const revalidate = 60; // Incremental Static Regeneration every 60s

export default async function HomePage() {
  const { hits: products } = await fetchProducts({ pageSize: 12 });
  const featured = products.filter((p) => p.is_featured).slice(0, 4);
  const flashSale = products.slice(0, 8);

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white py-20 lg:py-32 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_50%)]" />
        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-mono font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <span>Next-Gen East Africa D2C Storefront</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black font-display tracking-tight leading-[1.1]">
              Engineered for Speed. Built for <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-300">Peak Performance.</span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300 max-w-xl font-light">
              Experience instant mobile ordering with automatic M-Pesa STK push, multi-currency pricing across Kenya, Uganda, Tanzania & Rwanda, and 24-hour dispatch.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/categories/apparel"
                className="px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/30 hover:scale-105"
              >
                <span>Shop Collections</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="#flash-sales"
                className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-sm transition-all"
              >
                <span>View Flash Deals</span>
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-4/3 rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-slate-800">
              <img
                src="https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1000&auto=format&fit=crop&q=80"
                alt="Veloce Premium Performance Wear"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-8">
                <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex items-center justify-between w-full">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold block">
                      Featured Drop
                    </span>
                    <h4 className="text-sm font-bold text-white">Veloce Pro Hoodie Series</h4>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800/60">
                    Live Stock
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold font-mono uppercase">
              <TrendingUp className="w-4 h-4" />
              <span>Handpicked Highlights</span>
            </div>
            <h2 className="text-2xl font-black font-display text-slate-900 tracking-tight mt-1">
              Trending Releases
            </h2>
          </div>
          <Link
            href="/categories/apparel"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-mono"
          >
            <span>Browse All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {featured.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {flashSale.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Flash Sales Catalog */}
      <section id="flash-sales" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-violet-500/10 border border-slate-200/80 rounded-3xl p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black font-display text-slate-900">
                End-of-Month & Payday Flash Promotion
              </h3>
              <p className="text-xs text-slate-500 font-light">
                Atomic 15-minute checkout reservation enabled. Stock holds apply at checkout.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {flashSale.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
