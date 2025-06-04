import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Fallback Oklahoma cities
  const fallbackSuggestions = [
    { formatted_address: "Oklahoma City, OK, USA", place_id: "fallback_okc" },
    { formatted_address: "Edmond, OK, USA", place_id: "fallback_edmond" },
    { formatted_address: "Norman, OK, USA", place_id: "fallback_norman" },
    { formatted_address: "Moore, OK, USA", place_id: "fallback_moore" },
    { formatted_address: "Midwest City, OK, USA", place_id: "fallback_mwc" },
    { formatted_address: "Yukon, OK, USA", place_id: "fallback_yukon" },
    { formatted_address: "Mustang, OK, USA", place_id: "fallback_mustang" },
    { formatted_address: "Deer Creek, OK, USA", place_id: "fallback_deer_creek" }
  ];

  try {
    const query = req.query.q as string;
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey || !query || query.length < 1) {
      // Return filtered fallback suggestions
      const filtered = fallbackSuggestions.filter(city => 
        city.formatted_address.toLowerCase().includes(query?.toLowerCase() || '')
      );
      
      return res.status(200).json({ 
        success: true, 
        suggestions: filtered,
        source: 'fallback'
      });
    }

    // Google Places API call - match MVP3 exactly
    const apiUrl = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    apiUrl.searchParams.set('input', `${query} Oklahoma`);
    apiUrl.searchParams.set('types', 'address');
    apiUrl.searchParams.set('components', 'country:us');
    apiUrl.searchParams.set('key', apiKey);
    
    const response = await fetch(apiUrl.toString());
    const data = await response.json();
    
    console.log(`Address search for "${query}":`, data.status);
    
    if (data.status === "OK") {
      const suggestions = data.predictions?.slice(0, 5).map((pred: any) => ({
        formatted_address: pred.description,
        place_id: pred.place_id
      })) || [];
      
      console.log(`Found ${suggestions.length} suggestions`);
      
      res.status(200).json({ 
        success: true, 
        suggestions: suggestions,
        source: 'google_places'
      });
    } else {
      // Return fallback on API error
      console.log('Places API error:', data.status, data.error_message);
      res.status(200).json({ 
        success: true, 
        suggestions: fallbackSuggestions.slice(0, 4),
        source: 'fallback'
      });
    }
    
  } catch (error) {
    console.error("Error fetching address suggestions:", error);
    // Return fallback on error
    res.status(200).json({ 
      success: true, 
      suggestions: fallbackSuggestions.slice(0, 4),
      source: 'fallback'
    });
  }
}