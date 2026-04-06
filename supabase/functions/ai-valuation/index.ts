import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { checkRateLimit, createRateLimitErrorResponse } from '../_shared/rate-limiter.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

/**
 * Edge Function: ai-valuation
 *
 * KI-gestützte Wohnmobil-Bewertung, die aus Admin-Expertenwerten lernt.
 * 
 * Funktionsweise:
 * 1. Sammelt alle bisherigen Admin-Bewertungen als Trainingsdaten
 * 2. Sendet diese zusammen mit dem neuen Fahrzeug an GPT-4
 * 3. GPT-4 analysiert Muster in den Expertenbewertungen und schätzt den Wert
 * 4. Gibt einen KI-Schätzwert mit Konfidenz zurück
 *
 * Auth: Rate limited (10 requests per 15 min per IP) to prevent OpenAI cost abuse.
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
  vehicleType?: string; // "Wohnmobil" oder "Wohnwagen"
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  // Rate limiting: Stricter limit to prevent OpenAI API cost abuse
  const AI_VALUATION_RATE_LIMIT = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10,
  };
  const rateLimitResult = await checkRateLimit(req, AI_VALUATION_RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return createRateLimitErrorResponse(rateLimitResult, getCorsHeaders(req));
  }

  try {
    const requestData: ValuationRequest = await req.json();

    const isWohnwagen = requestData.vehicleType === 'Wohnwagen';

    // Fallback-Werte für fehlende Felder (statt 400-Fehler)
    // Verhindert "Edge Function returned a non-2xx status code" im Frontend
    if (!requestData.bodyType) requestData.bodyType = 'kastenwagen';
    if (!requestData.year) requestData.year = 2020;
    if (!requestData.condition) requestData.condition = 'good';
    if (!isWohnwagen && (requestData.mileage === undefined || requestData.mileage === null)) {
      requestData.mileage = 0;
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Trainingsdaten laden: Alle Leads mit Admin-Expertenwert
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

    // Wenn weniger als 3 Trainingsdaten vorhanden, keine KI-Schätzung möglich
    if (trainingCount < 3) {
      return new Response(
        JSON.stringify({
          success: true,
          hasAiEstimate: false,
          reason: 'insufficient_training_data',
          trainingCount,
          message: 'Noch nicht genügend Expertenbewertungen für eine KI-Schätzung vorhanden.',
        }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 2. OpenAI API Key aus site_settings laden
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
          message: 'Kein OpenAI API-Key konfiguriert. Bitte unter Einstellungen → KI / API eintragen.',
        }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      );
    }

    // 3. Trainingsdaten als kompakten Text aufbereiten
    const trainingText = validTrainingData.map((d, i) => {
      const algoAvg = d.algorithm_value_min && d.algorithm_value_max
        ? Math.round((d.algorithm_value_min + d.algorithm_value_max) / 2)
        : null;
      const isTrainingCaravan = d.vehicle_type === 'Wohnwagen' || ['wohnwagen', 'faltcaravan', 'mobilheim'].includes((d.body_type || '').toLowerCase());
      const mileageText = isTrainingCaravan ? 'k.A.' : `${d.mileage?.toLocaleString('de-DE') || '?'} km`;
      return `${i + 1}. ${d.vehicle_type || '?'} | ${d.manufacturer || '?'} ${d.model || '?'} | ${d.body_type || '?'} | BJ ${d.year || '?'} | ${mileageText} | Zustand: ${d.condition || '?'} | Tier: ${d.brand_tier || '?'} | Algo: ${algoAvg ? algoAvg.toLocaleString('de-DE') + '€' : '?'} | Experte: ${d.admin_estimated_value.toLocaleString('de-DE')}€`;
    }).join('\n');

    // 4. Prompt für GPT-4 erstellen
    const currentYear = new Date().getFullYear();
    const age = currentYear - requestData.year;
    const algoAvg = Math.round((requestData.algorithmMin + requestData.algorithmMax) / 2);

    const vehicleLabel = isWohnwagen ? 'Wohnwagen' : 'Wohnmobil';
    const mileageInfo = isWohnwagen
      ? '- Kilometerstand: Nicht relevant (Wohnwagen ohne Motor)'
      : `- Kilometerstand: ${(requestData.mileage || 0).toLocaleString('de-DE')} km`;

    const prompt = `Du bist ein Experte für ${vehicleLabel}-Bewertungen auf dem deutschen Markt.

Hier sind ${trainingCount} bisherige Bewertungen von unserem Experten. Jede Zeile enthält: Hersteller, Modell, Aufbautyp, Baujahr, Kilometerstand, Zustand, Preisklasse, algorithmischer Schätzwert und der tatsächliche Expertenwert:

${trainingText}

Analysiere die Muster in den Expertenbewertungen:
- Wie weicht der Experte vom Algorithmus ab?
- Welche Marken/Typen bewertet der Experte höher oder niedriger?
- Gibt es Muster bei Alter${isWohnwagen ? '' : ', Kilometerstand'} oder Zustand?

Jetzt bewerte diesen neuen ${vehicleLabel}:
- Fahrzeugkategorie: ${vehicleLabel}
- Hersteller: ${requestData.manufacturer || 'Unbekannt'}
- Modell: ${requestData.model || 'Unbekannt'}
- Aufbautyp: ${requestData.bodyType}
- Baujahr: ${requestData.year} (${age} Jahre alt)
${mileageInfo}
- Zustand: ${requestData.condition}
- Algorithmischer Schätzwert: ${algoAvg.toLocaleString('de-DE')}€ (${requestData.algorithmMin.toLocaleString('de-DE')}€ - ${requestData.algorithmMax.toLocaleString('de-DE')}€)

WICHTIG: Gib den geschätzten Wert als GANZE ZAHL in Euro an (NICHT in Tausend Euro).
Beispiel: Ein ${vehicleLabel} im Wert von vierzigtausend Euro = 40000 (NICHT 40).
Die Expertenwerte oben sind ebenfalls in ganzen Euro angegeben.

Antworte NUR im folgenden JSON-Format, ohne weitere Erklärung:
{
  "estimated_value": <Ganzzahl in Euro, z.B. 40000 für 40.000€>,
  "confidence": <Zahl 0-100>,
  "reasoning": "<Kurze Begründung auf Deutsch, max 2 Sätze>"
}`;

    // 5. OpenAI API aufrufen
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'system',
            content: `Du bist ein KI-Bewertungsassistent für ${vehicleLabel}. Du lernst aus Expertenbewertungen und gibst präzise Wertschätzungen ab. Antworte immer nur mit validem JSON.`
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 300,
        temperature: 0.3, // Niedrig für konsistente Bewertungen
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

    // 6. JSON-Antwort parsen
    let aiResult: { estimated_value: number; confidence: number; reasoning: string };
    try {
      // Versuche JSON aus der Antwort zu extrahieren (auch wenn Text drumherum ist)
      const jsonMatch = aiResponseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Kein JSON in der Antwort');
      aiResult = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponseText);
      throw new Error('KI-Antwort konnte nicht verarbeitet werden');
    }

    // Validierung
    if (typeof aiResult.estimated_value !== 'number' || aiResult.estimated_value < 0) {
      throw new Error('Ungültiger KI-Schätzwert');
    }

    // Plausibilitätsprüfung: Erkennung ob GPT den Wert in Tausend Euro statt Euro zurückgegeben hat
    // Wenn der KI-Wert < 500€ ist aber der Algorithmus-Durchschnitt > 5.000€, 
    // hat die KI wahrscheinlich in Tausend Euro geantwortet
    const algoAvgForCheck = Math.round((requestData.algorithmMin + requestData.algorithmMax) / 2);
    if (aiResult.estimated_value < 500 && algoAvgForCheck > 5000) {
      console.log(`AI valuation auto-correction: ${aiResult.estimated_value}€ → ${aiResult.estimated_value * 1000}€ (detected Tausend-Euro response, algo avg: ${algoAvgForCheck}€)`);
      aiResult.estimated_value = aiResult.estimated_value * 1000;
    }

    // Zusätzliche Plausibilitätsprüfung: Wert sollte nicht mehr als Faktor 10 vom Algo abweichen
    if (algoAvgForCheck > 0) {
      const ratio = aiResult.estimated_value / algoAvgForCheck;
      if (ratio < 0.01 || ratio > 100) {
        console.error(`AI valuation implausible: ${aiResult.estimated_value}€ vs algo ${algoAvgForCheck}€ (ratio: ${ratio})`);
        throw new Error('KI-Schätzwert ist unrealistisch');
      }
    }

    const confidence = Math.min(100, Math.max(0, aiResult.confidence || 50));

    console.log(`AI valuation: ${aiResult.estimated_value}€ (confidence: ${confidence}%) for ${requestData.manufacturer} ${requestData.model} ${requestData.year}`);

    return new Response(
      JSON.stringify({
        success: true,
        hasAiEstimate: true,
        aiEstimatedValue: Math.round(aiResult.estimated_value),
        aiConfidence: confidence,
        aiReasoning: aiResult.reasoning || '',
        trainingCount,
        metadata: {
          model: 'gpt-4.1-mini',
          tokens_used: openaiData.usage?.total_tokens || 0,
          generated_at: new Date().toISOString(),
        },
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in ai-valuation:', error);

    return new Response(
      JSON.stringify({
        success: false,
        hasAiEstimate: false,
        error: error.message || 'Unbekannter Fehler',
      }),
      {
        status: 200, // Don't fail hard, let frontend handle gracefully
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
