import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

// Simplified schema for MVP3 form
const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(10),
  address: z.string().min(1),
  serviceType: z.string().min(1)
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Validate the request body
    const validatedData = contactSchema.parse(req.body);
    
    // Send email notification using SendGrid
    if (process.env.SENDGRID_API_KEY) {
      try {
        const sgMail = await import('@sendgrid/mail');
        sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);
        
        const msg = {
          to: process.env.SENDGRID_TO_EMAIL || 'aescalante@oksigma.com',
          from: process.env.SENDGRID_FROM_EMAIL || 'noreply@sigmaroofingllc.com',
          subject: `🏠 New Roofing Lead: ${validatedData.firstName} ${validatedData.lastName} - ${validatedData.serviceType}`,
          html: `
            <h2>New Lead Received</h2>
            <p><strong>Name:</strong> ${validatedData.firstName} ${validatedData.lastName}</p>
            <p><strong>Email:</strong> ${validatedData.email}</p>
            <p><strong>Phone:</strong> ${validatedData.phone}</p>
            <p><strong>Address:</strong> ${validatedData.address}</p>
            <p><strong>Service Type:</strong> ${validatedData.serviceType}</p>
            <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
          `
        };
        
        await sgMail.default.send(msg);
        console.log('Email sent successfully');
      } catch (emailError) {
        console.error('Email send error:', emailError);
        // Don't fail the request if email fails
      }
    }
    
    // For now, just return success since we don't have a database set up
    res.status(200).json({ 
      success: true, 
      message: "Thank you for your inquiry! We'll contact you within 24 hours.",
      id: Date.now() // Simple ID generation
    });
  } catch (error) {
    console.error("Contact form error:", error);
    res.status(400).json({ 
      success: false, 
      message: "Please check your form data and try again." 
    });
  }
}