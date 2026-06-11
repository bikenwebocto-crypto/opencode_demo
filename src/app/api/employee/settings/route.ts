import { NextRequest, NextResponse } from 'next/server'
import {
  getEmployeeFromSession,
  unauthorized,
  internalError,
} from '@/lib/employee-session'

interface EmployeePrefs {
  newOffers: boolean
  offerExpiry: boolean
  redemptionUpdates: boolean
  weeklyDigest: boolean
  marketingEmails: boolean
}

const DEFAULT_PREFS: EmployeePrefs = {
  newOffers: true,
  offerExpiry: true,
  redemptionUpdates: true,
  weeklyDigest: false,
  marketingEmails: false,
}

export async function GET() {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()
    return NextResponse.json({
      success: true,
      data: { email: employee.email, preferences: DEFAULT_PREFS },
    })
  } catch (error) {
    return internalError(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const employee = await getEmployeeFromSession()
    if (!employee) return unauthorized()
    const body = await request.json()
    const prefs: Partial<EmployeePrefs> = body?.preferences ?? {}
    const merged = { ...DEFAULT_PREFS, ...prefs }
    return NextResponse.json({
      success: true,
      data: { email: employee.email, preferences: merged },
      message: 'Preferences saved',
    })
  } catch (error) {
    return internalError(error)
  }
}
