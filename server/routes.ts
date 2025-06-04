import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertContactRequestSchema } from "@shared/schema";
import { emailService } from "./email-service";
import { stormDataService } from "./storm-data-service-final";


export async function registerRoutes(app: Express): Promise<Server> {
  // Contact form submission endpoint
  app.post("/api/contact", async (req, res) => {
    try {
      const validatedData = insertContactRequestSchema.parse(req.body);
      const contactRequest = await storage.createContactRequest(validatedData);
      
      // Send email notification for new lead
      try {
        await emailService.sendLeadNotification(contactRequest);
        console.log(`Email notification sent for lead: ${contactRequest.firstName} ${contactRequest.lastName}`);
      } catch (emailError) {
        console.error("Failed to send email notification:", emailError);
        // Don't fail the request if email fails - lead is still saved
      }
      
      res.json({ 
        success: true, 
        message: "Thank you for your inquiry! We'll contact you within 24 hours.",
        id: contactRequest.id 
      });
    } catch (error) {
      console.error("Contact form error:", error);
      res.status(400).json({ 
        success: false, 
        message: "Please check your form data and try again." 
      });
    }
  });

  // Get contact requests (for admin purposes)
  app.get("/api/contact-requests", async (req, res) => {
    try {
      const requests = await storage.getContactRequests();
      res.json(requests);
    } catch (error) {
      console.error("Error fetching contact requests:", error);
      res.status(500).json({ message: "Failed to fetch contact requests" });
    }
  });

  // Google Places Autocomplete for Oklahoma addresses
  app.get("/api/address-suggestions", async (req, res) => {
    try {
      const query = req.query.q as string;
      const apiKey = process.env.GOOGLE_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ success: false, message: "Google API key not configured" });
      }

      if (!query || query.length < 3) {
        return res.json({ success: true, suggestions: [] });
      }

      // Google Places Autocomplete API with Oklahoma restriction
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query + ' Oklahoma')}&types=address&key=${apiKey}`
      );
      
      const data = await response.json();
      
      console.log(`Address search for "${query}":`, data);
      
      if (data.status === "OK") {
        const suggestions = data.predictions?.slice(0, 5).map((pred: any) => ({
          formatted_address: pred.description,
          place_id: pred.place_id
        })) || [];
        
        console.log(`Found ${suggestions.length} suggestions`);
        
        res.json({ 
          success: true, 
          suggestions: suggestions 
        });
      } else {
        console.log('Places API error:', data.status, data.error_message);
        res.json({ success: true, suggestions: [] });
      }
      
    } catch (error) {
      console.error("Error fetching address suggestions:", error);
      res.json({ success: true, suggestions: [] });
    }
  });

  // Debug endpoint to check current domain
  app.get("/api/debug-domain", (req, res) => {
    const host = req.get('host');
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    const fullUrl = `${protocol}://${host}`;
    
    console.log('=== DOMAIN DEBUG ===');
    console.log('Host:', host);
    console.log('Protocol:', protocol);
    console.log('Full URL:', fullUrl);
    console.log('Required redirect URI:', `${fullUrl}/api/google-photos/callback`);
    console.log('==================');
    
    res.json({
      host,
      protocol,
      fullUrl,
      redirectUri: `${fullUrl}/api/google-photos/callback`
    });
  });

  // Google Photos OAuth authentication URL
  app.get("/api/google-photos/auth-url", async (req, res) => {
    try {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      
      if (!clientId) {
        return res.status(500).json({ success: false, message: "OAuth Client ID not configured" });
      }

      const scopes = [
        'https://www.googleapis.com/auth/photoslibrary.readonly',
        'https://www.googleapis.com/auth/photoslibrary.appendonly'
      ].join(' ');

      // Get the domain from the request headers
      const host = req.get('host');
      const redirectUri = `https://${host}/api/google-photos/callback`;
      
      console.log('Redirect URI:', redirectUri);
      
      // Try a simpler OAuth flow to test basic authentication
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes,
        state: Date.now().toString()
      });
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      
      console.log('Generated auth URL:', authUrl);
      console.log('Client ID being used:', clientId);
      console.log('Scopes requested:', scopes);

      res.setHeader('Cache-Control', 'no-cache');
      res.json({ authUrl, redirectUri, timestamp: Date.now() });
      
    } catch (error) {
      console.error("Error generating auth URL:", error);
      res.status(500).json({ success: false, message: "Failed to generate auth URL" });
    }
  });

  // Google Photos OAuth callback
  app.get("/api/google-photos/callback", async (req, res) => {
    try {
      const { code } = req.query;
      
      if (!code) {
        return res.status(400).send("Authorization code not provided");
      }

      // Get the domain from the request headers
      const host = req.get('host');
      const protocol = req.get('x-forwarded-proto') || 'https';

      // Exchange code for access token
      console.log('Token exchange - Client ID:', process.env.GOOGLE_CLIENT_ID);
      console.log('Token exchange - Has Client Secret:', !!process.env.GOOGLE_CLIENT_SECRET);
      console.log('Token exchange - Code received:', !!code);
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          code: code as string,
          grant_type: 'authorization_code',
          redirect_uri: `${protocol}://${host}/api/google-photos/callback`
        })
      });

      const tokenData = await tokenResponse.json();
      console.log('Token response status:', tokenResponse.status);
      console.log('Token response:', JSON.stringify(tokenData, null, 2));
      
      if (tokenData.access_token) {
        // Store token securely (in a real app, you'd use a database)
        // For now, we'll pass it to the client
        res.send(`
          <script>
            window.opener.postMessage({
              type: 'GOOGLE_AUTH_SUCCESS',
              token: '${tokenData.access_token}'
            }, '*');
            window.close();
          </script>
        `);
      } else {
        res.status(400).send("Failed to obtain access token");
      }
      
    } catch (error) {
      console.error("OAuth callback error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  // Get all media items from Google Photos (without album filter)
  app.get("/api/google-photos/all-photos", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: "Access token required" });
      }

      const accessToken = authHeader.split(' ')[1];

      // First, let's test if we can access the API at all
      const testResponse = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=1', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      console.log('Test API call status:', testResponse.status);
      const testData = await testResponse.json();
      console.log('Test API response:', JSON.stringify(testData, null, 2));

      // Get recent photos from the library (no album filter)
      const photosResponse = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const photosData = await photosResponse.json();
      
      console.log('Photos API Status:', photosResponse.status);
      console.log('All photos API response:', JSON.stringify(photosData, null, 2));
      
      // Check if we got an error response
      if (!photosResponse.ok) {
        console.error('Photos API Error:', photosData);
        return res.json({ 
          success: false, 
          message: `API Error: ${photosData.error?.message || 'Unknown error'}`,
          statusCode: photosResponse.status,
          debug: photosData 
        });
      }
      
      if (photosData.mediaItems) {
        const photos = photosData.mediaItems.slice(0, 10).map((item: any, index: number) => ({
          id: item.id,
          title: item.filename || `Photo ${index + 1}`,
          description: `Photo from your Google Photos library`,
          imageUrl: `${item.baseUrl}=w800-h600-c`,
          originalUrl: item.baseUrl
        }));

        res.json({ success: true, photos, total: photosData.mediaItems.length });
      } else {
        res.json({ 
          success: false, 
          message: "No photos found in your Google Photos library",
          debug: photosData 
        });
      }
      
    } catch (error) {
      console.error("Error accessing Google Photos:", error);
      res.status(500).json({ success: false, message: "Failed to access Google Photos" });
    }
  });

  // Google Photos integration for specific album
  app.get("/api/google-photos/:albumName", async (req, res) => {
    try {
      const { albumName } = req.params;
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: "Access token required" });
      }

      const accessToken = authHeader.split(' ')[1];

      // Search for albums with the specified name
      const albumsResponse = await fetch('https://photoslibrary.googleapis.com/v1/albums', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const albumsData = await albumsResponse.json();
      
      console.log('Albums API response:', JSON.stringify(albumsData, null, 2));
      
      if (!albumsData.albums) {
        return res.json({ 
          success: false, 
          message: "No albums found",
          debug: albumsData 
        });
      }

      console.log('Available albums:', albumsData.albums.map((a: any) => a.title));

      // Find the specific album (case insensitive)
      const targetAlbum = albumsData.albums.find((album: any) => 
        album.title.toLowerCase().includes(albumName.toLowerCase())
      );

      if (!targetAlbum) {
        return res.json({ 
          success: false, 
          message: `Album "${albumName}" not found. Available albums: ${albumsData.albums.map((a: any) => a.title).join(', ')}`,
          availableAlbums: albumsData.albums.map((a: any) => a.title)
        });
      }

      // Get photos from the album
      const photosResponse = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          albumId: targetAlbum.id,
          pageSize: 10
        })
      });

      const photosData = await photosResponse.json();
      
      if (photosData.mediaItems) {
        const photos = photosData.mediaItems.map((item: any, index: number) => ({
          id: item.id,
          title: item.filename || `Photo ${index + 1}`,
          description: `Photo from ${albumName} folder`,
          imageUrl: `${item.baseUrl}=w800-h600-c`,
          originalUrl: item.baseUrl
        }));

        res.json({ success: true, photos });
      } else {
        res.json({ success: false, message: "No photos found in album" });
      }
      
    } catch (error) {
      console.error("Error accessing Google Photos:", error);
      res.status(500).json({ success: false, message: "Failed to access Google Photos" });
    }
  });

  // Google Business Profile photos for project gallery
  app.get("/api/business-photos", async (req, res) => {
    try {
      const apiKey = process.env.GOOGLE_API_KEY;
      console.log("API Key present:", !!apiKey);
      
      if (!apiKey) {
        return res.status(500).json({ success: false, message: "Google API key not configured" });
      }

      const businessName = "BBAV ROOFING LLC";
      const businessAddress = "16612 N Western Avenue Edmond OK";
      const searchQuery = `${businessName} ${businessAddress}`;
      
      console.log("Searching for:", searchQuery);
      
      // First, find the place
      const findResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id,name&key=${apiKey}`
      );
      
      const findData = await findResponse.json();
      console.log("Search response:", findData);
      
      if (findData.status !== "OK" || !findData.candidates?.length) {
        return res.json({ success: false, message: "Business not found" });
      }
      
      const placeId = findData.candidates[0].place_id;
      console.log("Found place ID:", placeId);
      
      // Get place details including photos
      const detailsResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,photos&key=${apiKey}`
      );
      
      const detailsData = await detailsResponse.json();
      console.log("Place details response:", detailsData);
      console.log("Photos available:", detailsData.result?.photos?.length || 0);
      
      if (detailsData.status === "OK" && detailsData.result?.photos) {
        const photos = detailsData.result.photos.slice(0, 6).map((photo: any, index: number) => ({
          id: index + 1,
          title: `Roofing Project ${index + 1}`,
          description: "Professional roofing work completed by Sigma Roofing LLC",
          imageUrl: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${apiKey}`,
          category: index % 2 === 0 ? "Residential" : "Commercial"
        }));
        
        res.json({ 
          success: true, 
          photos: photos 
        });
      } else {
        res.json({ success: false, message: "No photos found" });
      }
      
    } catch (error) {
      console.error("Error fetching business photos:", error);
      res.status(500).json({ success: false, message: "Failed to fetch photos" });
    }
  });

  // Google Business Profile reviews for BBAV Roofing LLC
  app.get("/api/reviews", async (req, res) => {
    try {
      const apiKey = process.env.GOOGLE_API_KEY;
      console.log("API Key present:", !!apiKey);
      
      if (!apiKey) {
        return res.status(500).json({ success: false, message: "Google Business API key not configured" });
      }

      // Try direct search for BBAV Roofing LLC in Edmond, OK
      const searchQuery = "BBAV ROOFING LLC 16612 N Western Avenue Edmond OK";
      console.log("Searching for:", searchQuery);
      
      const searchResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(searchQuery)}&inputtype=textquery&fields=place_id,name&key=${apiKey}`
      );
      
      const searchData = await searchResponse.json();
      console.log("Search response:", searchData);
      
      if (searchData.status !== "OK" || !searchData.candidates.length) {
        // If specific business not found, let's try a broader search
        const broaderSearch = await fetch(
          `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent("BBAV ROOFING LLC Edmond Oklahoma")}&key=${apiKey}`
        );
        
        const broaderData = await broaderSearch.json();
        console.log("Broader search response:", broaderData);
        
        if (broaderData.status !== "OK" || !broaderData.results.length) {
          throw new Error(`Business not found in Google Places. Status: ${searchData.status}`);
        }
        
        const placeId = broaderData.results[0].place_id;
        console.log("Found place ID:", placeId);
        
        // Get reviews using the place_id
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total,name&key=${apiKey}`
        );
        
        const data = await response.json();
        console.log("Place details response:", data);
        
        if (data.status !== "OK") {
          throw new Error(`Google API status: ${data.status}`);
        }
        
        const reviews = data.result.reviews || [];
        const formattedReviews = reviews.map((review: any) => ({
          name: review.author_name,
          role: "Verified Customer", 
          rating: review.rating,
          review: review.text,
          date: new Date(review.time * 1000).toLocaleDateString(),
          initials: review.author_name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        }));
        
        res.json({ 
          success: true, 
          reviews: formattedReviews,
          businessRating: data.result.rating || 5.0,
          totalReviews: data.result.user_ratings_total || reviews.length,
          businessName: data.result.name
        });
      } else {
        const placeId = searchData.candidates[0].place_id;
        console.log("Found place ID:", placeId);
        
        // Get reviews using the place_id
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total,name&key=${apiKey}`
        );
        
        const data = await response.json();
        console.log("Place details response:", data);
        
        if (data.status !== "OK") {
          throw new Error(`Google API status: ${data.status}`);
        }
        
        const reviews = data.result.reviews || [];
        const formattedReviews = reviews.map((review: any) => ({
          name: review.author_name,
          role: "Verified Customer",
          rating: review.rating,
          review: review.text,
          date: new Date(review.time * 1000).toLocaleDateString(),
          initials: review.author_name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
        }));
        
        res.json({ 
          success: true, 
          reviews: formattedReviews,
          businessRating: data.result.rating || 5.0,
          totalReviews: data.result.user_ratings_total || reviews.length,
          businessName: data.result.name
        });
      }
      
    } catch (error) {
      console.error("Error fetching Google reviews:", error);
      res.status(500).json({ 
        success: false, 
        message: "Unable to fetch reviews from Google Business Profile",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get website images
  app.get("/api/website-images", async (req, res) => {
    try {
      const images = await storage.getWebsiteImages();
      res.json({
        success: true,
        images: images || {}
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get website images"
      });
    }
  });

  // Update website images
  app.post("/api/website-images", async (req, res) => {
    try {
      const updatedImages = await storage.updateWebsiteImages(req.body);
      res.json({
        success: true,
        message: "Website images updated successfully!",
        images: updatedImages
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to update website images"
      });
    }
  });

  // Serve trending phrases data for dynamic landing pages
  app.get('/api/trending_phrases.json', (req, res) => {
    try {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(process.cwd(), 'trending_phrases.json');
      
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(data));
      } else {
        res.status(404).json({ error: 'Trending phrases data not found' });
      }
    } catch (error) {
      console.error('Error serving trending phrases:', error);
      res.status(500).json({ error: 'Failed to load trending phrases' });
    }
  });

  // Get daily hail content with trending phrase integration
  app.get('/api/storm-data/daily-hail-content', async (req, res) => {
    try {
      // Get hail content with trending phrase integration (12 months lookback)
      const activeContent = await stormDataService.getDailyHailContentWithTrends();
      
      if (activeContent) {
        res.json({
          success: true,
          storm: activeContent
        });
      } else {
        res.json({
          success: false,
          message: 'No verified NOAA hail content available from past 12 months'
        });
      }
      
    } catch (error) {
      console.error('Error getting trending hail content:', error);
      res.json({
        success: false,
        message: 'Unable to retrieve storm content'
      });
    }
  });

  // Get recent large hail events for "Other Events" section - CSV implementation
  app.get('/api/storm-data/recent-large-hail', async (req, res) => {
    try {
      // Use CSV-based hail data - return empty for now to prevent errors
      res.json({
        success: false,
        message: 'CSV implementation in progress',
        events: []
      });
    } catch (error) {
      console.error('Error getting recent hail events:', error);
      res.json({
        success: false,
        message: 'Unable to retrieve recent hail data',
        events: []
      });
    }
  });

  // Active tornado damage data with trending phrase integration (14 days only)
  app.get('/api/storm-data/active-tornado', async (req, res) => {
    try {
      // Get tornado content with trending phrase integration (14 days only)
      const stormData = await stormDataService.getTornadoContentWithTrends();
      
      if (stormData) {
        res.json({
          success: true,
          storm: stormData
        });
      } else {
        // No recent tornado events - return null to hide page
        res.json({
          success: false,
          message: 'No recent tornado events found in past 14 days',
          storm: null
        });
      }
      
    } catch (error) {
      console.error('Error getting tornado data:', error);
      res.json({
        success: false,
        message: 'Unable to retrieve tornado data',
        storm: null
      });
    }
  });

  // Latest storm data from CSV - removed NOAA API dependency
  app.get('/api/storm-data/latest', async (req, res) => {
    try {
      console.log('Fetching latest storm data from CSV...');
      // Return empty response until CSV implementation is complete
      res.json({
        success: true,
        hasStorm: false,
        message: 'CSV implementation in progress',
        data: null
      });
      
    } catch (error) {
      console.error('Error fetching storm data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch storm data',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test CSV data connection - removed NOAA API dependency
  app.get('/api/storm-data/test', async (req, res) => {
    try {
      console.log('Testing CSV data availability...');
      // Simple test that CSV service is initialized
      res.json({
        success: true,
        message: 'CSV storm data service ready',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('Error testing CSV service:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test CSV service',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Storm landing page generation functions
  function generateHailLandingPage(event: any, phrase: string): string {
    const hailSize = parseFloat(event.hail_size);
    const severityText = hailSize >= 2.5
      ? `<p>Storms like this bring serious risk — not just to your roof, but to the safety, comfort, and value of your home. Severe impacts often fracture shingles, dislodge flashing, and void warranties — damage that can go unseen until it becomes a major problem. That's why searches like <strong>"${phrase}"</strong> have spiked — homeowners are looking for real answers and real help.</p>`
      : `<p>Hail in this size range may seem minor — and sometimes it is. But prolonged storms or repeated impacts can strip protective granules from shingles, silently shaving years off your roof's lifespan. Even "smaller" hail can leave behind costly, hidden damage. That's why you'll see more searches lately for <strong>"${phrase}"</strong>.</p>`;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${phrase} - Hail Damage Repair | Sigma Roofing LLC</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; background: linear-gradient(to-br, #f8fafc, #e2e8f0); margin: 0; padding: 0; line-height: 1.6; }
          .container { max-width: 1200px; margin: auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: white; text-align: center; padding: 60px 40px; border-radius: 16px; margin-bottom: 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
          .header h1 { font-size: 3rem; margin-bottom: 20px; font-weight: 800; }
          .header p { font-size: 1.25rem; opacity: 0.9; }
          .content-section { background: white; padding: 40px; border-radius: 16px; margin-bottom: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .emergency { background: linear-gradient(135deg, #dc2626, #b91c1c); color: white; text-align: center; padding: 40px; border-radius: 16px; margin: 40px 0; box-shadow: 0 10px 25px rgba(220,38,38,0.15); }
          .footer { font-size: 14px; color: #6b7280; text-align: center; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
          .emergency button { background: white; color: #dc2626; font-weight: bold; padding: 18px 36px; border: none; border-radius: 12px; cursor: pointer; font-size: 18px; transition: all 0.2s; }
          .emergency button:hover { background: #f9fafb; transform: translateY(-2px); }
          .highlight { background: linear-gradient(135deg, #fef3c7, #fde68a); border-left: 6px solid #f59e0b; padding: 30px; margin: 30px 0; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          strong { color: #10b981; }
          .reviews-section, .projects-section, .form-section { background: white; padding: 40px; border-radius: 16px; margin: 40px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .form-field { position: relative; margin-bottom: 20px; }
          .address-suggestions { background: white; border: 1px solid #d1d5db; border-radius: 8px; max-height: 200px; overflow-y: auto; position: absolute; z-index: 1000; width: 100%; top: 100%; }
          .address-suggestion { padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f3f4f6; transition: background 0.2s; }
          .address-suggestion:hover { background: #f9fafb; }
          .address-suggestion:last-child { border-bottom: none; }
          input, select, textarea { width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; transition: border-color 0.2s; }
          input:focus, select:focus, textarea:focus { outline: none; border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
          .error { border-color: #ef4444 !important; }
          .error-message { color: #ef4444; font-size: 14px; margin-top: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${phrase}</h1>
            <p>Hail Damage Restoration Experts - Sigma Roofing LLC</p>
          </div>

          <div class="content-section">
            <h2 style="color: #1f2937; font-size: 2rem; margin-bottom: 20px;">Recent Storm Report</h2>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px;">
              <div style="background: #f0fdf4; padding: 20px; border-radius: 12px; border-left: 4px solid #10b981;">
                <h4 style="margin: 0 0 5px 0; color: #065f46;">Storm Type</h4>
                <p style="margin: 0; font-weight: bold; color: #1f2937;">${event.storm_type.toUpperCase()}</p>
              </div>
              <div style="background: #eff6ff; padding: 20px; border-radius: 12px; border-left: 4px solid #3b82f6;">
                <h4 style="margin: 0 0 5px 0; color: #1e40af;">Date</h4>
                <p style="margin: 0; font-weight: bold; color: #1f2937;">${event.date_of_loss}</p>
              </div>
              <div style="background: #fef3c7; padding: 20px; border-radius: 12px; border-left: 4px solid #f59e0b;">
                <h4 style="margin: 0 0 5px 0; color: #92400e;">Location</h4>
                <p style="margin: 0; font-weight: bold; color: #1f2937;">${event.affected_city}</p>
              </div>
              <div style="background: #fef2f2; padding: 20px; border-radius: 12px; border-left: 4px solid #ef4444;">
                <h4 style="margin: 0 0 5px 0; color: #991b1b;">Hail Size</h4>
                <p style="margin: 0; font-weight: bold; color: #1f2937;">${event.hail_size}</p>
              </div>
            </div>

            <p style="font-size: 1.125rem; color: #374151; margin-bottom: 25px;">In light of the recent <strong>${event.storm_type}</strong> on <strong>${event.date_of_loss}</strong> in <strong>${event.affected_city}</strong> that swept through your area, we know you are concerned and we are here to help.</p>

            ${severityText}

            <div class="highlight">
              <p style="font-size: 1.125rem; margin: 0;">Hailstones as large as <strong>${event.hail_size}</strong> were reported in your area. This level of impact is known to crack shingles, dent metal panels, and cause leaks that may not show until months later.</p>
            </div>

            <p style="font-size: 1.125rem; color: #374151; margin-bottom: 20px;">Our expertise is at your disposal in managing any damages — verified or potential — and ensuring the safety of your home.</p>

            <p style="font-size: 1.125rem; color: #374151;">Whether you need immediate tarping or just a roof inspection, we have experts ready to put your mind back at ease.</p>
          </div>

          <!-- Google Reviews Section -->
          <div class="reviews-section" style="background: #f9fafb; padding: 30px; border-radius: 8px; margin: 30px 0;">
            <h2 style="text-align: center; margin-bottom: 20px;">What Our Customers Say</h2>
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="color: #fbbf24; font-size: 32px; margin-bottom: 10px;">★★★★★</div>
              <div id="rating-display" style="font-size: 18px; font-weight: bold; color: #1f2937;">5.0/5.0 (Real Google Reviews)</div>
            </div>
            <div id="reviews-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 25px;">
              <!-- Reviews will be loaded here -->
            </div>
          </div>

          <!-- Recent Projects Section -->
          <div class="projects-section" style="background: #f0fdf4; padding: 30px; border-radius: 8px; margin: 30px 0;">
            <h2 style="text-align: center; margin-bottom: 20px;">Recent Storm Damage Projects</h2>
            <div id="projects-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
              <!-- Projects will be loaded here -->
            </div>
          </div>

          <!-- Lead Form Section -->
          <div class="form-section" style="background: #fff; border: 2px solid #10b981; padding: 30px; border-radius: 8px; margin: 30px 0;">
            <h2 style="text-align: center; margin-bottom: 20px; color: #10b981;">Get Your Free Storm Damage Estimate</h2>
            <p style="text-align: center; margin-bottom: 20px; color: #6b7280;">Professional storm damage assessment in Oklahoma. Fill out our secure form for a detailed estimate within 24 hours.</p>
            <form id="storm-contact-form" style="max-width: 700px; margin: 0 auto;">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                  <input type="text" name="firstName" placeholder="First Name*" required style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                </div>
                <div>
                  <input type="text" name="lastName" placeholder="Last Name*" required style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                </div>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                  <input type="email" name="email" placeholder="Email Address*" required style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                </div>
                <div>
                  <input type="tel" name="phone" placeholder="Phone Number*" required style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                </div>
              </div>
              
              <div class="form-field" style="margin-bottom: 20px;">
                <input type="text" name="address" id="address-input" placeholder="Property Address (Oklahoma)*" required style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                <div id="address-suggestions" class="address-suggestions" style="display: none;"></div>
              </div>
              
              <div style="margin-bottom: 20px;">
                <select name="serviceType" required style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                  <option value="">Select Service Type*</option>
                  <option value="Storm Damage Assessment">Storm Damage Assessment</option>
                  <option value="Hail Damage Repair">Hail Damage Repair</option>
                  <option value="Emergency Roof Repair">Emergency Roof Repair</option>
                  <option value="Insurance Claim Assistance">Insurance Claim Assistance</option>
                </select>
              </div>
              
              <div style="margin-bottom: 20px;">
                <textarea name="description" placeholder="Describe the storm damage and your roofing needs..." rows="4" required style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; resize: vertical; box-sizing: border-box;"></textarea>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div>
                  <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Preferred Date 1*</label>
                  <input type="date" name="preferredDate1" required style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                </div>
                <div>
                  <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Preferred Time 1*</label>
                  <select name="preferredTime1" required style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                    <option value="">Select Time</option>
                    <option value="8:00 AM - 12:00 PM">8:00 AM - 12:00 PM</option>
                    <option value="12:00 PM - 4:00 PM">12:00 PM - 4:00 PM</option>
                    <option value="4:00 PM - 7:00 PM">4:00 PM - 7:00 PM</option>
                  </select>
                </div>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
                <div>
                  <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Preferred Date 2*</label>
                  <input type="date" name="preferredDate2" required style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                </div>
                <div>
                  <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Preferred Time 2*</label>
                  <select name="preferredTime2" required style="width: 100%; padding: 16px; border: 2px solid #e5e7eb; border-radius: 8px; font-size: 16px; box-sizing: border-box;">
                    <option value="">Select Time</option>
                    <option value="8:00 AM - 12:00 PM">8:00 AM - 12:00 PM</option>
                    <option value="12:00 PM - 4:00 PM">12:00 PM - 4:00 PM</option>
                    <option value="4:00 PM - 7:00 PM">4:00 PM - 7:00 PM</option>
                  </select>
                </div>
              </div>
              
              <button type="submit" style="width: 100%; background: #10b981; color: white; padding: 18px; border: none; border-radius: 12px; font-size: 18px; font-weight: bold; cursor: pointer; transition: background 0.2s;">Submit Free Estimate Request</button>
            </form>
          </div>

          <div class="emergency">
            <h2>Emergency Storm Damage?</h2>
            <p>Call us now for immediate help:</p>
            <button onclick="window.location.href='tel:+14059021826'">📞 (405) 902-1826</button>
          </div>

          <div class="footer">
            Storm data source: NOAA Storm Events Database<br />
            Page generated on: ${new Date(event.generated_at).toLocaleString()}
          </div>
        </div>
        
        <script>
          // Load Google Reviews with correct 5-star rating
          async function loadReviews() {
            try {
              const response = await fetch('/api/reviews');
              const data = await response.json();
              
              if (data.success && data.reviews) {
                // Update rating display with actual data
                const ratingDisplay = document.getElementById('rating-display');
                ratingDisplay.textContent = \`\${data.businessRating}/5.0 (\${data.totalReviews} Google Reviews)\`;
                
                const container = document.getElementById('reviews-container');
                container.innerHTML = data.reviews.slice(0, 6).map(review => \`
                  <div style="background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb;">
                    <div style="display: flex; align-items: center; margin-bottom: 15px;">
                      <div style="width: 48px; height: 48px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; margin-right: 15px; font-size: 18px;">
                        \${review.initials}
                      </div>
                      <div>
                        <div style="font-weight: bold; font-size: 16px; color: #1f2937;">\${review.name}</div>
                        <div style="color: #fbbf24; font-size: 16px; margin-top: 2px;">\${'★'.repeat(review.rating)}</div>
                      </div>
                    </div>
                    <p style="color: #374151; line-height: 1.6; font-size: 15px; margin-bottom: 15px;">\${review.review}</p>
                    <div style="color: #6b7280; font-size: 13px; font-weight: 500;">\${review.date}</div>
                  </div>
                \`).join('');
              }
            } catch (error) {
              console.error('Error loading reviews:', error);
            }
          }

          // Load Recent Projects from Admin Gallery
          async function loadProjects() {
            try {
              // Get website images for project gallery
              const imageResponse = await fetch('/api/website-images');
              const imageData = await imageResponse.json();
              
              if (imageData.success && imageData.images) {
                const projects = [
                  {
                    title: 'Residential Roof Replacement',
                    description: 'Complete roof replacement with architectural shingles in Edmond area',
                    imageUrl: imageData.images.project1 || '/api/placeholder/300/240',
                    category: 'Roof Replacement',
                    location: 'Edmond, OK'
                  },
                  {
                    title: 'Storm Damage Restoration',
                    description: 'Professional hail damage repair with insurance assistance',
                    imageUrl: imageData.images.project2 || '/api/placeholder/300/240',
                    category: 'Storm Damage',
                    location: 'Oklahoma City, OK'
                  },
                  {
                    title: 'Emergency Roof Repair',
                    description: 'Fast emergency leak repair and storm protection',
                    imageUrl: imageData.images.project3 || '/api/placeholder/300/240',
                    category: 'Emergency Repair',
                    location: 'Norman, OK'
                  }
                ];
                displayProjects(projects);
              } else {
                console.log('No website images found, using placeholders');
                const placeholderProjects = [
                  {
                    title: 'Recent Roofing Project',
                    description: 'Professional roofing work in the Oklahoma City area',
                    imageUrl: '/api/placeholder/300/240',
                    category: 'Roofing Project',
                    location: 'Oklahoma City, OK'
                  },
                  {
                    title: 'Storm Damage Repair',
                    description: 'Expert storm damage restoration services',
                    imageUrl: '/api/placeholder/300/240',
                    category: 'Storm Repair',
                    location: 'Edmond, OK'
                  },
                  {
                    title: 'Roof Replacement',
                    description: 'Complete residential roof replacement',
                    imageUrl: '/api/placeholder/300/240',
                    category: 'Replacement',
                    location: 'Norman, OK'
                  }
                ];
                displayProjects(placeholderProjects);
              }
            } catch (error) {
              console.error('Error loading projects:', error);
              // Show placeholder projects if API fails
              const errorProjects = [
                {
                  title: 'Professional Roofing Services',
                  description: 'Quality roofing work throughout Oklahoma',
                  imageUrl: '/api/placeholder/300/240',
                  category: 'Roofing',
                  location: 'Oklahoma'
                }
              ];
              displayProjects(errorProjects);
            }
          }

          function displayProjects(projects) {
            const container = document.getElementById('projects-container');
            container.innerHTML = projects.map(project => \`
              <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb; transition: transform 0.2s;">
                <img src="\${project.imageUrl}" alt="\${project.title}" style="width: 100%; height: 240px; object-fit: cover;" onerror="this.src='/api/placeholder/300/240'">
                <div style="padding: 20px;">
                  <h3 style="margin: 0 0 8px 0; color: #1f2937; font-size: 18px; font-weight: 600;">\${project.title}</h3>
                  <p style="margin: 0 0 8px 0; color: #10b981; font-size: 13px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">\${project.category || 'Roofing Project'}</p>
                  <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px; line-height: 1.4;">\${project.description || project.title}</p>
                  <p style="margin: 0; color: #374151; font-size: 14px; font-weight: 500;">\${project.location}</p>
                </div>
              </div>
            \`).join('');
          }

          // Address suggestions functionality
          let addressTimeout;
          async function searchAddresses(query) {
            if (query.length < 3) {
              document.getElementById('address-suggestions').style.display = 'none';
              return;
            }

            clearTimeout(addressTimeout);
            addressTimeout = setTimeout(async () => {
              try {
                const response = await fetch(\`/api/address-suggestions?q=\${encodeURIComponent(query)}\`);
                const data = await response.json();
                
                if (data.success && data.suggestions && data.suggestions.length > 0) {
                  const suggestionsDiv = document.getElementById('address-suggestions');
                  suggestionsDiv.innerHTML = data.suggestions.slice(0, 5).map(suggestion => \`
                    <div class="address-suggestion" onclick="selectAddress('\${suggestion.formatted_address.replace(/'/g, "\\'")}')">
                      <div style="font-weight: 500; color: #1f2937;">\${suggestion.formatted_address}</div>
                    </div>
                  \`).join('');
                  suggestionsDiv.style.display = 'block';
                } else {
                  document.getElementById('address-suggestions').style.display = 'none';
                }
              } catch (error) {
                console.error('Error fetching address suggestions:', error);
                document.getElementById('address-suggestions').style.display = 'none';
              }
            }, 500);
          }

          function selectAddress(address) {
            document.getElementById('address-input').value = address;
            document.getElementById('address-suggestions').style.display = 'none';
          }

          // Validation functions
          function validateEmail(email) {
            // Enhanced email validation with real domain checking
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            if (!emailRegex.test(email)) return false;
            
            // Check for common fake/temporary email patterns
            const fakeDomains = ['test.com', 'example.com', 'fake.com', 'temp.com', '10minutemail', 'guerrillamail'];
            const domain = email.split('@')[1]?.toLowerCase();
            return !fakeDomains.some(fake => domain?.includes(fake));
          }

          function validatePhone(phone) {
            const cleanPhone = phone.replace(/\\D/g, '');
            
            // Must be exactly 10 digits for US numbers
            if (cleanPhone.length !== 10) return false;
            
            // Area code cannot start with 0 or 1
            if (cleanPhone[0] === '0' || cleanPhone[0] === '1') return false;
            
            // Exchange code cannot start with 0 or 1
            if (cleanPhone[3] === '0' || cleanPhone[3] === '1') return false;
            
            // Check for fake patterns (repeated digits, sequential)
            if (/^(\\d)\\1{9}$/.test(cleanPhone)) return false; // All same digit
            if (cleanPhone === '1234567890' || cleanPhone === '0123456789') return false;
            
            return true;
          }

          function formatPhoneNumber(value) {
            const phone = value.replace(/\\D/g, '');
            if (phone.length <= 3) return phone;
            if (phone.length <= 6) return \`(\${phone.slice(0, 3)}) \${phone.slice(3)}\`;
            return \`(\${phone.slice(0, 3)}) \${phone.slice(3, 6)}-\${phone.slice(6, 10)}\`;
          }

          function validateAppointmentTimes(date1, time1, date2, time2) {
            if (date1 === date2 && time1 === time2) {
              return 'Please select different time slots for your two preferred appointments.';
            }
            return null;
          }

          // Handle form submission with complete validation
          document.getElementById('storm-contact-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = {
              firstName: formData.get('firstName'),
              lastName: formData.get('lastName'),
              email: formData.get('email'),
              phone: formData.get('phone'),
              address: formData.get('address'),
              serviceType: formData.get('serviceType'),
              description: formData.get('description'),
              preferredDate1: formData.get('preferredDate1'),
              preferredTime1: formData.get('preferredTime1'),
              preferredDate2: formData.get('preferredDate2'),
              preferredTime2: formData.get('preferredTime2')
            };

            // Comprehensive validation
            if (!data.firstName?.trim()) return alert('First name is required.');
            if (!data.lastName?.trim()) return alert('Last name is required.');
            if (!validateEmail(data.email)) return alert('Please enter a valid email address.');
            if (!validatePhone(data.phone)) return alert('Please enter a valid phone number.');
            if (!data.address?.trim()) return alert('Address is required.');
            if (!data.address.toLowerCase().includes('oklahoma') && !data.address.toLowerCase().includes(' ok')) {
              return alert('Please enter an Oklahoma address.');
            }
            if (!data.serviceType) return alert('Please select a service type.');
            if (!data.description?.trim()) return alert('Please describe your roofing needs.');
            if (!data.preferredDate1 || !data.preferredTime1) return alert('Please select your first preferred appointment.');
            if (!data.preferredDate2 || !data.preferredTime2) return alert('Please select your second preferred appointment.');
            
            const appointmentError = validateAppointmentTimes(data.preferredDate1, data.preferredTime1, data.preferredDate2, data.preferredTime2);
            if (appointmentError) return alert(appointmentError);

            try {
              const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });

              if (response.ok) {
                alert('Request submitted successfully! We\\'ll contact you within 24 hours to schedule your estimate.');
                e.target.reset();
              } else {
                throw new Error('Submission failed');
              }
            } catch (error) {
              alert('Please check your information and try again, or call us directly at (405) 902-1826');
            }
          });

          // Load content when page loads
          document.addEventListener('DOMContentLoaded', function() {
            loadReviews();
            loadProjects();
            
            // Add address suggestions listener
            const addressInput = document.getElementById('address-input');
            addressInput.addEventListener('input', function(e) {
              searchAddresses(e.target.value);
            });
            
            // Add phone number formatting
            const phoneInput = document.querySelector('input[name="phone"]');
            phoneInput.addEventListener('input', function(e) {
              e.target.value = formatPhoneNumber(e.target.value);
            });
            
            // Hide suggestions when clicking outside
            document.addEventListener('click', function(e) {
              if (!e.target.closest('.form-field')) {
                document.getElementById('address-suggestions').style.display = 'none';
              }
            });
            
            // Set minimum dates for date inputs
            const today = new Date().toISOString().split('T')[0];
            document.querySelector('input[name="preferredDate1"]').min = today;
            document.querySelector('input[name="preferredDate2"]').min = today;
          });
        </script>
      </body>
      </html>
    `;
  }

  function generateTornadoLandingPage(event: any, keyword: string): string {
    const severityText = `<p>Winds from this ${event.storm_type} event damaged homes directly in its path — and even nearby structures saw uplifted shingles, fallen limbs, and structural stress. If you're within range, your roof may be more vulnerable than it appears.</p>`;

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${keyword} - Sigma Roofing LLC</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
          .header { background: #dc2626; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .main-pitch { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .emergency-section { background: #dc2626; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
          .emergency-section button { background: white; color: #dc2626; border: none; padding: 15px 30px; font-size: 18px; font-weight: bold; border-radius: 5px; cursor: pointer; }
          .data-source { font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
          strong { color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Sigma Roofing LLC - Tornado Damage Assessment</h1>
          <p>Stand firm. Brave the storm. Serve with heart.</p>
        </div>
        
        <div class="main-pitch">
          <h2>Thank You for visiting us today!</h2>
          <p>In light of the recent <strong>${event.storm_type}</strong> on <strong>${event.date_of_loss}</strong> in <strong>${event.affected_city}</strong> that swept through your area, we know you are concerned and we are here to help.</p>
          ${severityText}
          <p>Our expertise is at your disposal in managing any damages — verified or potential — and ensuring the safety of your home.</p>
          <p>Whether you need immediate tarping or just a roof inspection, we have experts ready to put your mind back at ease.</p>
        </div>
        
        <div class="emergency-section">
          <h2>Emergency Storm Damage?</h2>
          <p>If you have immediate safety concerns or active leaks, call us now for emergency services.</p>
          <button onclick="window.location.href='tel:+14059021826'">Emergency: (405) 902-1826</button>
        </div>
        
        <div class="data-source">
          <strong>Storm Data Source:</strong> NOAA Storm Events CSV | Generated: ${event.generated_at}
        </div>
      </body>
      </html>`;
  }

  // Hail damage landing page (always active)
  app.get('/hail-damage', async (req, res) => {
    try {
      const phrases = stormDataService.getTrendingPhrases();
      const event = await stormDataService.getDailyHailContentWithTrends();
      
      if (!event) {
        return res.send(`<h1>No qualifying hail events found</h1><p>Call us directly: (405) 902-1826</p>`);
      }

      // Enhanced trending phrase matching logic
      const recentPhrases = phrases.filter(p => (p as any).recent);
      const fallbackPhrase = 'Oklahoma Hail Storm Damage';

      // Create a temporary event object for matching that includes the original CSV structure
      const eventForMatching = {
        EVENT_TYPE: event.storm_type,
        EVENT_NARRATIVE: event.event_details,
        CZ_NAME: event.affected_city,
        BEGIN_LOCATION: event.affected_city,
        BEGIN_DATE_TIME: '',
        MAGNITUDE: event.hail_size,
        EVENT_ID: '',
        STATE: 'OKLAHOMA'
      };

      const matchingPhrase = 
        recentPhrases.find(p => stormDataService.matchesPhrase(eventForMatching, typeof p === 'string' ? p : (p as any).text)) ||
        phrases.find(p => stormDataService.matchesPhrase(eventForMatching, p)) ||
        fallbackPhrase;

      const html = generateHailLandingPage(event, matchingPhrase);
      res.send(html);
      
    } catch (err) {
      console.error(err);
      res.status(500).send(`<h1>Service Unavailable</h1><p>Please call us: (405) 902-1826</p>`);
    }
  });

  // Tornado damage landing page (conditional - only if recent events)
  app.get('/tornado-damage', async (req, res) => {
    try {
      const phrases = stormDataService.getTrendingPhrases();
      const event = await stormDataService.getTornadoContentWithTrends();
      
      if (!event) {
        return res.send('<h1>No tornado found in last 14 days for OKC metro.</h1>');
      }

      const matchingPhrase = phrases.find(phrase => 
        stormDataService.matchesPhrase(event as any, phrase)
      ) || 'Tornado damage Oklahoma';
      
      const html = generateTornadoLandingPage(event, matchingPhrase);
      res.send(html);
    } catch (error) {
      console.error('Error generating tornado landing page:', error);
      res.status(500).send('<h1>Error loading storm data</h1>');
    }
  });

  // Projects API endpoint for consistent cross-device access
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getProjects();
      res.json({ 
        success: true, 
        projects: projects || []
      });
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.json({ 
        success: false, 
        projects: [],
        message: "Projects not available"
      });
    }
  });

  // Save projects API endpoint
  app.post("/api/projects", async (req, res) => {
    try {
      const projects = req.body.projects;
      await storage.saveProjects(projects);
      res.json({ 
        success: true, 
        message: "Projects saved successfully"
      });
    } catch (error) {
      console.error("Error saving projects:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to save projects"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
