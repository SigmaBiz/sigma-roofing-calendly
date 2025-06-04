import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Return empty website images for now
  // In a real implementation, this would fetch from a database
  res.status(200).json({
    heroBackground: null,
    heroFeatureImage: null,
    residentialRoofingImage: null,
    roofRepairImage: null,
    roofInspectionImage: null,
    gutterServiceImage: null,
    stormDamageImage: null,
    paintingServiceImage: null,
    teamPhoto: null,
    visionImage: null,
    companyLogo: null,
    processStep1Image: null,
    processStep2Image: null,
    processStep3Image: null,
    processStep4Image: null,
    testimonialBackground: null,
    stormReportBackground: null
  });
}