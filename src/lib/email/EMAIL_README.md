# Email Service

A reusable email service built on top of `nodemailer` for sending emails throughout the application.

## Features

- ✅ TypeScript support with full type definitions
- ✅ SMTP configuration via environment variables
- ✅ Support for multiple recipients (to, cc, bcc)
- ✅ HTML email support
- ✅ Attachment support
- ✅ Error handling and result reporting
- ✅ Configuration verification

## Setup

### 1. Environment Variables

Add the following to your `.env` file:

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
```

**Note:** For Gmail, you'll need to use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password.

### 2. Verify Configuration

```typescript
import { emailService } from '@/lib/email';

const isValid = await emailService.verifyConfiguration();
console.log('Email config valid:', isValid);
```

## Usage

### Basic Email

```typescript
import { emailService } from '@/lib/email';

const result = await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: '<h1>Welcome to our platform</h1>',
});

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Failed:', result.error);
}
```

### Multiple Recipients

```typescript
await emailService.sendEmail({
  to: ['user1@example.com', 'user2@example.com'],
  cc: 'manager@example.com',
  bcc: 'archive@example.com',
  subject: 'Team Update',
  html: '<p>Important team update...</p>',
});
```

### With Attachments

```typescript
await emailService.sendEmail({
  to: 'user@example.com',
  subject: 'Your Report',
  html: '<p>Please find your report attached.</p>',
  attachments: [
    {
      filename: 'report.pdf',
      content: pdfBuffer,
      contentType: 'application/pdf',
    },
  ],
});
```

### Custom From Address

```typescript
await emailService.sendEmail({
  from: 'support@yourdomain.com',
  to: 'user@example.com',
  subject: 'Support Ticket',
  html: '<p>Your ticket has been received.</p>',
});
```

## API Reference

### `emailService.sendEmail(options)`

Send an email with the specified options.

**Parameters:**

```typescript
interface SendEmailOptions {
  to: string | string[];           // Recipient email(s)
  subject: string;                  // Email subject
  html: string;                     // HTML content
  from?: string;                    // Sender email (optional)
  cc?: string | string[];          // CC recipients (optional)
  bcc?: string | string[];         // BCC recipients (optional)
  replyTo?: string;                // Reply-to address (optional)
  attachments?: Array<{            // Attachments (optional)
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}
```

**Returns:**

```typescript
interface SendEmailResult {
  success: boolean;      // Whether email was sent successfully
  messageId?: string;    // Message ID if successful
  error?: string;        // Error message if failed
}
```

### `emailService.verifyConfiguration()`

Verify that the SMTP configuration is valid.

**Returns:** `Promise<boolean>`

## Error Handling

The service catches errors and returns them in the result object:

```typescript
const result = await emailService.sendEmail({ ... });

if (!result.success) {
  // Handle error
  console.error('Email failed:', result.error);
  
  // Optionally retry or notify admin
  await notifyAdmin('Email service error', result.error);
}
```

## Common SMTP Providers

### Gmail
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### SendGrid
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

### Mailgun
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@yourdomain.com
SMTP_PASS=your-mailgun-password
```

### Outlook/Office 365
```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@outlook.com
SMTP_PASS=your-password
```

## Testing

In development/test environments, you can use [Ethereal Email](https://ethereal.email/) for testing:

```bash
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-test-user@ethereal.email
SMTP_PASS=your-test-password
```

Ethereal provides a fake SMTP service that captures emails for testing purposes.

## Best Practices

1. **Always check the result** - Don't assume emails were sent successfully
2. **Use HTML emails** - The service is optimized for HTML content
3. **Set a proper FROM address** - Use a domain you control
4. **Handle errors gracefully** - Log errors and notify admins if needed
5. **Use environment variables** - Never hardcode credentials
6. **Test in development** - Use Ethereal or similar for testing
7. **Monitor delivery** - Track success rates and errors

## Troubleshooting

### "Email configuration missing"
Ensure all required environment variables are set in your `.env` file.

### "Connection refused" or "Timeout"
- Check SMTP_HOST and SMTP_PORT are correct
- Verify your network allows outbound SMTP connections
- Some cloud providers block SMTP ports - check your provider's documentation

### "Authentication failed"
- Verify SMTP_USER and SMTP_PASS are correct
- For Gmail, ensure you're using an App Password, not your regular password
- Check if your email provider requires 2FA or app-specific passwords

### Emails not being delivered
- Check spam folders
- Verify your FROM address is properly configured
- Ensure your domain has proper SPF/DKIM records
- Check email provider logs for delivery issues

## Examples

See `src/lib/email.examples.ts` for complete usage examples.
