import type { RedemptionEmployeeEmailData } from '@/emails/types'
import { renderTemplate } from '@/emails/renderer'

export function renderRedemptionSuccessEmployeeTemplate(
  data: RedemptionEmployeeEmailData
): string {
  const bodyHtml = `
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Hi ${data.employeeFirstName},</p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Your reward has been successfully redeemed.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Reward</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px; text-align: right;">${data.offerTitle}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Merchant</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px; text-align: right;">${data.merchantName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Redeemed On</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px; text-align: right;">${data.redeemedDate}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Redemption Code</td>
        <td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right; font-family: monospace;">${data.redemptionCode}</td>
      </tr>
    </table>
    <p style="color: #374151; font-size: 14px; margin: 16px 0 0 0;">Thank you for using the platform.</p>
  `

  return renderTemplate('Your Reward Has Been Redeemed', bodyHtml)
}
