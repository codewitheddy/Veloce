/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BookOpen, User, Calendar, ArrowLeft, Heart, Sparkles, Share2 } from 'lucide-react';
import { BlogPost } from '../types';

interface BlogPanelProps {
  blogs: BlogPost[];
}

export default function BlogPanel({ blogs }: BlogPanelProps) {
  const [selectedBlog, setSelectedBlog] = useState<BlogPost | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const blogId = params.get('blog') || params.get('postId') || sessionStorage.getItem('veloce_selected_blog_id');
      if (blogId && blogs && blogs.length > 0) {
        return (
          blogs.find(
            (b) =>
              String(b.id) === blogId ||
              b.title.toLowerCase().replace(/\s+/g, '-') === blogId.toLowerCase()
          ) || null
        );
      }
    }
    return null;
  });

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (selectedBlog) {
      sessionStorage.setItem('veloce_selected_blog_id', String(selectedBlog.id));
      url.searchParams.set('blog', String(selectedBlog.id));
      window.history.replaceState({}, '', url.toString());
    } else {
      sessionStorage.removeItem('veloce_selected_blog_id');
      if (url.searchParams.has('blog') || url.searchParams.has('postId')) {
        url.searchParams.delete('blog');
        url.searchParams.delete('postId');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [selectedBlog]);

  const [likesCount, setLikesCount] = useState<Record<string, number>>({});
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});

  const handleLike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const alreadyLiked = likedMap[id];
    setLikedMap((prev) => ({ ...prev, [id]: !alreadyLiked }));
    setLikesCount((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + (alreadyLiked ? -1 : 1)
    }));
  };

  if (selectedBlog) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <button
          onClick={() => setSelectedBlog(null)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors uppercase font-display mb-6 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Insights Directory
        </button>

        <article className="prose prose-gray dark:prose-invert max-w-none">
          {/* Cover Hero */}
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-gray-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 mb-8">
            <img
              src={selectedBlog.imageUrl}
              alt={selectedBlog.title}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-gray-400 dark:text-slate-500 uppercase mb-4">
            <span className="rounded bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800 font-bold">{selectedBlog.category}</span>
            <span>•</span>
            <span>{selectedBlog.date}</span>
            <span>•</span>
            <span>{selectedBlog.readTime}</span>
          </div>

          <h1 className="font-display text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl leading-snug">
            {selectedBlog.title}
          </h1>

          <div className="flex items-center justify-between border-y border-gray-100 dark:border-slate-800 py-4 my-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-indigo-50 dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <User className="h-4.5 w-4.5" />
              </div>
              <div>
                <span className="block text-xs font-semibold text-gray-800 dark:text-slate-200">{selectedBlog.author}</span>
                <span className="block text-[9px] text-gray-400 dark:text-slate-500 font-mono uppercase">Editorial Partner</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleLike(selectedBlog.id, e)}
                className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors cursor-pointer ${
                  likedMap[selectedBlog.id]
                    ? 'border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 font-semibold'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 hover:text-rose-600'
                }`}
              >
                <Heart className={`h-4.5 w-4.5 ${likedMap[selectedBlog.id] ? 'fill-rose-500 text-rose-500' : ''}`} />
                <span>{likesCount[selectedBlog.id] || 0}</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(window.location.href);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
                title="Copy Page URL"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body content */}
          <div className="text-gray-650 dark:text-slate-300 leading-relaxed font-light text-sm space-y-6 whitespace-pre-line">
            {selectedBlog.content}
          </div>

          {/* Footnotes value banner */}
          <div className="mt-12 rounded-xl bg-slate-50 dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4">
            <div className="h-10 w-10 bg-indigo-50 dark:bg-slate-800 rounded-xl flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-800 dark:text-white uppercase font-display">A Note on Transparency</p>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 font-extralight mt-0.5 leading-relaxed">
                Our publication only reviews workspace machinery with pristine ergonomics. When we include outbound tracking markers, we may collect split commissions directly from merchants. This funds our testing workshop and guarantees ad-free publication loops.
              </p>
            </div>
          </div>
        </article>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto px-4 py-8 sm:px-6 lg:px-8 font-sans">
      {/* Title */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
        <h1 className="font-display text-2xl font-semibold text-gray-900 dark:text-white">Veloce Insights</h1>
        <p className="text-xs text-gray-500 dark:text-slate-400 font-extralight mt-1">Deep essays on workspace ergonomics, acoustic isolation, and micro-platform strategies.</p>
      </div>

      {/* Grid List */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        {blogs.map((blog) => (
          <div
            key={blog.id}
            onClick={() => setSelectedBlog(blog)}
            className="group flex flex-col justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden p-4 cursor-pointer transition-all hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md dark:hover:shadow-black/50"
          >
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-50 dark:bg-slate-950">
              <img
                src={blog.imageUrl}
                alt={blog.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-101"
                referrerPolicy="no-referrer"
              />
              <span className="absolute top-2.5 left-2.5 rounded bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs px-2 py-0.5 font-mono text-[9px] font-bold text-gray-800 dark:text-slate-200 uppercase border border-slate-200/60 dark:border-slate-700">
                {blog.category}
              </span>
            </div>

            <div className="mt-4 flex-1">
              <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400 dark:text-slate-500 uppercase">
                <span>{blog.date}</span>
                <span>•</span>
                <span>{blog.readTime}</span>
              </div>
              <h3 className="font-display font-medium text-base text-gray-900 dark:text-white mt-1.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {blog.title}
              </h3>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-slate-400 font-extralight leading-relaxed line-clamp-2">
                {blog.excerpt}
              </p>
            </div>

            <div className="mt-6 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-gray-700 dark:text-slate-300">{blog.author}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                Read Article <BookOpen className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
