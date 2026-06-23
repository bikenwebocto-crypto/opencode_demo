import nodemailer from 'nodemailer';

/**
 * Email configuration from environment variables
 */
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

/**
 * Email sending options
 */
interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

/**
 * Email sending result
 */
interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Get email configuration from environment variables
 */
function getEmailConfig(): EmailConfig {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port || !user || !pass) {
    throw new Error(
      'Email configuration missing. Required environment variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS'
    );
  }

  return {
    host,
    port: parseInt(port, 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user,
      pass,
    },
  };
}

/**
 * Create nodemailer transporter
 */
function createTransporter() {
  const config = getEmailConfig();
  
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
}

/**
 * Send an email
 * 
 * @param options - Email sending options
 * @returns Promise with send result
 * 
 * @example
 * ```typescript
 * const result = await emailService.sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Welcome!',
 *   html: '<h1>Welcome to our platform</h1>',
 * });
 * 
 * if (result.success) {
 *   console.log('Email sent:', result.messageId);
 * } else {
 *   console.error('Failed to send email:', result.error);
 * }
 * ```
 */
async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    const transporter = createTransporter();
    
    const from = options.from || process.env.SMTP_FROM || process.env.SMTP_USER;
    
    if (!from) {
      throw new Error('From address not specified. Set SMTP_FROM or SMTP_USER environment variable.');
    }

    const mailOptions = {
      from,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
      bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
      replyTo: options.replyTo,
      attachments: options.attachments,
    };

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Email sending failed:', errorMessage);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Verify email configuration
 * 
 * @returns Promise with verification result
 */
async function verifyConfiguration(): Promise<boolean> {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('Email configuration verification failed:', error);
    return false;
  }
}

/**
 * Email service object
 */
export const emailService = {
  sendEmail,
  verifyConfiguration,
};

export type { SendEmailOptions, SendEmailResult, EmailConfig };
