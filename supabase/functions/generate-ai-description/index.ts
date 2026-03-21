import { checkRateLimit, createRateLimitErrorResponse, RATE_LIMITS } from '../_shared/rate-limiter.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

interface AIDescriptionRequest {
  manufacturer: string;
  model: string;
  year: number;
  mileage: number;
  condition: string;
  bodyType: string;
  sleepingPlaces: number;
  features: {
    has_kitchen?: boolean;
    has_toilet?: boolean;
    has_shower?: boolean;
    has_solar?: boolean;
    has_awning?: boolean;
    heating_type?: string;
    air_conditioning?: string;
    [key: string]: any;
  };
  additionalEquipment?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  // Check rate limit
  const rateLimitResult = await checkRateLimit(req, RATE_LIMITS.API_GENERAL);
  if (!rateLimitResult.allowed) {
    return createRateLimitErrorResponse(rateLimitResult, getCorsHeaders(req));
  }

  try {
    const requestData: AIDescriptionRequest = await req.json();

    // Validate required fields
    if (!requestData.manufacturer || !requestData.model || !requestData.year) {
      throw new Error('Manufacturer, model, and year are required');
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Build feature list for AI prompt
    const features = [];
    if (requestData.features.has_kitchen) features.push('Küche');
    if (requestData.features.has_toilet) features.push('Toilette');
    if (requestData.features.has_shower) features.push('Dusche');
    if (requestData.features.has_solar) features.push('Solaranlage');
    if (requestData.features.has_awning) features.push('Markise');
    if (requestData.features.heating_type) features.push(`${requestData.features.heating_type}-Heizung`);
    if (requestData.features.air_conditioning && requestData.features.air_conditioning !== 'Keine') {
      features.push(`Klimaanlage (${requestData.features.air_conditioning})`);
    }

    // Create AI prompt in German
    const prompt = `
Erstelle eine professionelle und ansprechende Verkaufsbeschreibung für ein Wohnmobil auf Deutsch. 
Die Beschreibung soll verkaufsfördernd, aber ehrlich und sachlich sein, ähnlich wie bei mobile.de.

Fahrzeugdaten:
- Hersteller: ${requestData.manufacturer}
- Modell: ${requestData.model}
- Baujahr: ${requestData.year}
- Kilometerstand: ${requestData.mileage.toLocaleString('de-DE')} km
- Zustand: ${requestData.condition}
- Aufbauart: ${requestData.bodyType}
- Schlafplätze: ${requestData.sleepingPlaces}
- Ausstattung: ${features.length > 0 ? features.join(', ') : 'Grundausstattung'}
${requestData.additionalEquipment ? `- Zusatzausstattung: ${requestData.additionalEquipment}` : ''}

Schreibe eine strukturierte Beschreibung mit:
1. Einleitungsabsatz (2-3 Sätze)
2. Technische Highlights
3. Ausstattungsmerkmale
4. Zustand und Wartung
5. Abschließender Verkaufsappell

Verwende einen professionellen, aber warmen Ton. Maximal 500 Wörter.
`;

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'Du bist ein Experte für Wohnmobil-Verkaufstexte und schreibst professionelle, ansprechende Beschreibungen für den deutschen Markt.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800,
        temperature: 0.7,
        frequency_penalty: 0.3,
        presence_penalty: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI API error:', errorData);
      throw new Error('AI description generation failed');
    }

    const openaiData = await openaiResponse.json();
    const generatedDescription = openaiData.choices[0]?.message?.content;

    if (!generatedDescription) {
      throw new Error('No description generated');
    }

    // Clean up the description
    const cleanedDescription = generatedDescription
      .trim()
      .replace(/^\*\*.*?\*\*\n?/gm, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\n{3,}/g, '\n\n') // Limit line breaks
      .substring(0, 2000); // Limit length

    console.log('AI description generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        description: cleanedDescription,
        metadata: {
          model: 'gpt-4',
          tokens_used: openaiData.usage?.total_tokens || 0,
          generated_at: new Date().toISOString(),
        },
      }),
      { 
        headers: { 
          ...getCorsHeaders(req), 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('Error in generate-ai-description:', error);
    
    // Return fallback description on error
    const fallbackDescription = `
${requestData.manufacturer} ${requestData.model} aus ${requestData.year} mit ${requestData.mileage.toLocaleString('de-DE')} Kilometern.

Dieses gepflegte Wohnmobil bietet ${requestData.sleepingPlaces} Schlafplätze und ist in einem ${requestData.condition.toLowerCase()}en Zustand. 

Die Ausstattung umfasst alle wichtigen Komponenten für komfortables Reisen. Ideal für Camping-Enthusiasten und Reiseliebhaber.

Weitere Details und Besichtigungstermin gerne auf Anfrage.
    `.trim();

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        fallback_description: fallbackDescription,
      }),
      {
        status: 200, // Don't fail the request, provide fallback
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    );
  }
});
