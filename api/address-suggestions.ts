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

  try {
    const query = req.query.q as string;
    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      console.error('Google API key not configured');
      return res.status(200).json({ success: true, suggestions: [] });
    }

    if (!query || query.length < 3) {
      return res.status(200).json({ success: true, suggestions: [] });
    }

    // Google Places Autocomplete API with Oklahoma restriction
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query + ' Oklahoma')}&types=address&key=${apiKey}`
    );
    
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
        suggestions: suggestions 
      });
    } else {
      console.log('Places API error:', data.status, data.error_message);
      res.status(200).json({ success: true, suggestions: [] });
    }
    
  } catch (error) {
    console.error("Error fetching address suggestions:", error);
    res.status(200).json({ success: true, suggestions: [] });
  }
}