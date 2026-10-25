// Post-build step: pre-render the landing page, inject structured data and font preloads,
// and generate robots.txt + sitemap.xml. Run after `vite build` and the SSR build.
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const root = resolve(import.meta.dirname, '..')
const dist = resolve(root, 'dist')
const SITE_URL = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  'http://localhost:5173'
).replace(/\/$/, '')

const { render, FAQ } = await import(pathToFileURL(resolve(root, 'dist-ssr/entry-prerender.js')).href)

const appHtml = render('/')

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Monetra',
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web',
    url: `${SITE_URL}/`,
    image: `${SITE_URL}/og-image.png`,
    screenshot: `${SITE_URL}/screens/overview-1440.jpg`,
    description:
      'Income, expense and invoice tracking for freelancers and early-stage startups, with budgets, cash-flow reports and runway estimates.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
    featureList: [
      'Income and expense tracking',
      'Invoices with partial payments and PDF export',
      'Category and overall budgets',
      'Cash-basis profit and loss and cash-flow reports',
      'Burn rate and runway estimates',
      'INR, USD, EUR and GBP',
    ],
  },
  { '@context': 'https://schema.org', '@type': 'WebSite', name: 'Monetra', url: `${SITE_URL}/` },
  { '@context': 'https://schema.org', '@type': 'Organization', name: 'Monetra', url: `${SITE_URL}/`, logo: `${SITE_URL}/icon-512.png` },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  },
]
const ld = jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n    ')

// Preload the two Latin font files used above the fold (helps Largest Contentful Paint).
const assets = readdirSync(resolve(dist, 'assets'))
const fonts = ['outfit-latin-wght', 'inter-latin-wght']
  .map((p) => assets.find((f) => f.startsWith(p) && f.endsWith('.woff2')))
  .filter(Boolean)
  .map((f) => `<link rel="preload" href="/assets/${f}" as="font" type="font/woff2" crossorigin />`)
  .join('\n    ')

const indexPath = resolve(dist, 'index.html')
let html = readFileSync(indexPath, 'utf8')
if (!html.includes('<!--app-html-->')) throw new Error('index.html is missing the <!--app-html--> marker')
html = html.replace('<!--app-html-->', appHtml).replace('<!--structured-data-->', `${fonts}\n    ${ld}`)
writeFileSync(indexPath, html)

writeFileSync(
  resolve(dist, 'robots.txt'),
  `# Monetra — only the public landing page is meant for search engines.
User-agent: *
Allow: /$
Allow: /signup
Allow: /assets/
Allow: /screens/
Allow: /og-image.png
Disallow: /login
Disallow: /forgot
Disallow: /onboarding
Disallow: /transactions
Disallow: /income
Disallow: /expenses
Disallow: /invoices
Disallow: /budgets
Disallow: /reports
Disallow: /settings

Sitemap: ${SITE_URL}/sitemap.xml
`,
)

const today = new Date().toISOString().slice(0, 10)
writeFileSync(
  resolve(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_URL}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>${SITE_URL}/signup</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>
</urlset>
`,
)

rmSync(resolve(root, 'dist-ssr'), { recursive: true, force: true })
console.log(`prerendered / (${(appHtml.length / 1024).toFixed(1)} KB) · robots.txt · sitemap.xml · site ${SITE_URL}`)
