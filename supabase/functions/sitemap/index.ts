// Dynamische sitemap.xml fuer kuechenwert24.de.
//
// Ablauf: Der nginx im Frontend-Container proxied GET /sitemap.xml an diese
// Edge Function (siehe docker/default.conf). Hier werden statische KuechenWert-
// Routen (Homepage, Funnels, Content-Seiten, Legal-Pages) mit dynamischen
// Quellen (Blog-Posts, aktive Auktionen, Showrooms) zusammengefuehrt und als
// gueltiges sitemaps.org-XML zurueckgegeben.
//
// Geschichte: Diese Function stammt aus dem Caravanwert-Fork und listete dort
// 100+ Wohnmobil-SEO-Landings und Marken-Ratgeber (Hymer, Dethleffs, Knaus,
// …). Beim KuechenWert-Umbau wurden diese Pages aus dem Repo entfernt — die
// URLs bleiben aber im Google-Index und liefern jetzt 404, wenn sie noch in
// der sitemap stehen. Deshalb enthaelt die Liste unten **ausschliesslich**
// Routen, die in src/App.tsx tatsaechlich aktiv sind.
//
// Kuechen-Landing-Pages (z.B. /nobilia-kueche-planen, /kueche-guenstig-kaufen)
// werden ergaenzt, sobald die TSX-Pages und ratgeberMeta-Eintraege existieren.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1'
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts'

interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const baseUrl = 'https://kuechenwert24.de'
    const today = new Date().toISOString().split('T')[0]

    // Statische Routen — spiegelt public/sitemap.xml und src/App.tsx.
    const staticUrls: SitemapUrl[] = [
      // Homepage
      { loc: `${baseUrl}/`, lastmod: today, changefreq: 'daily', priority: '1.0' },

      // Funnel-Einstiege (A = Angebote einholen, B = Studio-Preis unterbieten,
      // C = Traumkueche AI). Das sind die primaeren Conversion-Einstiege.
      { loc: `${baseUrl}/funnel/a`, lastmod: today, changefreq: 'weekly', priority: '0.9' },
      { loc: `${baseUrl}/funnel/b`, lastmod: today, changefreq: 'weekly', priority: '0.9' },
      { loc: `${baseUrl}/funnel/c`, lastmod: today, changefreq: 'weekly', priority: '0.9' },

      // Preis-/Budget-Rechner.
      { loc: `${baseUrl}/kuechenrechner`, lastmod: today, changefreq: 'weekly', priority: '0.9' },

      // Content-Seiten.
      { loc: `${baseUrl}/kaufen`, lastmod: today, changefreq: 'weekly', priority: '0.8' },
      { loc: `${baseUrl}/haendler`, lastmod: today, changefreq: 'monthly', priority: '0.7' },
      { loc: `${baseUrl}/ratgeber`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
      { loc: `${baseUrl}/blog`, lastmod: today, changefreq: 'daily', priority: '0.7' },
      { loc: `${baseUrl}/faq`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
      { loc: `${baseUrl}/preise`, lastmod: today, changefreq: 'monthly', priority: '0.6' },

      // Partner / Showrooms.
      { loc: `${baseUrl}/ankaufstationen`, lastmod: today, changefreq: 'monthly', priority: '0.6' },

      // Unternehmen.
      { loc: `${baseUrl}/ueber-uns`, lastmod: today, changefreq: 'monthly', priority: '0.6' },
      { loc: `${baseUrl}/kontakt`, lastmod: today, changefreq: 'monthly', priority: '0.6' },

      // Rechtliches.
      { loc: `${baseUrl}/impressum`, lastmod: today, changefreq: 'yearly', priority: '0.3' },
      { loc: `${baseUrl}/datenschutz`, lastmod: today, changefreq: 'yearly', priority: '0.3' },
      { loc: `${baseUrl}/agb`, lastmod: today, changefreq: 'yearly', priority: '0.3' },

      // Registrierung fuer Kuechenstudios (Partner-Akquise).
      { loc: `${baseUrl}/register/haendler`, lastmod: today, changefreq: 'monthly', priority: '0.5' },
    ]

    // Dynamische Blog-Posts. Kuechen-Themen sind hier bereits lauffaehig
    // (z.B. "Neue Kueche planen — 7 Fehler vermeiden").
    const { data: blogPosts } = await supabase
      .from('blog_posts')
      .select('slug, published_at, updated_at')
      .eq('published', true)
      .order('published_at', { ascending: false })

    const blogUrls: SitemapUrl[] = (blogPosts || []).map((post) => ({
      loc: `${baseUrl}/blog/${post.slug}`,
      lastmod: post.updated_at || post.published_at || today,
      changefreq: 'monthly',
      priority: '0.6',
    }))

    // Reverse-Auktionen fuer neue Kuechen. Aktuell leer, wird lebendig sobald
    // Studios Leads gewinnen und Verkaufsangebote erstellt werden.
    const { data: auctions } = await supabase
      .from('auctions')
      .select('id, updated_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100)

    const auctionUrls: SitemapUrl[] = (auctions || []).map((auction) => ({
      loc: `${baseUrl}/auktion/${auction.id}`,
      lastmod: auction.updated_at || today,
      changefreq: 'hourly',
      priority: '0.8',
    }))

    // Kuechen-Showrooms / Partner-Studios fuer Vor-Ort-Beratung.
    const { data: stations } = await supabase
      .from('purchase_stations')
      .select('id, updated_at')
      .eq('is_active', true)

    const stationUrls: SitemapUrl[] = (stations || []).map((station) => ({
      loc: `${baseUrl}/ankaufstationen/${station.id}`,
      lastmod: station.updated_at || today,
      changefreq: 'monthly',
      priority: '0.7',
    }))

    const allUrls = [...staticUrls, ...blogUrls, ...auctionUrls, ...stationUrls]

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${allUrls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ''}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ''}
    ${url.priority ? `<priority>${url.priority}</priority>` : ''}
  </url>`
  )
  .join('\n')}
</urlset>`

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
