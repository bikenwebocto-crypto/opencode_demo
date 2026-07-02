/**
 * Email Service Usage Examples
 * 
 * This file demonstrates how to use the email service in your application.
 */

import { emailService } from '@/lib/email/email';

/**
 * Example 1: Send a simple welcome email
 */
async function sendWelcomeEmail(userEmail: string, userName: string) {
  const result = await emailService.sendEmail({
    to: userEmail,
    subject: 'Welcome to Our Platform!',
    html: `
      <h1>Welcome, ${userName}!</h1>
      <p>Thank you for joining our platform. We're excited to have you on board.</p>
      <p>Best regards,<br/>The Team</p>
    `,
  });

  if (result.success) {
    console.log('Welcome email sent:', result.messageId);
  } else {
    console.error('Failed to send welcome email:', result.error);
  }

  return result;
}

/**
 * Example 2: Send an email with multiple recipients
 */
async function sendTeamNotification(teamEmails: string[], projectName: string) {
  const result = await emailService.sendEmail({
    to: teamEmails,
    subject: `Project Update: ${projectName}`,
    html: `
      <h1>Project Update</h1>
      <p>The project "${projectName}" has been updated.</p>
    `,
    cc: 'manager@company.com',
  });

  return result;
}

/**
 * Example 3: Send an email with attachments
 */
async function sendReportWithAttachment(userEmail: string, reportData: Buffer) {
  const result = await emailService.sendEmail({
    to: userEmail,
    subject: 'Your Monthly Report',
    html: `
      <h1>Monthly Report</h1>
      <p>Please find your monthly report attached.</p>
    `,
    attachments: [
      {
        filename: 'report.pdf',
        content: reportData,
        contentType: 'application/pdf',
      },
    ],
  });

  return result;
}

/**
 * Example 4: Verify email configuration
 */
async function checkEmailConfiguration() {
  const isValid = await emailService.verifyConfiguration();
  
  if (isValid) {
    console.log('✅ Email configuration is valid');
  } else {
    console.error('❌ Email configuration is invalid');
  }

  return isValid;
}

/**
 * Example 5: Use in an API route
 */
export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    const result = await emailService.sendEmail({
      to: email,
      subject: 'Hello from our API!',
      html: `<h1>Hello, ${name}!</h1><p>This email was sent from our API.</p>`,
    });

    if (!result.success) {
      return Response.json(
        { error: 'Failed to send email', details: result.error },
        { status: 500 }
      );
    }

    return Response.json({ 
      success: true, 
      messageId: result.messageId 
    });
  } catch (error) {
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export examples for reference
export {
  sendWelcomeEmail,
  sendTeamNotification,
  sendReportWithAttachment,
  checkEmailConfiguration,
};
