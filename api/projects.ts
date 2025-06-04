import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Return sample projects for now
  res.status(200).json([
    {
      id: 1,
      title: "Complete Roof Replacement",
      description: "Full roof replacement after storm damage",
      imageUrl: "/images/project1.jpg",
      category: "Roof Replacement",
      location: "Edmond, OK",
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      title: "Emergency Storm Repair",
      description: "Emergency repair after hail damage",
      imageUrl: "/images/project2.jpg",
      category: "Storm Damage",
      location: "Oklahoma City, OK",
      createdAt: new Date().toISOString()
    }
  ]);
}