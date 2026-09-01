/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { useSEO, SEOConfig } from '../hooks/useSEO';
import { Product, BlogPost } from '../types';

interface SEOHeadProps {
  currentTab: string;
  selectedProduct?: Product | null;
  selectedCategory?: string;
  selectedSubcategory?: string;
  searchQuery?: string;
  products?: Product[];
  blogs?: BlogPost[];
}

const BASE_URL = 'https://veloce.co.ke';

export const SEOHead: React.FC<SEOHeadProps> = ({
  currentTab,
  selectedProduct,
  selectedCategory,
  selectedSubcategory,
  searchQuery,
  products = [],
  blogs = [],
}) => {
  const seoConfig = useMemo<SEOConfig>(() => {
    // 1. If viewing an individual product detail
    if (selectedProduct) {
      const productName = selectedProduct.name || (selectedProduct as any).title || 'Product Detail';
      const productImage = selectedProduct.imageUrl || (selectedProduct as any).image || 'https://veloce.co.ke/og-image.svg';
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
        description: cleanDesc || `Buy ${productName} at Veloce. Premium craftsmanship and guaranteed quality.`,
        sku: selectedProduct.sku || `VEL-${selectedProduct.id}`,
        brand: {
          '@type': 'Brand',
          name: selectedProduct.brand || 'Veloce',
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
            name: 'Veloce Marketplace',
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
            name: selectedProduct.category || 'Products',
            item: `${BASE_URL}/store?category=${encodeURIComponent(selectedProduct.category || '')}`,
          },
          {
            '@type': 'ListItem',
            position: 4,
            name: productName,
            item: `${BASE_URL}/store?product=${selectedProduct.id}`,
          },
        ],
      };

      return {
        title: `${productName} | Buy Online`,
        description: cleanDesc || `Order ${productName} online with safe checkout and swift delivery across Kenya.`,
        keywords: `${productName}, ${selectedProduct.category || ''}, buy ${productName} online, Veloce store, Kenya eCommerce`,
        canonicalUrl: `${BASE_URL}/store?product=${selectedProduct.id}`,
        ogType: 'product',
        ogImage: productImage,
        ogImageAlt: productName,
        jsonLd: [productSchema, breadcrumbsSchema],
      };
    }

    // 2. Tab-specific routing SEO
    switch (currentTab) {
      case 'store': {
        const catTitle = selectedCategory ? `${selectedCategory} Collection` : 'Proprietary Store & Marketplace';
        const pageTitle = searchQuery ? `Search Results for "${searchQuery}"` : catTitle;
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
          keywords: `eCommerce store, online shopping, buy hardware, digital assets, custom apparel, Veloce catalog, ${selectedCategory || ''}`,
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
            name: 'Veloce',
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
          title: 'Bespoke Tailoring & Custom Garment Consultations',
          description:
            'Order custom tailored clothing, upload design files, submit body measurements, and consult with master artisans on Veloce.',
          keywords: 'custom tailoring, bespoke suits, evening gowns, made to measure clothing, fashion consultation Kenya, Veloce services',
          canonicalUrl: `${BASE_URL}/services`,
          ogType: 'website',
          jsonLd: [servicesSchema, breadcrumbsSchema],
        };
      }

      case 'blog': {
        const blogListingSchema = {
          '@context': 'https://schema.org',
          '@type': 'Blog',
          name: 'Veloce Insights & Blueprints',
          description:
            'Curated perspectives on modern workspace machinery, affiliate growth strategies, luxury craftsmanship, and digital lifestyle.',
          url: `${BASE_URL}/blog`,
          blogPost: blogs.slice(0, 10).map((b) => ({
            '@type': 'BlogPosting',
            headline: b.title,
            datePublished: b.date,
            author: { '@type': 'Person', name: b.author },
            image: b.imageUrl,
          })),
        };

        const breadcrumbsSchema = {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
            { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
          ],
        };

        return {
          title: 'Veloce Insights | Workspace Blueprints & Market Guides',
          description:
            'Explore expert guides on workspace setup, tailoring aesthetics, eCommerce architecture, and affiliate marketing insights.',
          keywords: 'eCommerce blog, workspace blueprints, affiliate marketing guides, bespoke fashion tips, Veloce insights',
          canonicalUrl: `${BASE_URL}/blog`,
          ogType: 'website',
          jsonLd: [blogListingSchema, breadcrumbsSchema],
        };
      }

      case 'contact': {
        const contactPageSchema = {
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: 'Contact Veloce Support & Help Center',
          description: 'Get in touch with customer support, submit custom service inquiries, or read shipping & returns FAQs.',
          url: `${BASE_URL}/contact`,
        };

        const faqSchema = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: 'How long does shipping take within Kenya & internationally?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Nairobi metro and regional Kenya deliveries arrive within 24 to 48 hours via local courier dispatch. International shipments are dispatched through DHL Express and arrive within 3 to 7 business days.',
              },
            },
            {
              '@type': 'Question',
              name: 'How can I track my physical order status?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Once your order is processed, a unique courier tracking code is generated and saved directly in your User Account orders statement, alongside live SMS and email updates.',
              },
            },
            {
              '@type': 'Question',
              name: 'Are delivery fees refundable if an item is returned?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Standard courier delivery fees are fully covered by Veloce if the return is due to transit damage or manufacturing defect.',
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
          title: 'Contact Support, Inquiries & FAQs',
          description:
            'Have questions about your order, shipping, or returns? Contact Veloce customer support or browse our comprehensive FAQs.',
          keywords: 'contact veloce, customer support, ecommerce help desk, order tracking help, shipping FAQ Kenya',
          canonicalUrl: `${BASE_URL}/contact`,
          ogType: 'website',
          jsonLd: [contactPageSchema, faqSchema, breadcrumbsSchema],
        };
      }

      case 'privacy': {
        return {
          title: 'Privacy Policy & Terms of Service',
          description:
            'Read our comprehensive privacy policy detailing our SSL encryption standards, cookie policies, and data protection guarantees.',
          keywords: 'privacy policy, terms of service, data protection, secure shopping, Veloce policy',
          canonicalUrl: `${BASE_URL}/privacy`,
          ogType: 'website',
        };
      }

      case 'checkout':
      case 'admin':
      case 'user':
      case 'unsubscribe':
        return {
          title: currentTab === 'admin' ? 'Django Admin Suite' : 'Account & Secure Gateway',
          robots: 'noindex, nofollow',
          canonicalUrl: `${BASE_URL}/${currentTab}`,
        };

      case 'home':
      default: {
        const homeSchema = {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Veloce Marketplace',
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
          title: 'Premium eCommerce & Affiliate Marketplace',
          description:
            'Explore Veloce, the unified luxury eCommerce and affiliate marketplace featuring bespoke tailoring, curated physical products, high-utility digital assets, and verified merchant tracking.',
          keywords: 'eCommerce marketplace, bespoke tailoring, workspace accessories, digital downloads, affiliate platform, online store Kenya, Veloce',
          canonicalUrl: `${BASE_URL}/`,
          ogType: 'website',
          jsonLd: homeSchema,
        };
      }
    }
  }, [currentTab, selectedProduct, selectedCategory, selectedSubcategory, searchQuery, products, blogs]);

  // Hook handles DOM injection and sync
  useSEO(seoConfig);

  return null;
};

export default SEOHead;
