/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Strips markdown and HTML artifacts to produce a clean plain-text teaser for cards/excerpts.
 */
export function cleanDescriptionExcerpt(text: string | undefined | null, maxLength?: number): string {
  if (!text) return '';
  let cleaned = text
    .replace(/<[^>]*>/g, ' ') // remove HTML tags
    .replace(/\*\*([^*]+)\*\*/g, '$1') // remove bold
    .replace(/\*([^*]+)\*/g, '$1') // remove italic
    .replace(/^(\*|\-|•|\d+\.)\s+/gm, '') // remove list bullets
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove links
    .replace(/#+\s+/g, '') // remove headers
    .replace(/\s+/g, ' ') // collapse whitespaces
    .trim();
  if (maxLength && cleaned.length > maxLength) {
    return cleaned.slice(0, maxLength).trim() + '...';
  }
  return cleaned;
}

/**
 * Formats rich product description text or markdown into structured HTML.
 * Handles both multiline and inline markdown constructs (e.g. **Heading**, * **Bullet:** text).
 */
export function formatRichDescription(rawText: string | undefined | null): string {
  if (!rawText || !rawText.trim()) {
    return '';
  }

  let text = rawText.trim();

  // If already rich HTML with multiple block tags (<div, <ul, <table, <section), return directly
  if (/<(table|section|article)\b/i.test(text) || (/<div\b/i.test(text) && /<img\b/i.test(text))) {
    return text;
  }

  // Normalize inline bullets: "* **" or "- **" that lack preceding newline
  text = text.replace(/([^\n])\s*(\*|\-)\s+\*\*/g, '$1\n* **');
  text = text.replace(/([^\n])\s*(\*|\-)\s+([A-Z])/g, '$1\n* $3');

  // Normalize inline headings like ". **Why You'll Love Them**" or ". **Key Features**"
  text = text.replace(/([.!?])\s*\*\*([^*]{3,40})\*\*/g, '$1\n\n**$2**\n');

  // Normalize inline call to action at the end: ". **Add a pair..."
  text = text.replace(/([.!?])\s*\*\*([^*]{15,})\*\*/g, '$1\n\n**$2**');

  // Split into lines/blocks
  const lines = text.split(/\r?\n/);
  const resultBlocks: string[] = [];
  let currentListItems: string[] = [];

  const flushList = () => {
    if (currentListItems.length > 0) {
      resultBlocks.push(
        `<ul class="my-3.5 space-y-2 text-slate-700">` +
          currentListItems
            .map(
              (li) =>
                `<li class="flex items-start gap-2.5 text-xs sm:text-[13px] leading-relaxed"><span class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] mt-0.5">•</span><span>${li}</span></li>`
            )
            .join('') +
          `</ul>`
      );
      currentListItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flushList();
      continue;
    }

    // Check for bullet list item: "* ...", "- ...", "• ...", "1. ..."
    const bulletMatch = line.match(/^(\*|\-|•|\d+\.)\s+(.+)$/);
    if (bulletMatch) {
      let content = bulletMatch[2];
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
      content = content.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
      currentListItems.push(content);
      continue;
    }

    flushList();

    // Check for Markdown Headings: "### Heading", "## Heading", "# Heading"
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].replace(/\*\*(.*?)\*\*/g, '$1');
      if (level === 1) {
        resultBlocks.push(`<h3 class="text-base font-bold text-slate-900 mt-4 mb-2 tracking-tight">${headingText}</h3>`);
      } else if (level === 2) {
        resultBlocks.push(`<h4 class="text-sm font-bold text-slate-900 mt-3.5 mb-1.5 flex items-center gap-1.5 tracking-tight"><span class="h-2 w-2 rounded-full bg-indigo-500 inline-block"></span>${headingText}</h4>`);
      } else {
        resultBlocks.push(`<h5 class="text-xs font-bold text-slate-800 mt-3 mb-1 uppercase tracking-wider font-mono">${headingText}</h5>`);
      }
      continue;
    }

    // Check for Standalone Bold Line as Heading: e.g. "**Why You'll Love Them**"
    const standaloneBoldMatch = line.match(/^\*\*([^*]+)\*\*$/);
    if (standaloneBoldMatch) {
      resultBlocks.push(
        `<h4 class="text-xs sm:text-sm font-bold text-indigo-950 mt-4 mb-2 flex items-center gap-1.5 tracking-tight"><span class="h-1.5 w-1.5 rounded-full bg-indigo-600 inline-block"></span>${standaloneBoldMatch[1]}</h4>`
      );
      continue;
    }

    // Format inline markdown in standard paragraph
    let formattedLine = line;
    formattedLine = formattedLine.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');
    formattedLine = formattedLine.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    formattedLine = formattedLine.replace(/~~(.*?)~~/g, '<del class="line-through text-slate-400">$1</del>');
    formattedLine = formattedLine.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 font-semibold underline hover:opacity-80">$1</a>');

    if (line.startsWith('**') && line.endsWith('**')) {
      resultBlocks.push(
        `<div class="my-3.5 p-4 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/50 via-white to-indigo-50/30 text-indigo-950 text-xs sm:text-sm font-medium leading-relaxed">${formattedLine}</div>`
      );
    } else {
      resultBlocks.push(
        `<p class="text-xs sm:text-[13px] text-slate-600 font-normal leading-relaxed my-2">${formattedLine}</p>`
      );
    }
  }

  flushList();

  return resultBlocks.join('\n');
}
