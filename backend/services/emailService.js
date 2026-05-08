const emailService = {
  sendApplicationConfirmation: async (applicant) => {
    // Read env values at call time and normalize (strip surrounding quotes if present)
    const rawKey = process.env.BREVO_API_KEY;
    const brevoApiKey = rawKey ? String(rawKey).replace(/^['"]|['"]$/g, '') : undefined;
    const senderEmail = process.env.BREVO_SENDER_EMAIL || 'contact@example.com';
    const senderName = process.env.BREVO_SENDER_NAME || 'Evergreen Berry Harvest';

    if (!brevoApiKey) {
      console.warn('BREVO_API_KEY not set; skipping email');
      return null;
    }

    // Log masked key presence for debugging (first 8 chars only)
    try {
      const masked = brevoApiKey ? `${brevoApiKey.slice(0, 8)}...` : 'none';
      console.log(`BREVO_API_KEY present (masked): ${masked}`);
    } catch (e) {
      // ignore logging errors
    }

    try {
      const emailPayload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email: applicant.email, name: applicant.fullName }],
        subject: 'Thank you for your application',
        htmlContent: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto;">
                <h2 style="color: #153b20;">Thank you for your application, ${applicant.fullName}!</h2>
                <p>We have received your application for a seasonal berry picking role with Evergreen Berry Harvest.</p>
                <p><strong>Application Details:</strong></p>
                <ul>
                  <li>Email: ${applicant.email}</li>
                  <li>Phone: ${applicant.phoneNumber}</li>
                  <li>Driving License: ${applicant.hasDrivingLicense ? 'Yes' : 'No'}</li>
                  <li>Own Car: ${applicant.hasOwnCar ? 'Yes' : 'No'}</li>
                </ul>
                <p>We will review your application and contact selected applicants by email within the next few days.</p>
                <p>If you have any questions, please contact us at <a href="mailto:contact@serajshekh.fi">contact@serajshekh.fi</a>.</p>
                <hr style="margin-top: 40px; border: none; border-top: 1px solid #ddd;">
                <p style="font-size: 12px; color: #666;">
                  <strong>Evergreen Berry Harvest</strong><br>
                  Company: JSC enterprises<br>
                  Address: Oulu 90130 Ylioppilaantie 10B room 28<br>
                  Phone: +358449500808<br>
                  Business ID: 3586597-9
                </p>
              </div>
            </body>
          </html>
        `,
      };

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': brevoApiKey,
        },
        body: JSON.stringify(emailPayload),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Brevo API error:', error);
        return null;
      }

      console.log(`Confirmation email sent to ${applicant.email}`);
      return true;
    } catch (error) {
      console.error('Brevo email error:', error);
      return null;
    }
  },
  sendSelectionNotification: async () => null,
  sendLoginCredentials: async () => null,
};

export default emailService;
