'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import {
  BRANCH_TYPE_OPTIONS,
  BRANCH_STATUS_OPTIONS,
  DAYS_OF_WEEK,
  DEFAULT_OPENING_HOURS,
  type BranchOpeningHour,
} from '@/lib/branch-helpers'
import type { BranchStatus, BranchType } from '@/types'
import { Building2, Globe, Save, MapPin, Clock, Accessibility, ImageIcon, Info, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
export interface BranchFormValues {
  name: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
  phone: string
  email: string
  latitude: number | null
  longitude: number | null
  openingHours: BranchOpeningHour[]
  isPrimary: boolean
  branchType: BranchType
  deliveryRadiusKm: number | null
  isNationwide: boolean
  storefrontImageUrl: string
  branchImages: string[]
  parkingInfo: string
  wheelchairAccess: boolean
  landmark: string
  description: string
  status: BranchStatus
}

export const EMPTY_BRANCH: BranchFormValues = {
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  phone: '',
  email: '',
  latitude: null,
  longitude: null,
  openingHours: DEFAULT_OPENING_HOURS,
  isPrimary: false,
  branchType: 'IN_STORE',
  deliveryRadiusKm: null,
  isNationwide: false,
  storefrontImageUrl: '',
  branchImages: [],
  parkingInfo: '',
  wheelchairAccess: false,
  landmark: '',
  description: '',
  status: 'ACTIVE',
}

interface BranchFormProps {
  initialValues?: Partial<BranchFormValues>
  errors?: Record<string, string>
  submitting?: boolean
  isEdit?: boolean
  onSubmit: (values: BranchFormValues) => void
  onCancel: () => void
}

function updateOpeningHour(
  hours: BranchOpeningHour[],
  day: BranchOpeningHour['day'],
  patch: Partial<BranchOpeningHour>
): BranchOpeningHour[] {
  return hours.map((h) => (h.day === day ? { ...h, ...patch } : h))
}

export function BranchForm({ initialValues, errors = {}, submitting, isEdit, onSubmit, onCancel }: BranchFormProps) {
  const [values, setValues] = useState<BranchFormValues>({
    ...EMPTY_BRANCH,
    ...initialValues,
    openingHours: initialValues?.openingHours ?? DEFAULT_OPENING_HOURS,
  })

  useEffect(() => {
    if (initialValues) {
      setValues((prev) => ({
        ...prev,
        ...initialValues,
        openingHours: initialValues.openingHours ?? prev.openingHours,
      }))
    }
  }, [initialValues])

  function setField<K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(values)
  }

  const [verificationStatus, setVerificationStatus] = useState<'IDLE' | 'VERIFIED' | 'FAILED'>('IDLE')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [addressConfirmed, setAddressConfirmed] = useState(false)

  const isOnline = values.branchType === 'ONLINE'
  const isDelivery = isOnline && (values.isNationwide || (values.deliveryRadiusKm ?? 0) > 0)
  const needsAddress = !isOnline || isDelivery

  async function handleVerifyAddress() {
    const parts = [values.addressLine1, values.city, values.state, values.postalCode, values.country]
      .filter(Boolean)
      .join(', ')
    if (!parts) {
      setVerifyError('Please fill in the address fields first.')
      return
    }
    setVerifying(true)
    setVerifyError(null)
    setVerificationStatus('IDLE')
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(parts)}&format=jsonv2&limit=1`,
        { headers: { 'Accept-Language': 'en' } }
      )
      if (!res.ok) throw new Error('Nominatim service unavailable')
      const data = await res.json()
      if (!data || data.length === 0) {
        setVerificationStatus('FAILED')
        setVerifyError('Unable to verify this address. Please check address details.')
        return
      }
      const result = data[0]
      setValues((prev) => ({
        ...prev,
        latitude: Number(Number(result.lat).toFixed(7)),
        longitude: Number(Number(result.lon).toFixed(7)),
      }))
      setVerificationStatus('VERIFIED')
    } catch (err: any) {
      setVerificationStatus('FAILED')
      setVerifyError(err?.message ?? 'Network error. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  async function handleReVerify() {
    setVerificationStatus('IDLE')
    setAddressConfirmed(false)
    setVerifyError(null)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" /> Branch Type
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {BRANCH_TYPE_OPTIONS.map((opt) => {
              const active = values.branchType === opt.value
              return (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer flex-col gap-1 rounded-md border p-3 transition-colors ${
                    active ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="branchType"
                      value={opt.value}
                      checked={active}
                      disabled={isEdit && opt.value === 'ONLINE' && initialValues?.branchType !== 'ONLINE'}
                      onChange={() => setField('branchType', opt.value)}
                      className="h-4 w-4"
                    />
                    <span className="font-medium">{opt.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </label>
              )
            })}
          </div>
          {errors.branchType && <p className="text-xs text-destructive">{errors.branchType}</p>}

          {isOnline && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <Globe className="mt-0.5 h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Configure how employees can use this online branch. Choose delivery to serve a local area, or pure digital for an online-only store.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={values.isNationwide}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setValues((prev) => ({
                      ...prev,
                      isNationwide: checked,
                      deliveryRadiusKm: checked ? prev.deliveryRadiusKm ?? 0 : prev.deliveryRadiusKm,
                    }))
                  }}
                />
                <span>Ships nationwide</span>
              </label>
              {!values.isNationwide && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Delivery radius (km)
                  </label>
                  <Input
                    type="number"
                    min={0}
                    max={5000}
                    value={values.deliveryRadiusKm ?? ''}
                    onChange={(e) => setField('deliveryRadiusKm', e.target.value === '' ? null : Number(e.target.value))}
                    placeholder="e.g. 25"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Employees within this radius can redeem offers from this branch.
                  </p>
                  {errors.deliveryRadiusKm && <p className="mt-1 text-xs text-destructive">{errors.deliveryRadiusKm}</p>}
                </div>
              )}
              {!isDelivery && (
                <p className="rounded-md bg-blue-50 p-2 text-xs text-blue-900 dark:bg-blue-900/20 dark:text-blue-300">
                  Pure digital merchant: no physical address or coordinates required.
                </p>
              )}
              {isDelivery && (
                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">
                    Delivery merchants still need a base address to compute distances and validate coverage.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Info className="h-5 w-5" /> Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Branch Name *</label>
            <Input
              value={values.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. Downtown Flagship"
            />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
          </div>

          {needsAddress && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Address Line 1 *</label>
                <Input
                  value={values.addressLine1}
                  onChange={(e) => {
                    setField('addressLine1', e.target.value)
                    if (verificationStatus === 'VERIFIED') setVerificationStatus('IDLE')
                  }}
                  placeholder="Street address"
                />
                {errors.addressLine1 && <p className="mt-1 text-xs text-destructive">{errors.addressLine1}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Address Line 2</label>
                <Input
                  value={values.addressLine2}
                  onChange={(e) => setField('addressLine2', e.target.value)}
                  placeholder="Suite, unit, etc."
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">City *</label>
                  <Input
                    value={values.city}
                    onChange={(e) => {
                      setField('city', e.target.value)
                      if (verificationStatus === 'VERIFIED') setVerificationStatus('IDLE')
                    }}
                  />
                  {errors.city && <p className="mt-1 text-xs text-destructive">{errors.city}</p>}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">State / Province</label>
                  <Input
                    value={values.state}
                    onChange={(e) => {
                      setField('state', e.target.value)
                      if (verificationStatus === 'VERIFIED') setVerificationStatus('IDLE')
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Postal Code</label>
                  <Input
                    value={values.postalCode}
                    onChange={(e) => {
                      setField('postalCode', e.target.value)
                      if (verificationStatus === 'VERIFIED') setVerificationStatus('IDLE')
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Country *</label>
                <Input
                  value={values.country}
                  onChange={(e) => {
                    setField('country', e.target.value)
                    if (verificationStatus === 'VERIFIED') setVerificationStatus('IDLE')
                  }}
                  placeholder="e.g. United States"
                />
                {errors.country && <p className="mt-1 text-xs text-destructive">{errors.country}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={verificationStatus === 'VERIFIED' ? handleReVerify : handleVerifyAddress}
                  disabled={verifying || submitting}
                >
                  {verifying ? 'Verifying…' : verificationStatus === 'VERIFIED' ? 'Re-verify Address' : 'Verify Address'}
                </Button>
                {verificationStatus === 'VERIFIED' && (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle className="h-3 w-3" /> Address verified successfully.
                  </span>
                )}
              </div>
              {verifyError && (
                <p className="text-xs text-destructive">{verifyError}</p>
              )}
            </>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Phone</label>
              <Input value={values.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+1 555-0100" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label>
              <Input
                type="email"
                value={values.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="branch@example.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {needsAddress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5" /> Location Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">Status:</span>
              {verificationStatus === 'VERIFIED' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <CheckCircle className="h-3 w-3" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                  <XCircle className="h-3 w-3" /> Not Verified
                </span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Latitude *</label>
                <Input
                  type="number"
                  step="0.000001"
                  value={values.latitude ?? ''}
                  readOnly
                  className="bg-muted/30"
                />
                {errors.latitude && <p className="mt-1 text-xs text-destructive">{errors.latitude}</p>}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Longitude *</label>
                <Input
                  type="number"
                  step="0.000001"
                  value={values.longitude ?? ''}
                  readOnly
                  className="bg-muted/30"
                />
                {errors.longitude && <p className="mt-1 text-xs text-destructive">{errors.longitude}</p>}
              </div>
            </div>

            {verificationStatus === 'VERIFIED' && values.latitude != null && values.longitude != null && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${values.latitude},${values.longitude}`,
                    '_blank'
                  )
                }
              >
                <ExternalLink className="mr-1 h-3 w-3" /> Open In Google Maps
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" /> Opening Hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {values.openingHours.map((h) => (
            <div key={h.day} className="grid grid-cols-[100px_1fr_1fr_auto] items-center gap-2 text-sm">
              <span className="font-medium">{h.day.charAt(0) + h.day.slice(1).toLowerCase()}</span>
              <Input
                type="time"
                value={h.open}
                disabled={h.closed}
                onChange={(e) => setField('openingHours', updateOpeningHour(values.openingHours, h.day, { open: e.target.value }))}
                className="h-9"
              />
              <Input
                type="time"
                value={h.close}
                disabled={h.closed}
                onChange={(e) => setField('openingHours', updateOpeningHour(values.openingHours, h.day, { close: e.target.value }))}
                className="h-9"
              />
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={!!h.closed}
                  onChange={(e) =>
                    setField(
                      'openingHours',
                      updateOpeningHour(values.openingHours, h.day, { closed: e.target.checked })
                    )
                  }
                />
                Closed
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Accessibility className="h-5 w-5" /> Storefront Details (optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={values.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Short description for employees…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Landmark</label>
            <Input
              value={values.landmark}
              onChange={(e) => setField('landmark', e.target.value)}
              placeholder="e.g. Next to Central Park, opposite the mall"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Parking Info</label>
            <Input
              value={values.parkingInfo}
              onChange={(e) => setField('parkingInfo', e.target.value)}
              placeholder="e.g. Free parking lot behind building"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.wheelchairAccess}
              onChange={(e) => setField('wheelchairAccess', e.target.checked)}
            />
            <span>Wheelchair accessible</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="h-5 w-5" /> Images (optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Storefront Image URL</label>
            <Input
              value={values.storefrontImageUrl}
              onChange={(e) => setField('storefrontImageUrl', e.target.value)}
              placeholder="https://…"
            />
            {values.storefrontImageUrl && (
              <img
                src={values.storefrontImageUrl}
                alt="Storefront preview"
                className="mt-2 h-32 w-full rounded-md object-cover"
              />
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Branch Image URLs (one per line)</label>
            <textarea
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={values.branchImages.join('\n')}
              onChange={(e) =>
                setField(
                  'branchImages',
                  e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
              placeholder="https://…&#10;https://…"
            />
          </div>
        </CardContent>
      </Card>

      {isEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status &amp; Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={values.status}
                onChange={(e) => setField('status', e.target.value as BranchStatus)}
              >
                {BRANCH_STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label} — {s.description}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={values.isPrimary}
                onChange={(e) => setField('isPrimary', e.target.checked)}
              />
              <span>Set as primary branch for this merchant</span>
            </label>
          </CardContent>
        </Card>
      )}

      {!isEdit && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.isPrimary}
            onChange={(e) => setField('isPrimary', e.target.checked)}
          />
          <span>Set as primary branch for this merchant</span>
        </label>
      )}

      {needsAddress && verificationStatus === 'VERIFIED' && (
        <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
          <input
            type="checkbox"
            checked={addressConfirmed}
            onChange={(e) => setAddressConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>I confirm this branch location is correct.</span>
        </label>
      )}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 sm:-mx-6 sm:px-6">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting || (needsAddress && !addressConfirmed) || (needsAddress && verificationStatus !== 'VERIFIED')}
          title={
            needsAddress && verificationStatus !== 'VERIFIED'
              ? 'Please verify the address first.'
              : needsAddress && !addressConfirmed
              ? 'Please confirm the branch location.'
              : undefined
          }
        >
          <Save className="mr-1 h-4 w-4" />
          {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Branch'}
        </Button>
      </div>

      {needsAddress && (verificationStatus !== 'VERIFIED' || !addressConfirmed) && (
        <p className="text-xs text-destructive">
          Please verify and confirm the branch location.
        </p>
      )}
    </form>
  )
}

export function valuesToPayload(v: BranchFormValues) {
  return {
    name: v.name.trim(),
    addressLine1: v.addressLine1.trim(),
    addressLine2: v.addressLine2.trim() || null,
    city: v.city.trim(),
    state: v.state.trim() || null,
    postalCode: v.postalCode.trim(),
    country: v.country.trim(),
    phone: v.phone.trim() || null,
    email: v.email.trim() || null,
    latitude: v.latitude,
    longitude: v.longitude,
    openingHours: v.openingHours,
    isPrimary: v.isPrimary,
    branchType: v.branchType,
    deliveryRadiusKm: v.branchType === 'ONLINE' ? v.deliveryRadiusKm : null,
    isNationwide: v.branchType === 'ONLINE' ? v.isNationwide : false,
    storefrontImageUrl: v.storefrontImageUrl.trim() || null,
    branchImages: v.branchImages,
    parkingInfo: v.parkingInfo.trim() || null,
    wheelchairAccess: v.wheelchairAccess,
    landmark: v.landmark.trim() || null,
    description: v.description.trim() || null,
    status: v.status,
  }
}
