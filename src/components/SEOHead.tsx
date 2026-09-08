/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { useSEO, SEOConfig } from '../hooks/useSEO';
import { Product, BlogPost } from '../types';
import { useSiteSettings } from '../context/SiteSettingsContext';

interface SEOHeadProps {
  currentTab: string;
  selectedProduct?: Product | null;
  selectedCategory?: string;
  selectedSubcategory?: string;
  searchQuery?: string;
  products?: Product[];
  blogs?: BlogPost[];
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  currentTab,
  selectedProduct,
  selectedCategory,
  selectedSubcategory,
  searchQuery,
  products = [],
  blogs = [],
}) => {
  const { settings } = useSiteSettings();
  const BASE_URL = settings.seo.canonical_base_url || 'https://ropenix.co.ke';
  const siteName = settings.general.site_name || 'Ropenix Collections';

  const seoConfig = useMemo<SEOConfig>(() => {
    // 1. If viewing an individual product detail
    if (selectedProduct) {
      const productName = selectedProduct.name || (selectedProduct as any).title || 'Product Detail';
      const productImage = selectedProduct.imageUrl || (selectedProduct as any).image || settings.seo.og_image_url || 'https://ropenix.co.ke/og-image.svg';
      const gallery = selectedProduct.images || selectedProduct.gallery_images || [];

      const cleanDesc = (selectedProduct.description || selectedProduct.shortDescription || '')
        .replace(/<[^>]*>?/gm, '')
        .slice(0, 160)
        .trim();

      const productSchema: Record<string, any> = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: productName,
        image: [productImage, ...gallery].filter(Boolean),
        description: cleanDesc || `Buy ${productName} at ${siteName}. Premium craftsmanship and guaranteed quality.`,
        sku: selectedProduct.sku || `ROP-${selectedProduct.id}`,
        brand: {
          '@type': 'Brand',
          name: selectedProduct.brand || siteName,
        },
        offers: {
          '@type': 'Offer',
          url: `${BASE_URL}/store?product=${selectedProduct.id}`,
          priceCurrency: selectedProduct.currency || 'KES',
          price: selectedProduct.price,
          priceValidUntil: '2027-12-31',
          itemCondition: 'https://schema.org/NewCondition',
          availability:
            (selectedProduct.stock === null || selectedProduct.stock > 0)
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Organization',
            name: siteName,
          },
        },
      };

      if (selectedProduct.rating && selectedProduct.rating > 0) {
        productSchema.aggregateRating = {
          '@type': 'AggregateRating',
          ratingValue: selectedProduct.rating,
          reviewCount: selectedProduct.reviewsCount || 1,
          bestRating: 5,
          worstRating: 1,
        };
      }

      const breadcrumbsSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: BASE_URL,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Store',
            item: `${BASE_URL}/store`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: productName,
            item: `${BASE_URL}/store?product=${selectedProduct.id}`,
          },
        ],
      };

      return {
        title: `${productName} | ${siteName}`,
        description: cleanDesc || `Buy ${productName} on ${siteName}. Guaranteed delivery with secure payment processing.`,
        keywords: `${productName}, buy ${productName}, ${selectedProduct.category}, online store Kenya, ${siteName}`,
        canonicalUrl: `${BASE_URL}/store?product=${selectedProduct.id}`,
        ogType: 'product',
        ogImage: productImage,
        jsonLd: [productSchema, breadcrumbsSchema],
      };
    }

    // 2. Tab-specific SEO metadata
    switch (currentTab) {
      case 'store': {
        const pageTitle = selectedCategory
          ? `${selectedCategory} Collection | ${siteName}`
          : `Catalog & Products | ${siteName}`;

        const pageDesc = selectedCategory
          ? `Discover our exclusive ${selectedCategory} collection. Handcrafted physical goods, digital assets, and custom apparel with verified delivery.`
          : 'Browse our complete catalog of physical workspace accessories, bespoke clothing, digital downloads, and professional services.';

        const itemListSchema = {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: pageTitle,
          description: pageDesc,
          url: `${BASE_URL}/store`,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: products.length,
            itemListElement: products.slice(0, 12).map((p, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: p.name || (p as any).title,
              url: `${BASE_URL}/store?product=${p.id}`,
              image: p.imageUrl || (p as any).image,
            })),
          },
        };

        const breadcrumbsSchema = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: BASE_URL,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Store',
              item: `${BASE_URL}/store`,
            },
          ],
        };

        return {
          title: pageTitle,
          description: pageDesc,
          keywords: `eCommerce store, online shopping, buy hardware, digital assets, custom apparel, ${siteName} catalog, ${selectedCategory || ''}`,
          canonicalUrl: `${BASE_URL}/store`,
          ogType: 'website',
          jsonLd: [itemListSchema, breadcrumbsSchema],
        };
      }

      case 'services': {
        const servicesSchema = {
          '@context': 'https://schema.org',
          '@type': 'Service',
          serviceType: 'Bespoke Custom Tailoring & Fashion Design',
          provider: {
            '@type': 'Organization',
            name: siteName,
            url: BASE_URL,
          },
          areaServed: ['Kenya', 'East Africa', 'Worldwide'],
          description:
            'Bespoke tailoring, custom garment creation, precision measurement fitting, and direct video consultations with master fashion artisans.',
          offers: {
            '@type': 'Offer',
            priceCurrency: 'KES',
            availability: 'https://schema.org/InStock',
          },
        };

        const breadcrumbsSchema = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
            { '@type': 'ListItem', position: 2, name: 'Services', item: `${BASE_URL}/services` },
          ],
        };

        return {
          title: `Bespoke Tailoring & Custom Garment Consultations | ${siteName}`,
          description:
            'Order custom tailored clothing, upload design files, submit body measurements, and consult with master artisans.',
          keywords: `custom tailoring, bespoke suits, evening gowns, made to measure clothing, fashion consultation Kenya, ${siteName} services`,
          canonicalUrl: `${BASE_URL}/services`,
          ogType: 'website',
          jsonLd: [servicesSchema, breadcrumbsSchema],
        };
      }

      case 'blog': {
        return {
          title: `Insights & Industry Articles | ${siteName}`,
          description:
            'Read the latest guides on artisan craftsmanship, modern workspace engineering, and style trends.',
          keywords: `eCommerce blog, tailoring guides, ergonomics tips, ${siteName} insights`,
          canonicalUrl: `${BASE_URL}/blog`,
          ogType: 'article',
        };
      }

      case 'contact': {
        const contactPageSchema = {
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: `Contact Support | ${siteName}`,
          url: `${BASE_URL}/contact`,
        };

        const faqSchema = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'How do I track my order?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'You can track your order using the Live Courier Tracker in the footer navigation or by entering your order ID.',
              },
            },
            {
              '@type': 'Question',
              name: 'What payment methods are supported?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'We support M-PESA Express STK push, M-PESA Paybill, Visa/Mastercard credit/debit cards, and Cash on Delivery.',
              },
            },
          ],
        };

        const breadcrumbsSchema = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
            { '@type': 'ListItem', position: 2, name: 'Contact & FAQ', item: `${BASE_URL}/contact` },
          ],
        };

        return {
          title: `Contact Support, Inquiries & FAQs | ${siteName}`,
          description:
            `Have questions about your order, shipping, or returns? Contact ${siteName} customer support or browse our comprehensive FAQs.`,
          keywords: `contact ${siteName.toLowerCase()}, customer support, ecommerce help desk, order tracking help, shipping FAQ Kenya`,
          canonicalUrl: `${BASE_URL}/contact`,
          ogType: 'website',
          jsonLd: [contactPageSchema, faqSchema, breadcrumbsSchema],
        };
      }

      case 'privacy': {
        return {
          title: `Privacy Policy & Terms of Service | ${siteName}`,
          description:
            'Read our comprehensive privacy policy detailing our SSL encryption standards, cookie policies, and data protection guarantees.',
          keywords: 'privacy policy, terms of service, data protection, secure shopping, policy',
          canonicalUrl: `${BASE_URL}/privacy`,
          ogType: 'website',
        };
      }

      case 'checkout':
      case 'admin':
      case 'user':
      case 'unsubscribe':
        return {
          title: currentTab === 'admin' ? 'Django Admin Suite' : `Account & Gateway | ${siteName}`,
          robots: 'noindex, nofollow',
          canonicalUrl: `${BASE_URL}/${currentTab}`,
        };

      case 'home':
      default: {
        const homeSchema = {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteName,
          url: BASE_URL,
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `${BASE_URL}/?tab=store&search={search_term_string}`,
            },
            'query-input': 'required name=search_term_string',
          },
        };

        return {
          title: settings.seo.meta_title || `${siteName} | Luxury eCommerce & Affiliate Marketplace`,
          description:
            settings.seo.meta_description ||
            `Explore ${siteName}, the unified luxury eCommerce and affiliate marketplace featuring bespoke tailoring, curated physical products, and verified merchant tracking.`,
          keywords: settings.seo.meta_keywords || `eCommerce marketplace, bespoke tailoring, workspace accessories, digital downloads, affiliate platform, online store Kenya, ${siteName}`,
          canonicalUrl: `${BASE_URL}/`,
          ogType: 'website',
          ogImage: settings.seo.og_image_url || undefined,
          jsonLd: homeSchema,
        };
      }
    }
  }, [currentTab, selectedProduct, selectedCategory, selectedSubcategory, searchQuery, products, blogs, settings, BASE_URL, siteName]);

  // Hook handles DOM injection and sync
  useSEO(seoConfig);

  return null;
};

export default SEOHead;
