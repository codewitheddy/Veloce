/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import DOMPurify from 'dompurify';

export function cleanDescriptionExcerpt(text: string | undefined | null, maxLength?: number): string {
  if (!text) return '';
  let cleaned = text
    // Remove script and style tags with content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    // Remove complete HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Remove unclosed or truncated HTML tags (e.g. <div class="... without closing >)
    .replace(/<[a-z0-9_\-\s"=':;\.\/]+>?/gi, ' ')
    .replace(/<[^>]*$/g, ' ')
    // Remove markdown symbols
    .replace(/\*\*([^*]+)\*\*/g, '$1') // remove bold
    .replace(/\*([^*]+)\*/g, '$1') // remove italic
    .replace(/~~([^~]+)~~/g, '$1') // remove strikethrough
    .replace(/^(\*|\-|•|\d+\.)\s+/gm, '') // remove list bullets
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove links
    .replace(/#+\s+/g, '') // remove headers
    // Decode common entities
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ') // collapse whitespaces
    .trim();
  if (maxLength && cleaned.length > maxLength) {
    return cleaned.slice(0, maxLength).trim() + '...';
  }
  return cleaned;
}

/**
 * Converts standard or joined markdown tables (| col 1 | col 2 |) into responsive HTML tables.
 */
export function convertMarkdownTablesToHtml(rawText: string): string {
  if (!rawText || !rawText.includes('|')) return rawText;

  // Step 1: Normalize any joined table rows like "Specifications || :---" or "Specifications | | :---" into separate lines
  let text = rawText.replace(/\|\s*\|\s*/g, '|\n|');

  const lines = text.split(/\r?\n/);
  const result: string[] = [];
  let i = 0;

  const isRowLine = (l: string) => {
    const trimmed = l.trim();
    return (
      trimmed.includes('|') &&
      !trimmed.startsWith('```') &&
      !trimmed.startsWith('<div') &&
      !trimmed.startsWith('</div') &&
      !trimmed.startsWith('<table') &&
      !trimmed.startsWith('</table')
    );
  };

  const isSeparatorLine = (l: string) => {
    const trimmed = l.trim();
    return /^\|?[\s:\-\|]+\|?$/.test(trimmed) && trimmed.includes('-');
  };

  while (i < lines.length) {
    const currentLine = lines[i].trim();

    // Check if current line is followed by a separator line
    if (
      isRowLine(currentLine) &&
      i + 1 < lines.length &&
      isSeparatorLine(lines[i + 1])
    ) {
      // Clean header cells
      let rawHeader = currentLine;
      if (rawHeader.startsWith('|')) rawHeader = rawHeader.slice(1);
      if (rawHeader.endsWith('|')) rawHeader = rawHeader.slice(0, -1);
      const headers = rawHeader.split('|').map((h) => h.trim());

      // Parse alignment from separator line
      let rawSep = lines[i + 1].trim();
      if (rawSep.startsWith('|')) rawSep = rawSep.slice(1);
      if (rawSep.endsWith('|')) rawSep = rawSep.slice(0, -1);
      const alignments = rawSep.split('|').map((col) => {
        const c = col.trim();
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return 'left';
      });

      // Gather body rows
      const dataRows: string[][] = [];
      i += 2;
      while (i < lines.length && isRowLine(lines[i]) && !isSeparatorLine(lines[i])) {
        let rawRow = lines[i].trim();
        if (!rawRow) break;
        if (rawRow.startsWith('|')) rawRow = rawRow.slice(1);
        if (rawRow.endsWith('|')) rawRow = rawRow.slice(0, -1);
        const cells = rawRow.split('|').map((c) => c.trim());
        dataRows.push(cells);
        i++;
      }

      // Generate HTML Table
      let tableHtml = `\n<div class="my-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xs">\n`;
      tableHtml += `  <table class="w-full text-left text-xs sm:text-sm border-collapse min-w-[500px]">\n`;
      tableHtml += `    <thead class="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">\n`;
      tableHtml += `      <tr>\n`;
      headers.forEach((h, colIdx) => {
        const align = alignments[colIdx] || 'left';
        const formattedHeader = h
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');
        tableHtml += `        <th class="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider text-[11px] text-${align}">${formattedHeader}</th>\n`;
      });
      tableHtml += `      </tr>\n`;
      tableHtml += `    </thead>\n`;
      tableHtml += `    <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">\n`;
      dataRows.forEach((row, rowIdx) => {
        const zebraClass = rowIdx % 2 === 1 ? 'bg-slate-50/40 dark:bg-slate-800/30' : 'bg-white dark:bg-slate-900';
        tableHtml += `      <tr class="${zebraClass} hover:bg-indigo-50/30 dark:hover:bg-slate-800/60 transition-colors">\n`;
        for (let colIdx = 0; colIdx < headers.length; colIdx++) {
          const cellContent = row[colIdx] || '';
          const align = alignments[colIdx] || 'left';
          const formattedCell = cellContent
            .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
            .replace(/~~(.*?)~~/g, '<del class="line-through text-slate-400">$1</del>');
          tableHtml += `        <td class="py-3 px-4 text-${align}">${formattedCell}</td>\n`;
        }
        tableHtml += `      </tr>\n`;
      });
      tableHtml += `    </tbody>\n`;
      tableHtml += `  </table>\n`;
      tableHtml += `</div>\n`;

      result.push(tableHtml);
      continue;
    }

    result.push(lines[i]);
    i++;
  }

  return result.join('\n');
}

/**
 * Formats rich product description text or markdown into structured, sanitized HTML.
 * Handles both multiline and inline markdown constructs (e.g. **Heading**, * **Bullet:** text, tables).
 */
export function formatRichDescription(rawText: string | undefined | null): string {
  if (!rawText || !rawText.trim()) {
    return '';
  }

  let text = rawText.trim();

  // Convert markdown tables first into clean HTML tables
  text = convertMarkdownTablesToHtml(text);

  // If already rich HTML with block tags (<div, <ul, <table, <section, <p), sanitize directly
  if (/<(div|table|section|article|figure|ul|ol|header|footer|video|iframe)\b/i.test(text) || (/<p\b/i.test(text) && /<\/[a-z]+>/i.test(text))) {
    return DOMPurify.sanitize(text, {
      ADD_TAGS: ['iframe', 'video', 'source', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption'],
      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'class', 'style', 'colspan', 'rowspan', 'scope']
    });
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
        `<ul class="my-3.5 space-y-2 text-slate-700 dark:text-slate-300">` +
          currentListItems
            .map(
              (li) =>
                `<li class="flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed"><span class="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-100/70 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] mt-0.5 shadow-5xs">•</span><span>${li}</span></li>`
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
      // Format bold inside bullet
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>');
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
        resultBlocks.push(`<h3 class="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2 font-display tracking-tight">${headingText}</h3>`);
      } else if (level === 2) {
        resultBlocks.push(`<h4 class="text-sm font-bold text-slate-900 dark:text-white mt-3.5 mb-1.5 flex items-center gap-1.5 font-display tracking-tight"><span class="h-2 w-2 rounded-full bg-indigo-500 inline-block"></span>${headingText}</h4>`);
      } else {
        resultBlocks.push(`<h5 class="text-xs font-bold text-slate-800 dark:text-slate-200 mt-3 mb-1 uppercase tracking-wider font-mono">${headingText}</h5>`);
      }
      continue;
    }

    // Check for Standalone Bold Line as Heading: e.g. "**Why You'll Love Them**"
    const standaloneBoldMatch = line.match(/^\*\*([^*]+)\*\*$/);
    if (standaloneBoldMatch) {
      resultBlocks.push(
        `<h4 class="text-xs sm:text-sm font-bold text-indigo-950 dark:text-indigo-200 mt-4 mb-2 flex items-center gap-1.5 font-display tracking-tight"><span class="h-1.5 w-1.5 rounded-full bg-indigo-600 inline-block"></span>${standaloneBoldMatch[1]}</h4>`
      );
      continue;
    }

    // Format inline markdown in standard paragraph
    let formattedLine = line;
    formattedLine = formattedLine.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>');
    formattedLine = formattedLine.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    formattedLine = formattedLine.replace(/~~(.*?)~~/g, '<del class="line-through text-slate-400">$1</del>');
    formattedLine = formattedLine.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 font-semibold underline hover:opacity-80">$1</a>');

    // Check for CTA / Highlight line: e.g. starts with bold and ends with bold callout
    if (line.startsWith('**') && line.endsWith('**')) {
      resultBlocks.push(
        `<div class="my-3.5 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/50 via-white to-indigo-50/30 dark:from-indigo-950/40 dark:via-gray-900 dark:to-indigo-950/30 text-indigo-950 dark:text-indigo-200 text-xs sm:text-sm font-medium leading-relaxed shadow-3xs">${formattedLine}</div>`
      );
    } else {
      resultBlocks.push(
        `<p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-normal leading-relaxed my-2">${formattedLine}</p>`
      );
    }
  }

  flushList();

  const fullHtml = resultBlocks.join('\n');
  return DOMPurify.sanitize(fullHtml, {
    ADD_TAGS: ['iframe', 'video', 'source', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'target', 'class', 'style', 'colspan', 'rowspan', 'scope']
  });
}
