import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/server'
import { createAuditLog, fromCurrentUser } from '@/services/audit-log.service'
import { forbidden } from '@/lib/api-auth'
import { buildPreview, parseCsvBody, validateRows, type ValidRow } from '@/lib/company-activation/employee-csv'

function unauthorized() {
  return NextResponse.json(
    { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
    { status: 401 }
  )
}
function notFound(message = 'Company not found') {
  return NextResponse.json(
    { success: false, error: { code: 'NOT_FOUND', message } },
    { status: 404 }
  )
}
function badRequest(message: string) {
  return NextResponse.json(
    { success: false, error: { code: 'VALIDATION', message } },
    { status: 400 }
  )
}
function internalError(error: unknown) {
  console.error('CSV confirm error:', error)
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL', message: 'Internal server error' } },
    { status: 500 }
  )
}

interface ConfirmBody {
  csv?: string
  bodyHash?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) return unauthorized()
    if (user.userType !== 'admin') return forbidden(user.userType)

    const { id } = await params
    const company = await prisma.company.findUnique({ where: { id }, select: { id: true, deletedAt: true } })
    if (!company || company.deletedAt) return notFound()

    const body = (await request.json().catch(() => ({}))) as ConfirmBody
    const csv = body.csv
    const bodyHash = body.bodyHash
    if (!csv) return badRequest('csv body is required')
    if (!bodyHash) return badRequest('bodyHash is required (must match the preview)')

    // Re-validate against current DB state. Refuse if the previously
    // emitted bodyHash does not match the current body — this prevents
    // an admin from confirming a stale preview after another admin
    // already added/removed employees.
    const preview = await buildPreview(csv, id)
    if (preview.bodyHash !== bodyHash) {
      return badRequest('CSV body has changed since preview. Re-run the preview.')
    }
    if (preview.validCount === 0) {
      return badRequest('No valid rows to import. Fix the invalid rows and retry.')
    }

    // Re-parse + re-validate to get the fresh valid set. The buildPreview
    // call above already did this but did not return the full rows
    // for re-derivation; we re-run to get the typed rows.
    const rows = await parseCsvBody(csv)
    const existingEmployees = await prisma.employee.findMany({
      where: { companyId: id, deletedAt: null },
      select: { accountId: true },
    })
    const existingAccountIds = existingEmployees.map((e) => e.accountId).filter(Boolean) as string[]
    const existingAccounts = existingAccountIds.length > 0
      ? await prisma.account.findMany({ where: { authUserId: { in: existingAccountIds } }, select: { email: true } })
      : []
    const existingEmails = new Set(
      existingAccounts.map((e) => e.email?.toLowerCase()).filter((e): e is string => !!e)
    )
    const { valid } = await validateRows(rows, { companyId: id, existingEmails })

    if (valid.length === 0) {
      return badRequest('No valid rows to import.')
    }

    // Create the CSVUploadJob audit row.
    const uploadJob = await prisma.cSVUploadJob.create({
      data: {
        companyId: id,
        adminId: user.id,
        fileName: 'employee-import.csv',
        fileUrl: 'inline://employee-import',
        fileSize: csv.length,
        totalRows: preview.totalRows,
        processedRows: preview.totalRows,
        successCount: valid.length,
        errorCount: preview.invalidCount,
        status: 'COMPLETED',
        completedAt: new Date(),
        metadata: { bodyHash },
      },
    })

    for (const v of valid) {
      const pkId = crypto.randomUUID()

      await prisma.account.create({
        data: {
          authUserId: pkId,
          email: v.email,
          role: 'EMPLOYEE',
          profileType: 'EMPLOYEE',
          status: 'PENDING',
        },
      })

      await prisma.employee.create({
        data: {
          id: pkId,
          accountId: pkId,
          companyId: id,
          firstName: v.firstName,
          lastName: v.lastName,
          department: v.department,
          jobTitle: v.jobTitle,
          status: 'INVITED',
          joinMethod: 'csv_import',
          invitedAt: new Date(),
          invitedBy: user.id,
        },
      })
    }

    // Record rejected rows in CSVRejectedRow for the audit trail.
    for (const r of preview.invalidRows) {
      await prisma.cSVRejectedRow.create({
        data: {
          csvUploadId: uploadJob.id,
          rowNumber: r.rowNumber,
          reason: r.reason,
          rowData: r.raw as any,
        },
      })
    }

    await createAuditLog(fromCurrentUser(user, 'EMPLOYEE_CSV_IMPORTED', 'company', id, {
      metadata: { total: preview.totalRows, imported: valid.length, rejected: preview.invalidCount },
    }))

    return NextResponse.json({
      success: true,
      data: {
        jobId: uploadJob.id,
        imported: valid.length,
        rejected: preview.invalidCount,
      },
      message: `Imported ${valid.length} employees. ${preview.invalidCount} rejected.`,
    })
  } catch (error) {
    return internalError(error)
  }
}
