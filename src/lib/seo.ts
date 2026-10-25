import { useEffect } from 'react'

/**
 * Site-wide SEO constants. SITE_URL is injected at build time (see vite.config.ts):
 * SITE_URL env var → Vercel production URL → localhost.
 */
export const SITE_URL: string = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ?? ''
export const SITE_NAME = 'Monetra'
export const DEFAULT_TITLE = 'Monetra · Income, expense & invoice tracking for freelancers and startups'
export const DEFAULT_DESCRIPTION =
  'Track income and expenses, send professional invoices, set budgets and see cash flow and runway at a glance. Built for freelancers, consultants and early-stage startups. Supports ₹, $, € and £.'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function setCanonical(href: string) {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.rel = 'canonical'
    document.head.appendChild(el)
  }
  el.href = href
}

export interface SeoOptions {
  title?: string
  description?: string
  /** Path for the canonical URL, e.g. "/" or "/signup". */
  path?: string
  /** Private or thin pages: keep them out of search results. */
  noindex?: boolean
}

/** Keeps <title>, description, canonical, robots and social tags in sync with the current page. */
export function useSeo({ title, description = DEFAULT_DESCRIPTION, path, noindex = false }: SeoOptions) {
  useEffect(() => {
    const fullTitle = title ? (title.includes(SITE_NAME) ? title : `${title} · ${SITE_NAME}`) : DEFAULT_TITLE
    document.title = fullTitle
    setMeta('name', 'description', description)
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large')
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', description)
    setMeta('name', 'twitter:title', fullTitle)
    setMeta('name', 'twitter:description', description)
    if (path !== undefined && SITE_URL) {
      setCanonical(SITE_URL + path)
      setMeta('property', 'og:url', SITE_URL + path)
    }
  }, [title, description, path, noindex])
}
