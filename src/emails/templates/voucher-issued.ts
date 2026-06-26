import { renderTemplate } from '@/emails/renderer'

interface VoucherIssuedData {
  employeeFirstName: string
  offerTitle: string
  merchantName: string
  redemptionCode: string
  issuedDate: string
}

export function renderVoucherIssuedTemplate(data: VoucherIssuedData): string {
  const bodyHtml = `
    <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Hi ${data.employeeFirstName},</p>
    <p style="color: #374151; font-size: 14px; margin: 0 0 8px 0;">A new voucher has been issued to you.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0;">
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Offer</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px; text-align: right;">${data.offerTitle}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Merchant</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px; text-align: right;">${data.merchantName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">Code</td>
        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; font-weight: 600; font-size: 14px; text-align: right; font-family: monospace;">${data.redemptionCode}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Issued On</td>
        <td style="padding: 8px 0; font-weight: 600; font-size: 14px; text-align: right;">${data.issuedDate}</td>
      </tr>
    </table>
    <p style="color: #374151; font-size: 14px; margin: 16px 0 0 0;">Present this code at the merchant to redeem your reward.</p>
  `

  return renderTemplate('Voucher Issued', bodyHtml)
}
