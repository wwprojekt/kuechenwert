// Dynamische sitemap.xml fuer kuechenwert24.de.
//
// Der nginx im Frontend-Container proxied GET /sitemap.xml an diese Edge
// Function (siehe docker/default.conf). Sie listet nur indexierbare Seiten:
// die oeffentlichen Routen unten plus veroeffentlichte Blog-Posts.
//
// Seiten mit noIndex gehoeren nicht hinein (sonst meldet die Search Console
// "Gesendete URL als noindex gekennzeichnet"): Impressum, Datenschutz, AGB,
// /ratgeber, Login/Registrierung, Funnel A, Danke-Seite, /projekt, Konten.
// Aendert eine Seite ihr noIndex, hier und in public/sitemap.xml nachziehen.
// Alt-URLs, die nginx per 301 umleitet, gehoeren ebenfalls nicht hinein.
//
// lastmod gibt es nur fuer Blog-Posts (updated_at aus der Datenbank). Fuer die
// statischen Seiten fehlt ein verlaessliches Aenderungsdatum, und ein falsches
// (frueher jeden Tag "heute") fuehrt dazu, dass Google lastmod der ganzen
// Sitemap ignoriert. changefreq und priority wertet Google nicht aus.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1'
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'
import { BRAND } from '../_shared/brand-config.ts'

interface SitemapUrl {
  loc: string
  lastmod?: string
}

const BASE_URL = BRAND.baseUrl

const STATIC_PATHS = [
  '/',
  // Funnel-Einstiege: A (Angebote einholen ueber die Landing /formular),
  // B (Studio-Preis unterbieten), C (Traumkueche mit KI).
  '/formular',
  '/funnel/b',
  '/funnel/c',
  '/kuechenrechner',
  '/haendler',
  '/kuechenstudios',
  '/preise',
  '/faq',
  '/ueber-uns',
  '/kontakt',
  '/barrierefreiheit',
]

// nginx liefert /blog/<slug> nur fuer diese Zeichen aus, alles andere ist 404.
const BLOG_SLUG = /^[a-z0-9-]+$/

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: blogPosts, error: blogError } = await supabase
      .from('blog_posts')
      .select('slug, published_at, updated_at')
      .eq('published', true)
      .order('published_at', { ascending: false })

    if (blogError) {
      console.error('sitemap: blog_posts konnten nicht gelesen werden:', blogError.message)
    }

    const blogUrls: SitemapUrl[] = (blogPosts || [])
      .filter((post) => BLOG_SLUG.test(post.slug))
      .map((post) => ({
        loc: `${BASE_URL}/blog/${post.slug}`,
        lastmod: (post.updated_at || post.published_at || '').slice(0, 10) || undefined,
      }))

    // Die Blog-Uebersicht nur mit Artikeln: ohne Posts ist sie eine leere Seite.
    const newestBlogDate = blogUrls
      .map((url) => url.lastmod)
      .filter((date): date is string => !!date)
      .sort()
      .pop()
    const blogIndex: SitemapUrl[] = blogUrls.length > 0 ? [{ loc: `${BASE_URL}/blog`, lastmod: newestBlogDate }] : []

    const allUrls: SitemapUrl[] = [...STATIC_PATHS.map((path) => ({ loc: `${BASE_URL}${path}` })), ...blogIndex, ...blogUrls]

    const sitemap = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...allUrls.map(
        (url) => `  <url><loc>${url.loc}</loc>${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}</url>`
      ),
      '</urlset>',
      '',
    ].join('\n')

    return new Response(sitemap, {
      headers: {
        ...getCorsHeaders(req),
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
