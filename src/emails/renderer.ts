export function renderTemplate(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 32px 32px 16px 32px; text-align: center;">
              <h1 style="color: #16a34a; font-size: 24px; margin: 0;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">Regards,<br/>Support Team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
