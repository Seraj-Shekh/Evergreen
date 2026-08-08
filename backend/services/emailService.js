const getEmailBranding = () => {
  const rawKey = process.env.BREVO_API_KEY;
  const brevoApiKey = rawKey ? String(rawKey).replace(/^['"]|['"]$/g, '') : undefined;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'contact@example.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Evergreen Berry Harvest';
  const logoUrl = process.env.BREVO_LOGO_URL || process.env.COMPANY_LOGO_URL || '';
  const clientUrl = String(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

  return { brevoApiKey, senderEmail, senderName, logoUrl, clientUrl };
};

const renderEmailHeader = ({ logoUrl, title, subtitle }) => `
  <div style="text-align: center; margin-bottom: 24px;">
    ${logoUrl ? `<img src="${logoUrl}" alt="JSC entreprises logo" style="max-width: 140px; height: auto; margin: 0 auto 16px; display: block;">` : ''}
    <div style="display: inline-block; padding: 10px 16px; border-radius: 999px; background: #153b20; color: #fff; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; font-size: 12px;">Evergreen Berry Harvest</div>
    <h2 style="color: #153b20; margin: 16px 0 8px;">${title}</h2>
    ${subtitle ? `<p style="margin: 0; color: #5b6770;">${subtitle}</p>` : ''}
  </div>
`;

const renderResetButton = (resetUrl) => `
  <div style="text-align: center; margin: 28px 0;">
    <a
      href="${resetUrl}"
      style="display: inline-block; background: #153b20; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 999px; font-weight: 700;"
    >
      Reset password
    </a>
  </div>
`;

const renderPortalButton = (portalUrl, label = 'Open your account') => `
  <div style="text-align: center; margin: 28px 0;">
    <a
      href="${portalUrl}"
      style="display: inline-block; background: #153b20; color: #fff; text-decoration: none; padding: 12px 22px; border-radius: 999px; font-weight: 700;"
    >
      ${label}
    </a>
  </div>
`;

const renderEmailFooter = () => `
  <hr style="margin-top: 40px; border: none; border-top: 1px solid #ddd;">
  <div style="font-size: 12px; color: #666; line-height: 1.7;">
    <p style="margin: 0 0 12px;">
      If you have any concern regarding income entry or picking related things contact
      <a href="mailto:jeevanchhetri465@gmail.com">jeevanchhetri465@gmail.com</a>.
      If you have any technical problem contact
      <a href="mailto:contact@serajshekh.fi">contact@serajshekh.fi</a>.
    </p>
    <p style="margin: 0 0 8px;"><strong>JSC entreprises</strong></p>
    <p style="margin: 0;">Address: Oulu 90130 Ylioppilaantie 10B room 28</p>
    <p style="margin: 0;">Phone: +358449500808</p>
    <p style="margin: 0;">Business ID: 3586597-9</p>
  </div>
`;

const formatMoney = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return parsed.toFixed(2);
};

const formatDate = value => {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'Europe/Helsinki',
  }).format(date);
};

const formatDateOnlyUtc = value => {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(date);
};

const emailService = {
  sendApplicationConfirmation: async (applicant) => {
    // Read env values at call time and normalize (strip surrounding quotes if present)
    const { brevoApiKey, senderEmail, senderName, logoUrl } = getEmailBranding();

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
                ${renderEmailHeader({ logoUrl, title: `Thank you for your application, ${applicant.fullName}!`, subtitle: 'We have received your seasonal berry picking application.' })}
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
                ${renderEmailFooter()}
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
  sendUserOnboardingEmail: async (userData) => {
    const { brevoApiKey, senderEmail, senderName, logoUrl } = getEmailBranding();

    if (!brevoApiKey) {
      console.warn('BREVO_API_KEY not set; skipping onboarding email');
      return null;
    }

    const { email, fullName, pickerId, tempPassword, groupName } = userData;

    try {
      const emailPayload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email, name: fullName }],
        subject: 'Welcome to Evergreen Berry Harvest - Account Activated',
        htmlContent: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto;">
                ${renderEmailHeader({ logoUrl, title: `Welcome, ${fullName}!`, subtitle: 'Your account has been activated.' })}
                <p>Congratulations! You have been selected for berry picking with Evergreen Berry Harvest.</p>
                <p><strong>Your Account Details:</strong></p>
                <ul>
                  <li>Email: <strong>${email}</strong></li>
                  <li>Picker ID: <strong>${pickerId}</strong></li>
                  <li>Temporary Password: <strong>${tempPassword}</strong></li>
                  <li>Group Name: <strong>${groupName}</strong></li>
                </ul>
                <p style="background-color: #f0f8f4; padding: 15px; border-left: 4px solid #153b20; margin: 20px 0;">
                  <strong style="color: #153b20;">Important:</strong> Please log in and change your password immediately on your first login and add your bank account details. 
                  You will not be able to proceed until you have changed your password.
                </p>
                <p><strong>Portal Access:</strong></p>
                <p>
                  Use the Evergreen Berry Harvest website to log in and manage your account: <a href=" https://evergreen-harvest-berry.netlify.app/portal">https://evergreen-harvest-berry.netlify.app/portal</a>
                </p>
                <p><strong>What you can do in the portal:</strong></p>
                  <ul>
                    <li>View your group members</li>
                    <li>Track your daily income and picking details</li>
                    <li>Monitor your earnings</li>
                  </ul>
                </p>
                <p>If you have any questions or issues logging in, please contact us at <a href="mailto:contact@serajshekh.fi">contact@serajshekh.fi</a>.</p>
                ${renderEmailFooter()}
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

      console.log(`Onboarding email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Brevo onboarding email error:', error);
      return null;
    }
  },
  sendIncomeEntryEmail: async (incomeData) => {
    const { brevoApiKey, senderEmail, senderName, logoUrl } = getEmailBranding();

    if (!brevoApiKey) {
      console.warn('BREVO_API_KEY not set; skipping income email');
      return null;
    }

    const {
      email,
      fullName,
      pickerId,
      date,
      location,
      berryType,
      berryWeightKg,
      carrotWeightKg,
      amount,
      calculatedIncome,
    } = incomeData;

    const formattedDate = date ? formatDate(date) : 'N/A';
    const formattedUnitPrice = formatMoney(amount);
    const formattedTotalIncome = formatMoney(calculatedIncome);

    try {
      const emailPayload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email, name: fullName }],
        subject: 'New income record added to your account',
        htmlContent: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto;">
                ${renderEmailHeader({ logoUrl, title: `Hi ${fullName},`, subtitle: 'A new income record has been added to your account.' })}
                <p>The following records has been added to your income details.</p>
                <p><strong>Record details:</strong></p>
                <ul>
                  <li>Date: <strong>${formattedDate}</strong></li>
                  <li>Picker ID: <strong>${pickerId}</strong></li>
                  <li>Location: <strong>${location}</strong></li>
                  <li>Berry type: <strong>${berryType}</strong></li>
                  <li>Berry wt: <strong>${berryWeightKg}</strong></li>
                  <li>Cart wt: <strong>${carrotWeightKg}</strong></li>
                  <li>Unit price: <strong>${formattedUnitPrice}</strong></li>
                  <li>Total amt: <strong>${formattedTotalIncome}</strong></li>
                </ul>
                <p>Thank you for your hard work!</p>
                ${renderEmailFooter()}
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

      console.log(`Income email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Brevo income email error:', error);
      return null;
    }
  },
  sendPasswordResetEmail: async (resetData) => {
    const { brevoApiKey, senderEmail, senderName, logoUrl } = getEmailBranding();

    if (!brevoApiKey) {
      console.warn('BREVO_API_KEY not set; skipping password reset email');
      return null;
    }

    const { email, fullName, resetUrl } = resetData;

    try {
      const emailPayload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email, name: fullName }],
        subject: 'Reset your Evergreen Berry Harvest password',
        htmlContent: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto;">
                ${renderEmailHeader({ logoUrl, title: 'Password reset request', subtitle: 'Use the button below to create a new password.' })}
                <p>Hello ${fullName},</p>
                <p>We received a request to reset your Evergreen Berry Harvest password. Click the button below to continue.</p>
                ${renderResetButton(resetUrl)}
                <p style="font-size: 13px; color: #5b6770;">If the button does not work, paste this link into your browser:</p>
                <p style="word-break: break-all; font-size: 13px;"><a href="${resetUrl}">${resetUrl}</a></p>
                <p style="font-size: 13px; color: #5b6770;">If you did not request this change, you can ignore this email and your password will remain unchanged.</p>
                ${renderEmailFooter()}
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

      console.log(`Password reset email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Brevo password reset email error:', error);
      return null;
    }
  },
  sendPaymentNotificationEmail: async (paymentData) => {
    const { brevoApiKey, senderEmail, senderName, logoUrl } = getEmailBranding();

    if (!brevoApiKey) {
      console.warn('BREVO_API_KEY not set; skipping payment notification email');
      return null;
    }

    const {
      email,
      fullName,
      pickerId,
      fromDate,
      toDate,
      incomeTotal,
      expenseTotal,
      fineTotal,
      netPayable,
      paidAmount,
      notes,
    } = paymentData;

    const formattedIncome = formatMoney(incomeTotal);
    const formattedExpense = formatMoney(expenseTotal);
    const formattedFine = formatMoney(fineTotal);
    const formattedNetPayable = formatMoney(netPayable);
    const formattedPaidAmount = formatMoney(paidAmount);

    try {
      const emailPayload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email, name: fullName }],
        subject: 'Your payout has been marked as paid',
        htmlContent: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto;">
                ${renderEmailHeader({ logoUrl, title: `Hi ${fullName},`, subtitle: 'Your earnings payout has been processed.' })}
                <p>Your payout for the selected period has been marked as paid.</p>
                <p><strong>Payment details:</strong></p>
                <ul>
                  <li>Picker ID: <strong>${pickerId}</strong></li>
                  <li>Period: <strong>${formatDateOnlyUtc(fromDate)} to ${formatDateOnlyUtc(toDate)}</strong></li>
                  <li>Income total: <strong>€${formattedIncome}</strong></li>
                  <li>Expense total: <strong>€${formattedExpense}</strong></li>
                  <li>Fine total: <strong>€${formattedFine}</strong></li>
                  <li>Net payable: <strong>€${formattedNetPayable}</strong></li>
                  <li>Paid amount: <strong>€${formattedPaidAmount}</strong></li>
                </ul>
                ${notes ? `<p><strong>Note:</strong> ${notes}</p>` : ''}
                <p>Thank you for your hard work.</p>
                ${renderEmailFooter()}
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

      console.log(`Payment notification email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Brevo payment notification error:', error);
      return null;
    }
  },
  sendFineNotificationEmail: async (fineData) => {
    const { brevoApiKey, senderEmail, senderName, logoUrl, clientUrl } = getEmailBranding();

    if (!brevoApiKey) {
      console.warn('BREVO_API_KEY not set; skipping fine notification email');
      return null;
    }

    const {
      email,
      fullName,
      pickerId,
      portalUrl,
      date,
      reason,
      amount,
      vatAmount,
      netAmount,
    } = fineData;

    const formattedDate = date ? formatDateOnlyUtc(date) : 'N/A';
    const formattedAmount = formatMoney(amount);
    const formattedVat = formatMoney(vatAmount);
    const formattedNet = formatMoney(netAmount);
    const loginUrl = portalUrl || `${clientUrl}/portal`;

    try {
      const emailPayload = {
        sender: { name: senderName, email: senderEmail },
        to: [{ email, name: fullName }],
        subject: 'A fine has been added to your account',
        htmlContent: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto;">
                ${renderEmailHeader({ logoUrl, title: `Hi ${fullName},`, subtitle: 'A new fine has been added to your account.' })}
                <p>A fine was added to your picker account. You can log in to view the full details in your portal.</p>
                ${renderPortalButton(loginUrl, 'View fine details')}
                <p><strong>Fine details:</strong></p>
                <ul>
                  <li>Picker ID: <strong>${pickerId}</strong></li>
                  <li>Date: <strong>${formattedDate}</strong></li>
                  <li>Reason: <strong>${reason}</strong></li>
                  <li>Base amount: <strong>€${formattedAmount}</strong></li>
                  <li>VAT: <strong>€${formattedVat}</strong></li>
                  <li>Net fine: <strong>€${formattedNet}</strong></li>
                </ul>
                <p>Please log in to your account to see the updated fine history and attachment proof.</p>
                ${renderEmailFooter()}
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

      console.log(`Fine notification email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('Brevo fine notification error:', error);
      return null;
    }
  },
  sendSelectionNotification: async () => null,
  sendLoginCredentials: async () => null,
};

export default emailService;
