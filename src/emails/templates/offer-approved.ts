import { renderTemplate } from '@/emails/renderer'

interface OfferApprovedData {
  merchantName: string
  offerTitle: string
  approvedDate: string
}

export function renderOfferApprovedTemplate(data: OfferApprovedData): string {
  const bodyHtml = `
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Hi ${data.merchantName},</p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 8px 0;">Your offer has been approved and is now live.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Offer</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px; text-align: right;">${data.offerTitle}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Approved On</td>
        <td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.approvedDate}</td>
      </tr>
    </table>
    <p style="color: #374151; font-size: 14px; margin: 16px 0 0 0;">Employees can now claim and redeem this offer.</p>
  `

  return renderTemplate('Offer Approved', bodyHtml)
}
