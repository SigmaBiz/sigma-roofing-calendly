import { MailService } from '@sendgrid/mail';
import { ContactRequest } from '../shared/schema';

interface EmailServiceConfig {
  sendGridApiKey: string;
  notificationEmail: string;
}

class EmailService {
  private mailService: MailService;
  private config: EmailServiceConfig;

  constructor(config: EmailServiceConfig) {
    this.config = config;
    this.mailService = new MailService();
    this.initializeSendGrid();
  }

  private initializeSendGrid() {
    try {
      console.log('Initializing SendGrid email service...');
      this.mailService.setApiKey(this.config.sendGridApiKey);
      console.log('SendGrid initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SendGrid:', error);
    }
  }

  async sendLeadNotification(lead: ContactRequest): Promise<boolean> {
    try {
      const subject = `🏠 New Roofing Lead: ${lead.firstName} ${lead.lastName} - ${lead.serviceType}`;
      
      const formatTimeSlot = (time: string | null) => {
        if (!time) return 'Not specified';
        const hour = parseInt(time.split(':')[0]);
        const startTime = hour <= 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`;
        const endHour = hour + 4;
        const endTime = endHour <= 12 ? `${endHour}:00 AM` : `${endHour - 12}:00 PM`;
        return `${startTime} - ${endTime}`;
      };
      
      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #10b981, #047857); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">🏠 New Estimate Request</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Sigma Roofing LLC - Lead Notification</p>
          </div>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
            <h2 style="color: #047857; margin-top: 0;">Customer Information</h2>
            
            <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151; width: 120px;">Name:</td>
                  <td style="padding: 8px 0; color: #111827;">${lead.firstName} ${lead.lastName}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Phone:</td>
                  <td style="padding: 8px 0; color: #111827;"><a href="tel:${lead.phone}" style="color: #10b981; text-decoration: none;">${lead.phone}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Email:</td>
                  <td style="padding: 8px 0; color: #111827;"><a href="mailto:${lead.email}" style="color: #10b981; text-decoration: none;">${lead.email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Address:</td>
                  <td style="padding: 8px 0; color: #111827;">${lead.address}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold; color: #374151;">Service:</td>
                  <td style="padding: 8px 0; color: #111827;">${lead.serviceType}</td>
                </tr>
              </table>
            </div>

            ${lead.preferredDate1 && lead.preferredTime1 ? `
            <h3 style="color: #047857; margin-bottom: 10px;">📅 Preferred Appointment Times</h3>
            <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
              <div style="margin-bottom: 15px;">
                <strong style="color: #374151;">First Choice:</strong><br>
                <span style="color: #10b981; font-weight: bold;">${new Date(lead.preferredDate1).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span><br>
                <span style="color: #111827;">${formatTimeSlot(lead.preferredTime1)}</span>
              </div>
              ${lead.preferredDate2 && lead.preferredTime2 ? `
              <div>
                <strong style="color: #374151;">Second Choice:</strong><br>
                <span style="color: #10b981; font-weight: bold;">${new Date(lead.preferredDate2).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span><br>
                <span style="color: #111827;">${formatTimeSlot(lead.preferredTime2)}</span>
              </div>
              ` : ''}
            </div>
            ` : ''}
            
            ${lead.description ? `
            <h3 style="color: #047857; margin-bottom: 10px;">Project Details</h3>
            <div style="background: white; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
              <p style="margin: 0; color: #374151; line-height: 1.5;">${lead.description}</p>
            </div>
            ` : ''}
            
            <div style="background: #10b981; color: white; padding: 15px; border-radius: 6px; text-align: center;">
              <h3 style="margin: 0 0 10px 0;">Quick Actions</h3>
              <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                <a href="tel:${lead.phone}" style="background: #047857; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block;">📞 Call Now</a>
                <a href="mailto:${lead.email}" style="background: #047857; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block;">✉️ Email</a>
              </div>
            </div>
            
            <p style="margin-top: 20px; color: #6b7280; font-size: 14px; text-align: center;">
              Submitted: ${new Date(lead.createdAt).toLocaleString()}<br>
              Lead ID: #${lead.id}
            </p>
          </div>
        </div>
      `;

      const textBody = `
New Roofing Estimate Request - Sigma Roofing LLC

Customer Information:
- Name: ${lead.firstName} ${lead.lastName}
- Phone: ${lead.phone}
- Email: ${lead.email}
- Service Type: ${lead.serviceType}

${lead.description ? `Project Details:\n${lead.description}\n` : ''}

Submitted: ${new Date(lead.createdAt).toLocaleString()}
Lead ID: #${lead.id}

Contact them immediately to schedule their estimate!
      `;

      // Send email using SendGrid with verified sender - multiple recipients
      const recipients = [
        this.config.notificationEmail,
        // Add more email addresses here as needed
      ];
      
      await this.mailService.send({
        to: recipients,
        from: {
          email: 'aescalante@oksigma.com',
          name: 'Sigma Roofing Leads'
        },
        subject: subject,
        text: textBody,
        html: htmlBody,
      });

      console.log(`Lead notification email sent successfully for: ${lead.firstName} ${lead.lastName}`);
      return true;
    } catch (error) {
      console.error('Failed to send lead notification email:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      return false;
    }
  }
}

// Create and export the email service instance
const emailService = new EmailService({
  sendGridApiKey: process.env.SENDGRID_API_KEY || '',
  notificationEmail: process.env.NOTIFICATION_EMAIL || '',
});

export { emailService };