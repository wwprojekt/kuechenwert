// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SitemapUrl {
  loc: string
  lastmod?: string
  changefreq?: string
  priority?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const baseUrl = 'https://caravanwert.de'
    const today = new Date().toISOString().split('T')[0]

    // Static pages with priorities
    const staticUrls: SitemapUrl[] = [
      { loc: `${baseUrl}/`, lastmod: today, changefreq: 'daily', priority: '1.0' },
      { loc: `${baseUrl}/verkaufen`, lastmod: today, changefreq: 'weekly', priority: '0.9' },
      { loc: `${baseUrl}/kaufen`, lastmod: today, changefreq: 'daily', priority: '0.9' },
      { loc: `${baseUrl}/ankaufstationen`, lastmod: today, changefreq: 'weekly', priority: '0.8' },
      { loc: `${baseUrl}/haendler`, lastmod: today, changefreq: 'monthly', priority: '0.8' },
      { loc: `${baseUrl}/ratgeber`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
      { loc: `${baseUrl}/kontakt`, lastmod: today, changefreq: 'monthly', priority: '0.6' },
      { loc: `${baseUrl}/ueber-uns`, lastmod: today, changefreq: 'monthly', priority: '0.6' },
      { loc: `${baseUrl}/faq`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
      { loc: `${baseUrl}/blog`, lastmod: today, changefreq: 'daily', priority: '0.7' },
      { loc: `${baseUrl}/impressum`, lastmod: today, changefreq: 'yearly', priority: '0.3' },
      { loc: `${baseUrl}/datenschutz`, lastmod: today, changefreq: 'yearly', priority: '0.3' },
      { loc: `${baseUrl}/agb`, lastmod: today, changefreq: 'yearly', priority: '0.3' },
    ]

    // Ratgeber pages (88 guides)
    const ratgeberSlugs = [
      // Hymer
      'hymer-wohnmobil-verkaufen', 'was-kostet-mein-hymer-wohnmobil', 'hymer-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-hymer-wohnmobil', 'hymer-wohnmobil-versteigern',
      // Dethleffs
      'dethleffs-wohnmobil-verkaufen', 'was-kostet-mein-dethleffs-wohnmobil', 'dethleffs-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-dethleffs-wohnmobil', 'dethleffs-wohnmobil-versteigern',
      // Knaus
      'knaus-wohnmobil-verkaufen', 'was-kostet-mein-knaus-wohnmobil', 'knaus-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-knaus-wohnmobil', 'knaus-wohnmobil-versteigern',
      // Bürstner
      'buerstner-wohnmobil-verkaufen', 'was-kostet-mein-buerstner-wohnmobil', 'buerstner-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-buerstner-wohnmobil', 'buerstner-wohnmobil-versteigern',
      // Carthago
      'carthago-wohnmobil-verkaufen', 'was-kostet-mein-carthago-wohnmobil', 'carthago-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-carthago-wohnmobil', 'carthago-wohnmobil-versteigern',
      // Hobby
      'hobby-wohnmobil-verkaufen', 'was-kostet-mein-hobby-wohnmobil', 'hobby-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-hobby-wohnmobil', 'hobby-wohnmobil-versteigern',
      // Adria
      'adria-wohnmobil-verkaufen', 'was-kostet-mein-adria-wohnmobil', 'adria-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-adria-wohnmobil', 'adria-wohnmobil-versteigern',
      // Weinsberg
      'weinsberg-wohnmobil-verkaufen', 'was-kostet-mein-weinsberg-wohnmobil', 'weinsberg-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-weinsberg-wohnmobil', 'weinsberg-wohnmobil-versteigern',
      // Carado
      'carado-wohnmobil-verkaufen', 'was-kostet-mein-carado-wohnmobil', 'carado-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-carado-wohnmobil', 'carado-wohnmobil-versteigern',
      // Sunlight
      'sunlight-wohnmobil-verkaufen', 'was-kostet-mein-sunlight-wohnmobil', 'sunlight-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-sunlight-wohnmobil', 'sunlight-wohnmobil-versteigern',
      // Pössl
      'poessl-wohnmobil-verkaufen', 'was-kostet-mein-poessl-wohnmobil', 'poessl-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-poessl-wohnmobil', 'poessl-wohnmobil-versteigern',
      // Chausson
      'chausson-wohnmobil-verkaufen', 'was-kostet-mein-chausson-wohnmobil', 'chausson-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-chausson-wohnmobil', 'chausson-wohnmobil-versteigern',
      // Rapido
      'rapido-wohnmobil-verkaufen', 'was-kostet-mein-rapido-wohnmobil', 'rapido-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-rapido-wohnmobil', 'rapido-wohnmobil-versteigern',
      // Concorde
      'concorde-wohnmobil-verkaufen', 'was-kostet-mein-concorde-wohnmobil', 'concorde-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-concorde-wohnmobil', 'concorde-wohnmobil-versteigern',
      // Laika
      'laika-wohnmobil-verkaufen', 'was-kostet-mein-laika-wohnmobil', 'laika-wohnmobil-wert-ermitteln', 'wie-verkaufe-ich-mein-laika-wohnmobil', 'laika-wohnmobil-versteigern',
      // Condition — damage
      'wohnmobil-mit-motorschaden-verkaufen', 'wohnmobil-mit-wasserschaden-verkaufen', 'wohnmobil-mit-getriebeschaden-verkaufen', 'wohnmobil-mit-unfallschaden-verkaufen', 'wohnmobil-mit-hagelschaden-verkaufen', 'wohnmobil-mit-schimmel-verkaufen',
      // Condition — situation
      'wohnmobil-ohne-tuev-verkaufen', 'wohnmobil-mit-hoher-laufleistung-verkaufen', 'wohnmobil-mit-reparaturstau-verkaufen', 'wohnmobil-mit-leasingvertrag-verkaufen', 'wohnmobil-trotz-finanzierung-verkaufen', 'wohnmobil-im-erbfall-verkaufen', 'wohnmobil-bei-scheidung-verkaufen',
    ]

    const ratgeberUrls: SitemapUrl[] = ratgeberSlugs.map((slug) => ({
      loc: `${baseUrl}/ratgeber/${slug}`,
      lastmod: today,
      changefreq: 'monthly',
      priority: '0.7',
    }))

    // Fetch dynamic blog posts
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

    // Fetch active auctions
    const { data: auctions } = await supabase
      .from('auctions')
      .select('id, updated_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(100) // Limit to most recent 100 active auctions

    const auctionUrls: SitemapUrl[] = (auctions || []).map((auction) => ({
      loc: `${baseUrl}/auktion/${auction.id}`,
      lastmod: auction.updated_at || today,
      changefreq: 'hourly',
      priority: '0.8',
    }))

    // Fetch purchase stations
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

    // Combine all URLs
    const allUrls = [...staticUrls, ...ratgeberUrls, ...blogUrls, ...auctionUrls, ...stationUrls]

    // Generate XML sitemap
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
        ...corsHeaders,
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/sitemap'

*/

