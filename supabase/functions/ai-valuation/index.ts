import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { checkRateLimit } from '../_shared/rate-limiter.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { verifyTurnstileToken, getClientIp } from '../_shared/turnstile.ts';

/**
 * Edge Function: ai-valuation (v2, 2026-04-24)
 *
 * KI-gestuetzte Wohnmobil/Wohnwagen-Bewertung. Aenderungen ggue. v1:
 *
 * 1. Market-Comps: nutzt zusaetzlich zu Admin-Expertenwerten auch echte
 *    Verkaufspreise aus abgeschlossenen Auktionen (status in ['sold','ended']
 *    mit current_bid > 0). Das verankert die KI auf tatsaechliche Markt-
 *    Verhaeltnisse statt nur auf Experten-Schaetzungen.
 *
 * 2. KI-Persistenz: wenn `leadId` im Body ist, schreibt die Function den
 *    KI-Wert via RPC `update_ai_valuation` zurueck in die DB. Voraussetzung:
 *    Lead juenger als 30 Minuten UND ai_estimated_at IS NULL (race-safe,
 *    kein Ueberschreiben). Damit landet auch Public-Wertrechner-Output im
 *    Admin-Dashboard und kann fuers kontinuierliche Training genutzt werden.
 *
 * 3. Turnstile: optionales Cloudflare-Turnstile-Token kann mitgesendet werden
 *    (graceful degradation wenn Secret nicht gesetzt oder Token fehlt).
 *
 * 4. Rate-Limit gelockert von 10/15min/IP auf 40/15min/IP, damit Familien
 *    hinter NAT nicht geblockt werden (mehrere User teilen sich die IP).
 */

interface ValuationRequest {
  manufacturer?: string;
  model?: string;
  bodyType: string;
  year: number;
  mileage: number;
  condition: string;
  algorithmMin: number;
  algorithmMax: number;
  vehicleType?: string;
  lengthM?: number;
  leadId?: string;
  turnstileToken?: string;
}

interface TrainingDataPoint {
  manufacturer: string | null;
  model: string | null;
  body_type: string | null;
  year: number | null;
  mileage: number | null;
  condition: string | null;
  brand_tier: string | null;
  algorithm_value_min: number | null;
  algorithm_value_max: number | null;
  admin_estimated_value: number;
  vehicle_type: string | null;
}

interface AuctionComp {
  manufacturer: string | null;
  model: string | null;
  body_type: string | null;
  year: number | null;
  mileage: number | null;
  current_bid: number;
  end_time: string | null;
  has_solar: boolean | null;
  has_air_conditioning: boolean | null;
  has_markise: boolean | null;
  length_m: number | null;
  weight_kg: number | null;
}

const DB_BODY_TYPE_MAP: Record<string, string> = {
  integriert: 'Vollintegriert',
  teilintegriert: 'Teilintegriert',
  alkoven: 'Alkoven',
  kastenwagen: 'Kastenwagen',
  campingbus: 'Campingbus',
  wohnwagen: 'Wohnwagen',
  faltcaravan: 'Faltcaravan',
  mobilheim: 'Mobilheim',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const AI_VALUATION_RATE_LIMIT = {
    windowMs: 15 * 60 * 1000,
    maxRequests: 40,
  };
  const rateLimitResult = await checkRateLimit(req, AI_VALUATION_RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        hasAiEstimate: false,
        error: 'rate_limit',
        message: 'Zu viele Anfragen. Bitte warten Sie einige Minuten und versuchen Sie es erneut.',
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    const requestData: ValuationRequest = await req.json();

    const turnstileResult = await verifyTurnstileToken(requestData.turnstileToken, getClientIp(req));
    if (!turnstileResult.valid) {
      console.warn('ai-valuation: Turnstile validation failed', turnstileResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          hasAiEstimate: false,
          error: 'turnstile_failed',
          message: 'Bot-Schutz fehlgeschlagen. Bitte laden Sie die Seite neu und versuchen Sie es erneut.',
        }),
        {
          status: 200,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        },
      );
    }

    const isWohnwagen = requestData.vehicleType === 'Wohnwagen';

    if (!requestData.bodyType) requestData.bodyType = 'kastenwagen';
    if (!requestData.year) requestData.year = 2020;
    if (!requestData.condition) requestData.condition = 'good';
    if (!isWohnwagen && (requestData.mileage === undefined || requestData.mileage === null)) {
      requestData.mileage = 0;
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: trainingData, error: dbError } = await supabaseAdmin
      .from('value_assessment_leads')
      .select('manufacturer, model, body_type, year, mileage, condition, brand_tier, algorithm_value_min, algorithm_value_max, admin_estimated_value, vehicle_type')
      .not('admin_estimated_value', 'is', null)
      .order('admin_valued_at', { ascending: false })
      .limit(200);

    if (dbError) {
      console.error('DB error loading training data:', dbError);
      throw new Error('Trainingsdaten konnten nicht geladen werden');
    }

    const validTrainingData = (trainingData || []) as TrainingDataPoint[];
    const trainingCount = validTrainingData.length;

    const dbBodyType = DB_BODY_TYPE_MAP[requestData.bodyType] ?? requestData.bodyType;
    const { data: compData } = await supabaseAdmin
      .from('auctions')
      .select('current_bid, end_time, status, motorhomes!inner(manufacturer, model, year, mileage, body_type, has_solar, has_air_conditioning, has_markise, length_m, weight_kg)')
      .in('status', ['sold', 'ended'])
      .gt('current_bid', 1000)
      .eq('motorhomes.body_type', dbBodyType)
      .gte('motorhomes.year', requestData.year - 8)
      .lte('motorhomes.year', requestData.year + 8)
      .order('end_time', { ascending: false })
      .limit(30);

    const auctionComps: AuctionComp[] = Array.isArray(compData)
      ? (compData as Array<{
        current_bid: string | number;
        end_time: string | null;
        motorhomes: {
          manufacturer: string | null;
          model: string | null;
          body_type: string | null;
          year: number | null;
          mileage: number | null;
          has_solar: boolean | null;
          has_air_conditioning: boolean | null;
          has_markise: boolean | null;
          length_m: string | number | null;
          weight_kg: number | null;
        };
      }>).map((c) => ({
        manufacturer: c.motorhomes?.manufacturer ?? null,
        model: c.motorhomes?.model ?? null,
        body_type: c.motorhomes?.body_type ?? null,
        year: c.motorhomes?.year ?? null,
        mileage: c.motorhomes?.mileage ?? null,
        current_bid: Number(c.current_bid),
        end_time: c.end_time,
        has_solar: c.motorhomes?.has_solar ?? null,
        has_air_conditioning: c.motorhomes?.has_air_conditioning ?? null,
        has_markise: c.motorhomes?.has_markise ?? null,
        length_m: c.motorhomes?.length_m !== null && c.motorhomes?.length_m !== undefined
          ? Number(c.motorhomes.length_m)
          : null,
        weight_kg: c.motorhomes?.weight_kg ?? null,
      }))
      : [];

    const totalComparableCount = trainingCount + auctionComps.length;

    if (totalComparableCount < 3) {
      return new Response(
        JSON.stringify({
          success: true,
          hasAiEstimate: false,
          reason: 'insufficient_training_data',
          trainingCount,
          comparableCount: totalComparableCount,
          message: 'Noch nicht genügend Expertenbewertungen für eine KI-Schätzung vorhanden.',
        }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      );
    }

    const { data: settingsData, error: settingsError } = await supabaseAdmin
      .from('site_settings')
      .select('openai_api_key')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .single();

    if (settingsError) {
      console.error('Error loading settings:', settingsError);
      throw new Error('Einstellungen konnten nicht geladen werden');
    }

    const openaiApiKey = settingsData?.openai_api_key || Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          success: true,
          hasAiEstimate: false,
          reason: 'no_api_key',
          message: 'Kein OpenAI API-Key konfiguriert.',
        }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      );
    }

    const trainingText = validTrainingData.map((d, i) => {
      const algoAvg = d.algorithm_value_min && d.algorithm_value_max
        ? Math.round((d.algorithm_value_min + d.algorithm_value_max) / 2)
        : null;
      const isTrainingCaravan = d.vehicle_type === 'Wohnwagen'
        || ['wohnwagen', 'faltcaravan', 'mobilheim'].includes((d.body_type || '').toLowerCase());
      const mileageText = isTrainingCaravan ? 'k.A.' : `${d.mileage?.toLocaleString('de-DE') || '?'} km`;
      return `E${i + 1}. ${d.vehicle_type || '?'} | ${d.manufacturer || '?'} ${d.model || '?'} | ${d.body_type || '?'} | BJ ${d.year || '?'} | ${mileageText} | Zustand: ${d.condition || '?'} | Tier: ${d.brand_tier || '?'} | Algo: ${algoAvg ? algoAvg.toLocaleString('de-DE') + '€' : '?'} | Experte: ${d.admin_estimated_value.toLocaleString('de-DE')}€`;
    }).join('\n');

    const compText = auctionComps.length > 0
      ? auctionComps.map((c, i) => {
        const mileageText = isWohnwagen ? 'k.A.' : `${c.mileage?.toLocaleString('de-DE') || '?'} km`;
        const extras: string[] = [];
        if (c.has_solar) extras.push('Solar');
        if (c.has_air_conditioning) extras.push('Klima');
        if (c.has_markise) extras.push('Markise');
        const extrasText = extras.length > 0 ? ` | ${extras.join(', ')}` : '';
        const sizeText = c.length_m ? ` | ${c.length_m.toFixed(1)}m` : '';
        return `A${i + 1}. ${c.manufacturer || '?'} ${c.model || '?'} | ${c.body_type || '?'} | BJ ${c.year || '?'} | ${mileageText}${sizeText}${extrasText} | Endpreis: ${c.current_bid.toLocaleString('de-DE')}€`;
      }).join('\n')
      : '(keine aehnlichen Auktionen vorhanden)';

    const currentYear = new Date().getFullYear();
    const age = currentYear - requestData.year;
    const algoAvg = Math.round((requestData.algorithmMin + requestData.algorithmMax) / 2);

    const vehicleLabel = isWohnwagen ? 'Wohnwagen' : 'Wohnmobil';
    const mileageInfo = isWohnwagen
      ? '- Kilometerstand: Nicht relevant (Wohnwagen ohne Motor)'
      : `- Kilometerstand: ${(requestData.mileage || 0).toLocaleString('de-DE')} km`;
    const lengthInfo = requestData.lengthM
      ? `- Länge: ${requestData.lengthM.toFixed(2)} m`
      : '';

    const prompt = `Du bist ein Experte für ${vehicleLabel}-Bewertungen auf dem deutschen Markt.

DATENBASIS A: EXPERTEN-BEWERTUNGEN
${trainingCount} Bewertungen unseres Fahrzeug-Experten (Struktur: Kategorie | Hersteller Modell | Aufbautyp | Baujahr | KM | Zustand | Marken-Tier | Algo-Schätzwert | Expertenwert):

${trainingText}

DATENBASIS B: TATSÄCHLICHE VERKAUFSPREISE
${auctionComps.length} ähnliche ${vehicleLabel} die auf CaravanWert zu einem Endpreis verkauft/abgeschlossen wurden (Struktur: Hersteller Modell | Aufbautyp | Baujahr | KM | Länge | Ausstattung | Endpreis):

${compText}

Analysiere BEIDE Datensätze:
- Expertenbewertungen zeigen den "faire Marktwert aus Dealer-Sicht"
- Verkaufspreise zeigen den "tatsächlich gezahlten Wert"
- Wenn beide Datensätze übereinstimmen: hohe Konfidenz (85-95%)
- Wenn sie divergieren: mittlere Konfidenz (60-80%), Wert zwischen beiden
- Wenn wenig ähnliche Daten: niedrige Konfidenz (40-60%), näher am Algorithmus

Jetzt bewerte diesen neuen ${vehicleLabel}:
- Fahrzeugkategorie: ${vehicleLabel}
- Hersteller: ${requestData.manufacturer || 'Unbekannt'}
- Modell: ${requestData.model || 'Unbekannt'}
- Aufbautyp: ${requestData.bodyType}
- Baujahr: ${requestData.year} (${age} Jahre alt)
${mileageInfo}
${lengthInfo}
- Zustand: ${requestData.condition}
- Algorithmischer Schätzwert: ${algoAvg.toLocaleString('de-DE')}€ (${requestData.algorithmMin.toLocaleString('de-DE')}€ - ${requestData.algorithmMax.toLocaleString('de-DE')}€)

WICHTIG: Gib den geschätzten Wert als GANZE ZAHL in Euro an (NICHT in Tausend Euro).
Beispiel: Ein ${vehicleLabel} im Wert von vierzigtausend Euro = 40000 (NICHT 40).

Antworte NUR im folgenden JSON-Format, ohne weitere Erklärung:
{
  "estimated_value": <Ganzzahl in Euro, z.B. 40000 für 40.000€>,
  "confidence": <Zahl 0-100>,
  "reasoning": "<Kurze Begründung auf Deutsch, max 2 Sätze; erwähne wenn auf Auktions-Vergleich basiert>"
}`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `Du bist ein KI-Bewertungsassistent für ${vehicleLabel} auf dem deutschen Markt. Du nutzt sowohl Experten-Schätzungen als auch tatsächliche Auktions-Endpreise und gibst präzise Wertschätzungen ab. Antworte immer nur mit validem JSON.`,
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 350,
        temperature: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error('KI-Bewertung fehlgeschlagen');
    }

    const openaiData = await openaiResponse.json();
    const aiResponseText = openaiData.choices[0]?.message?.content?.trim();

    if (!aiResponseText) {
      throw new Error('Keine KI-Antwort erhalten');
    }

    let aiResult: { estimated_value: number; confidence: number; reasoning: string };
    try {
      const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Kein JSON in der Antwort');
      aiResult = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponseText, parseError);
      throw new Error('KI-Antwort konnte nicht verarbeitet werden');
    }

    if (typeof aiResult.estimated_value !== 'number' || aiResult.estimated_value < 0) {
      throw new Error('Ungültiger KI-Schätzwert');
    }

    const algoAvgForCheck = Math.round((requestData.algorithmMin + requestData.algorithmMax) / 2);
    if (aiResult.estimated_value < 500 && algoAvgForCheck > 5000) {
      console.log(`AI valuation auto-correction: ${aiResult.estimated_value}€ → ${aiResult.estimated_value * 1000}€ (Tausend-Euro-Bug, algo avg: ${algoAvgForCheck}€)`);
      aiResult.estimated_value = aiResult.estimated_value * 1000;
    }

    if (algoAvgForCheck > 0) {
      const ratio = aiResult.estimated_value / algoAvgForCheck;
      if (ratio < 0.01 || ratio > 100) {
        console.error(`AI valuation implausible: ${aiResult.estimated_value}€ vs algo ${algoAvgForCheck}€ (ratio: ${ratio})`);
        throw new Error('KI-Schätzwert ist unrealistisch');
      }
    }

    const confidence = Math.min(100, Math.max(0, aiResult.confidence || 50));
    const finalValue = Math.round(aiResult.estimated_value);
    const reasoning = aiResult.reasoning || '';

    if (requestData.leadId) {
      try {
        const { data: updateOk, error: updateErr } = await supabaseAdmin.rpc('update_ai_valuation', {
          p_lead_id: requestData.leadId,
          p_ai_value: finalValue,
          p_ai_confidence: confidence,
          p_ai_reasoning: reasoning,
          p_ai_source: 'openai-gpt-4.1-mini',
          p_comparable_count: totalComparableCount,
        });
        if (updateErr) {
          console.warn('update_ai_valuation RPC failed (non-fatal):', updateErr);
        } else if (updateOk === false) {
          console.warn(`update_ai_valuation: 0 rows updated for leadId=${requestData.leadId} (already set, too old, or not found)`);
        } else {
          console.log(`AI valuation persisted for leadId=${requestData.leadId}`);
        }
      } catch (persistErr) {
        console.warn('AI valuation persistence failed (non-fatal):', persistErr);
      }
    }

    console.log(`AI valuation: ${finalValue}€ (confidence: ${confidence}%, exp=${trainingCount}, comps=${auctionComps.length}) for ${requestData.manufacturer} ${requestData.model} ${requestData.year}`);

    return new Response(
      JSON.stringify({
        success: true,
        hasAiEstimate: true,
        aiEstimatedValue: finalValue,
        aiConfidence: confidence,
        aiReasoning: reasoning,
        trainingCount,
        comparableCount: totalComparableCount,
        auctionCompCount: auctionComps.length,
        metadata: {
          model: 'gpt-4.1-mini',
          tokens_used: openaiData.usage?.total_tokens || 0,
          generated_at: new Date().toISOString(),
        },
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error('Error in ai-valuation:', msg);

    return new Response(
      JSON.stringify({
        success: false,
        hasAiEstimate: false,
        error: msg,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      },
    );
  }
});
