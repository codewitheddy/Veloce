/**
 * WCAG AA Contrast Audit Utility
 * Automatically scans buttons, navigation items, cards, and text elements,
 * calculates RGB relative luminance contrast ratios, and logs violations to the console.
 */

function parseRGB(colorString: string): { r: number; g: number; b: number; a: number } | null {
  if (!colorString || colorString === 'transparent') return null;

  const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return null;

  return {
    r: parseInt(match[1], 10),
    g: parseInt(match[2], 10),
    b: parseInt(match[3], 10),
    a: match[4] !== undefined ? parseFloat(match[4]) : 1,
  };
}

function getChannelLuminance(channel: number): number {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function getRelativeLuminance(r: number, g: number, b: number): number {
  const R = getChannelLuminance(r);
  const G = getChannelLuminance(g);
  const B = getChannelLuminance(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function calculateContrastRatio(lum1: number, lum2: number): number {
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getEffectiveBackgroundColor(element: HTMLElement): { r: number; g: number; b: number } {
  let current: HTMLElement | null = element;
  let bgRgba = { r: 255, g: 255, b: 255, a: 1 }; // Default fallback white

  while (current && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const parsed = parseRGB(style.backgroundColor);

    if (parsed && parsed.a > 0) {
      if (parsed.a === 1) {
        return { r: parsed.r, g: parsed.g, b: parsed.b };
      }
      // Blend alpha over underlying color
      bgRgba = {
        r: Math.round(parsed.r * parsed.a + bgRgba.r * (1 - parsed.a)),
        g: Math.round(parsed.g * parsed.a + bgRgba.g * (1 - parsed.a)),
        b: Math.round(parsed.b * parsed.a + bgRgba.b * (1 - parsed.a)),
        a: 1,
      };
    }
    current = current.parentElement;
  }

  return { r: bgRgba.r, g: bgRgba.g, b: bgRgba.b };
}

export interface ContrastViolation {
  element: HTMLElement;
  tagName: string;
  className: string;
  textSnippet: string;
  textColor: string;
  bgColor: string;
  ratio: number;
  requiredRatio: number;
  isLargeText: boolean;
}

export function runContrastAudit(): ContrastViolation[] {
  const selectors = [
    'button',
    'a',
    'nav *',
    '[role="button"]',
    'input',
    'select',
    'textarea',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'span',
    'label',
    '.card',
    '[class*="card"]',
    '[class*="product"]',
  ];

  const candidateElements = Array.from(
    document.querySelectorAll<HTMLElement>(selectors.join(','))
  );

  const violations: ContrastViolation[] = [];
  const processedSet = new Set<HTMLElement>();

  for (const el of candidateElements) {
    if (processedSet.has(el)) continue;
    processedSet.add(el);

    // Skip hidden or non-visible elements
    if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;
    const textContent = (el.innerText || el.textContent || '').trim();
    if (!textContent && !el.getAttribute('aria-label') && !el.getAttribute('title')) continue;

    const style = window.getComputedStyle(el);
    const textColorParsed = parseRGB(style.color);
    if (!textColorParsed) continue;

    const bgColorParsed = getEffectiveBackgroundColor(el);

    const textLum = getRelativeLuminance(textColorParsed.r, textColorParsed.g, textColorParsed.b);
    const bgLum = getRelativeLuminance(bgColorParsed.r, bgColorParsed.g, bgColorParsed.b);

    const ratio = calculateContrastRatio(textLum, bgLum);

    // Determine font size & weight for WCAG AA thresholds
    const fontSizePx = parseFloat(style.fontSize) || 16;
    const fontWeight = parseInt(style.fontWeight, 10) || 400;
    const isLargeText = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);

    const requiredRatio = isLargeText ? 3.0 : 4.5;

    if (ratio < requiredRatio) {
      violations.push({
        element: el,
        tagName: el.tagName.toLowerCase(),
        className: el.className ? String(el.className).substring(0, 50) : '',
        textSnippet: textContent.substring(0, 40) || el.getAttribute('aria-label') || 'Icon / Graphic',
        textColor: style.color,
        bgColor: `rgb(${bgColorParsed.r}, ${bgColorParsed.g}, ${bgColorParsed.b})`,
        ratio: Math.round(ratio * 100) / 100,
        requiredRatio,
        isLargeText,
      });
    }
  }

  // Print audit report to console
  if (violations.length > 0) {
    console.group('%c ⚠️ WCAG AA Contrast Audit Violations Detected', 'color: #ef4444; font-weight: bold; font-size: 14px;');
    console.warn(`Found ${violations.length} element(s) failing WCAG AA contrast guidelines (< 4.5:1 normal, < 3.0:1 large).`);
    console.table(
      violations.map((v) => ({
        Tag: v.tagName,
        Class: v.className,
        Text: v.textSnippet,
        'Contrast Ratio': `${v.ratio}:1`,
        'Required Ratio': `${v.requiredRatio}:1`,
        'Text Color': v.textColor,
        'BG Color': v.bgColor,
      }))
    );
    console.groupEnd();
  } else {
    console.log('%c ✅ WCAG AA Contrast Audit Passed! All key elements meet AA contrast standards.', 'color: #10b981; font-weight: bold; font-size: 13px;');
  }

  return violations;
}

// Attach to window object for manual invocation in browser developer tools
if (typeof window !== 'undefined') {
  (window as unknown as { runContrastAudit: typeof runContrastAudit }).runContrastAudit = runContrastAudit;

  // Auto-run once on idle/load
  if (document.readyState === 'complete') {
    setTimeout(runContrastAudit, 2000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(runContrastAudit, 2000);
    });
  }
}
