import type { RedemptionMerchantEmailData } from '@/emails/types'
import { renderTemplate } from '@/emails/renderer'

export function renderRedemptionSuccessMerchantTemplate(
  data: RedemptionMerchantEmailData
): string {
  const bodyHtml = `
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Hi ${data.merchantName},</p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">A reward redemption has been successfully processed.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Employee</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px; text-align: right;">${data.employeeName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Company</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px; text-align: right;">${data.companyName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Reward</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px; text-align: right;">${data.offerTitle}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Redemption Code</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px; text-align: right; font-family: monospace;">${data.redemptionCode}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Redeemed On</td>
        <td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.redeemedDate}</td>
      </tr>
    </table>
    <p style="color: #374151; font-size: 14px; margin: 16px 0 0 0;">This redemption has been recorded successfully.</p>
  `

  return renderTemplate('Reward Redemption Completed', bodyHtml)
}
