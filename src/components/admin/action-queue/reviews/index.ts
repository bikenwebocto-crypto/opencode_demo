import { MerchantApplicationReview, merchantApplicationEditableFields } from './MerchantApplicationReview'
import { OfferReview, offerEditableFields } from './OfferReview'
import { OfferReplacementReview, offerReplacementEditableFields } from './OfferReplacementReview'
import { CompanyActivationReview, companyActivationEditableFields } from './CompanyActivationReview'
import { IssueReview, issueEditableFields } from './IssueReview'
import { ProfileReview, profileEditableFields } from './ProfileReview'
import { RenewalAlertReview, renewalAlertEditableFields } from './RenewalAlertReview'
import { MissingPerkReview, missingPerkEditableFields } from './MissingPerkReview'
import { SetupLinkReview, setupLinkEditableFields } from './SetupLinkReview'
import type { EditableField, ReviewComponentKey } from './types'

export const REVIEW_COMPONENT_MAP: Record<ReviewComponentKey, React.ComponentType<any>> = {
  MerchantApplicationReview,
  OfferReview,
  OfferReplacementReview,
  CompanyActivationReview,
  IssueReview,
  ProfileReview,
  RenewalAlertReview,
  MissingPerkReview,
  SetupLinkReview,
}

export const EDITABLE_FIELDS_MAP: Record<ReviewComponentKey, EditableField[]> = {
  MerchantApplicationReview: merchantApplicationEditableFields,
  OfferReview: offerEditableFields,
  OfferReplacementReview: offerReplacementEditableFields,
  CompanyActivationReview: companyActivationEditableFields,
  IssueReview: issueEditableFields,
  ProfileReview: profileEditableFields,
  RenewalAlertReview: renewalAlertEditableFields,
  MissingPerkReview: missingPerkEditableFields,
  SetupLinkReview: setupLinkEditableFields,
}

export * from './types'
export { EntityNotFound } from './EntityNotFound'
export { EditFieldsForm } from './EditFieldsForm'
export { RemarksPanel } from './RemarksPanel'
export { AuditTimeline } from './AuditTimeline'
export { RejectDialog } from './RejectDialog'
