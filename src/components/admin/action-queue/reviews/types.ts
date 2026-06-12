export interface ReviewComponentProps {
  entity: any
  queueItem: any
  edits: Record<string, unknown>
  setEdits: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void
  editMode: boolean
}

export interface EditableField {
  key: string
  label: string
}

export type ReviewComponentKey =
  | 'MerchantApplicationReview'
  | 'OfferReview'
  | 'OfferReplacementReview'
  | 'CompanyActivationReview'
  | 'IssueReview'
  | 'ProfileReview'
  | 'RenewalAlertReview'
  | 'MissingPerkReview'
  | 'SetupLinkReview'
