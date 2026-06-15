import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { ActionQueueStatus, ActionQueueType } from '@prisma/client'

// Map categories to your actual Prisma enum values
const CATEGORY_TO_QUEUE_TYPE = {
  merchantApplications: 'MERCHANT_APPROVAL',
  offerApprovals: 'OFFER_APPROVAL',
  offerReplacements: 'OFFER_REPLACEMENT',
  profileChanges: 'PROFILE_EDIT_REQUEST',
  companyActivations: 'COMPANY_APPROVAL',
  setupLinks: 'SETUP_LINK_EXPIRED', // You may need to add this to your enum
  openIssues: 'ISSUE_REVIEW',
  renewalAlerts: 'RENEWAL_GAMING_ALERT', // You may need to add this to your enum
  missingPerks: 'MERCHANT_MISSING_PERK', // You may need to add this to your enum
} as const

// If setupLinks, renewalAlerts, missingPerks don't exist in your enum,
// you need to either:
// 1. Add them to your Prisma schema, or
// 2. Map them to existing enum values temporarily

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.userType !== 'admin') return unauthorized()

    console.log('=== ACTION QUEUE STATS ===')
    
    // Get all pending items with their types
    const allPendingItems = await prisma.actionQueueItem.findMany({
      where: { status: 'PENDING' },
      select: {
        id: true,
        status: true,
        type: true, // This is the ActionQueueType enum field
        metadata: true,
        createdAt: true,
      },
    })
    
    console.log(`Total pending items: ${allPendingItems.length}`)
    
    // Count by type
    const merchantApplications = allPendingItems.filter(i => i.type === 'MERCHANT_APPROVAL').length
    const offerApprovals = allPendingItems.filter(i => i.type === 'OFFER_APPROVAL').length
    const offerReplacements = allPendingItems.filter(i => i.type === 'OFFER_REPLACEMENT').length
    const profileChanges = allPendingItems.filter(i => i.type === 'PROFILE_EDIT_REQUEST').length
    const companyActivations = allPendingItems.filter(i => i.type === 'COMPANY_APPROVAL').length
    const openIssues = allPendingItems.filter(i => i.type === 'ISSUE_REVIEW').length
    
    // For types that don't exist in your enum yet
    const setupLinks = 0 // Add to enum or map to something else
    const renewalAlerts = 0 // Add to enum or map to something else
    const missingPerks = 0 // Add to enum or map to something else
    
    // Get counts by status
    const [totalPending, totalInProgress, totalCompleted, totalFailed, totalSkipped] = await Promise.all([
      prisma.actionQueueItem.count({ where: { status: 'PENDING' } }),
      prisma.actionQueueItem.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.actionQueueItem.count({ where: { status: 'COMPLETED' } }),
      prisma.actionQueueItem.count({ where: { status: 'FAILED' } }),
      prisma.actionQueueItem.count({ where: { status: 'SKIPPED' } }),
    ])
    
    console.log('Counts:', {
      merchantApplications,
      offerApprovals,
      offerReplacements,
      profileChanges,
      companyActivations,
      openIssues,
      totalPending,
    })
    
    const totalOfferApprovals = offerApprovals + offerReplacements + profileChanges
    const totalAlerts = renewalAlerts + missingPerks
    
    return NextResponse.json({
      success: true,
      data: {
        merchantApplications,
        offerApprovals,
        offerReplacements,
        profileChanges,
        companyActivations,
        openIssues,
        renewalAlerts,
        missingPerks,
        totalOfferApprovals,
        totalAlerts,
        totalPending,
        totalInProgress,
        totalCompleted,
        totalFailed,
        totalSkipped,
        byTab: {
          ALL: totalPending + totalInProgress,
          MERCHANT_APPROVAL: merchantApplications,
          OFFER_APPROVALS: totalOfferApprovals,
          COMPANY_ACTIVATION: companyActivations,
          ISSUES: openIssues,
          ALERTS: totalAlerts,
        },
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function unauthorized() {
  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 }
  )
}