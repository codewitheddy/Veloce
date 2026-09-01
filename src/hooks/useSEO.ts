/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';

export interface SEOConfig {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogType?: 'website' | 'article' | 'product' | 'profile';
  ogImage?: string;
  ogImageAlt?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  robots?: string;
  jsonLd?: Record<string, any> | Array<Record<string, any>> | null;
}

const DEFAULT_BASE_TITLE = 'Veloce | Premium eCommerce & Affiliate Marketplace';
const DEFAULT_DESCRIPTION =
  'Explore Veloce, the unified luxury eCommerce and affiliate marketplace featuring bespoke tailoring, curated physical products, high-utility digital assets, and verified merchant tracking.';
const DEFAULT_CANONICAL = 'https://veloce.co.ke/';
const DEFAULT_OG_IMAGE = 'https://veloce.co.ke/og-image.svg';

/**
 * Custom React hook to dynamically synchronize document title, meta tags, OpenGraph,
 * Twitter cards, canonical link, and JSON-LD structured data.
 */
export function useSEO(config: SEOConfig) {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    // 1. Update Title
    const finalTitle = config.title ? `${config.title} | Veloce` : DEFAULT_BASE_TITLE;
    document.title = finalTitle;

    // Helper to set or create a meta tag
    const setMetaTag = (attrName: 'name' | 'property', attrValue: string, content: string) => {
      let element = document.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attrName, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 2. Standard Meta Tags
    setMetaTag('name', 'title', finalTitle);
    setMetaTag('name', 'description', config.description || DEFAULT_DESCRIPTION);
    if (config.keywords) {
      setMetaTag('name', 'keywords', config.keywords);
    }
    setMetaTag('name', 'robots', config.robots || 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

    // 3. Canonical Tag
    const canonicalHref = config.canonicalUrl || (window.location.origin + window.location.pathname);
    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalHref);

    // 4. Open Graph Tags
    setMetaTag('property', 'og:title', finalTitle);
    setMetaTag('property', 'og:description', config.description || DEFAULT_DESCRIPTION);
    setMetaTag('property', 'og:type', config.ogType || 'website');
    setMetaTag('property', 'og:url', canonicalHref);
    setMetaTag('property', 'og:image', config.ogImage || DEFAULT_OG_IMAGE);
    if (config.ogImageAlt) {
      setMetaTag('property', 'og:image:alt', config.ogImageAlt);
    }

    // 5. Twitter Card Tags
    setMetaTag('name', 'twitter:card', config.twitterCard || 'summary_large_image');
    setMetaTag('name', 'twitter:title', finalTitle);
    setMetaTag('name', 'twitter:description', config.description || DEFAULT_DESCRIPTION);
    setMetaTag('name', 'twitter:image', config.ogImage || DEFAULT_OG_IMAGE);

    // 6. JSON-LD Dynamic Structured Data
    const scriptId = 'dynamic-seo-jsonld';
    let scriptElement = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (config.jsonLd) {
      if (!scriptElement) {
        scriptElement = document.createElement('script');
        scriptElement.id = scriptId;
        scriptElement.type = 'application/ld+json';
        document.head.appendChild(scriptElement);
      }
      scriptElement.textContent = JSON.stringify(config.jsonLd, null, 2);
    } else if (scriptElement) {
      scriptElement.remove();
    }
  }, [
    config.title,
    config.description,
    config.keywords,
    config.canonicalUrl,
    config.ogType,
    config.ogImage,
    config.ogImageAlt,
    config.twitterCard,
    config.robots,
    JSON.stringify(config.jsonLd)
  ]);
}
