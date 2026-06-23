// POST /api/vouchers/verify
// Voucher verification endpoint with fraud detection and rate limiting

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { validateVoucher } from "@/lib/voucher-validation";
import {
  detectFraud,
  trackVerificationAttempt,
  logFraudDetection,
} from "@/lib/fraud-detection";
import { checkVoucherRateLimits } from "@/lib/rate-limiter";
import { prisma } from "@/lib/prisma";
import type {
  VoucherVerificationRequest,
  VoucherVerificationResponse,
  VoucherVerificationErrorCode,
} from "@/types/voucher";

/**
 * Extract client IP address from request
 */
function getClientIp(request: NextRequest): string | undefined {
  // Try various headers that might contain the client IP
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return undefined;
}

/**
 * Extract device ID from request (if provided)
 */
function getDeviceId(request: NextRequest): string | undefined {
  return request.headers.get("x-device-id") || undefined;
}

/**
 * Log verification attempt to audit log
 */
async function logVerificationAttempt(
  request: VoucherVerificationRequest,
  result: "SUCCESS" | "FAILED" | "FRAUD_DETECTED",
  errorCode?: VoucherVerificationErrorCode,
  fraudFlags?: string[],
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: "EMPLOYEE",
        action: "VOUCHER_VERIFICATION_ATTEMPT",
        entityType: "voucher_verification",
        entityId: request.userId,
        metadata: {
          code: request.code,
          userId: request.userId,
          merchantId: request.merchantId,
          companyId: request.companyId,
          ipAddress: request.ipAddress,
          deviceId: request.deviceId,
          userAgent: request.userAgent,
          result,
          errorCode,
          fraudFlags,
          timestamp: new Date().toISOString(),
        } as any,
      },
    });
  } catch (error) {
    console.error("Failed to log verification attempt:", error);
  }
}

/**
 * POST /api/vouchers/verify
 * Verify a voucher/redemption code
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication required",
          },
        } satisfies VoucherVerificationResponse,
        { status: 401 },
      );
    }

    // 2. Parse request body
    const body = await request.json();
    const { code } = body;

    // Validate required fields
    if (!code || typeof code !== "string") {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Voucher code is required",
          },
        } satisfies VoucherVerificationResponse,
        { status: 400 },
      );
    }

    const redemption = await prisma.redemption.findFirst({
      where: { redemptionCode: code.trim().toUpperCase() },
      select: { employeeId: true, merchantId: true, companyId: true }
    }) 

    console.log("Redemption found:", redemption);

    if (!redemption?.employeeId || typeof redemption.employeeId !== "string") {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: {
            code: "INVALID_REQUEST",
            message: "User ID is required",
          },
        } satisfies VoucherVerificationResponse,
        { status: 400 },
      );
    }
    console.log("Redemption employeeId:", redemption.employeeId);
    // Verify user is authorized to verify for this userId
    // if (user.userType === 'EMPLOYEE' && user.profileId !== userId) {
    //   return NextResponse.json(
    //     {
    //       success: false,
    //       valid: false,
    //       error: {
    //         code: 'UNAUTHORIZED',
    //         message: 'You can only verify vouchers for your own account',
    //       },
    //     } satisfies VoucherVerificationResponse,
    //     { status: 403 }
    //   )
    // }

    // 3. Extract request metadata
    const ipAddress = getClientIp(request);
    const deviceId = getDeviceId(request);
    const userAgent = request.headers.get("user-agent") || undefined;

    const verificationRequest: VoucherVerificationRequest = {
      code: code.trim().toUpperCase(), // Normalize code
      userId: redemption.employeeId,
      merchantId: redemption.merchantId,
      companyId: redemption.companyId,
      ipAddress,
      deviceId,
      userAgent,
    };
    console.log("Verification request:", verificationRequest);
    // 4. Check rate limits
    const rateLimitResult = checkVoucherRateLimits(verificationRequest.userId, ipAddress, deviceId);
    
   
    if (rateLimitResult.limited) {
      await logVerificationAttempt(
        verificationRequest,
        "FAILED",
        "RATE_LIMIT_EXCEEDED",
      );
      
      const resetSeconds = rateLimitResult.resetMs
        ? Math.ceil(rateLimitResult.resetMs / 1000)
        : 60;

      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: `Too many verification attempts. Please try again in ${resetSeconds} seconds.`,
          },
        } satisfies VoucherVerificationResponse,
        { status: 429 },
      );
    }

    // 5. Run fraud detection
    const fraudResult = await detectFraud(verificationRequest);

    if (fraudResult.isFraudulent) {
      // Log fraud detection
      await logFraudDetection(verificationRequest, fraudResult);

      // Track the attempt
      trackVerificationAttempt({
        code: verificationRequest.code,
        userId: verificationRequest.userId,
        companyId: verificationRequest.companyId,
        ipAddress: verificationRequest.ipAddress,
        deviceId: verificationRequest.deviceId,
        result: "FRAUD_DETECTED",
        timestamp: new Date(),
      });

      // Log to audit
      await logVerificationAttempt(
        verificationRequest,
        "FRAUD_DETECTED",
        "SUSPICIOUS_ACTIVITY",
        fraudResult.flags,
      );

      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: {
            code: "SUSPICIOUS_ACTIVITY",
            message: "Verification blocked due to suspicious activity",
          },
          fraudFlags: fraudResult.flags,
        } satisfies VoucherVerificationResponse,
        { status: 403 },
      );
    }

    // 6. Validate voucher
    const validationResult = await validateVoucher(
      verificationRequest.code,
      verificationRequest.userId,
      verificationRequest.merchantId,
      verificationRequest.companyId,
    );

    // 7. Track the attempt
    trackVerificationAttempt({
      code: verificationRequest.code,
      userId: verificationRequest.userId,
      companyId: verificationRequest.companyId,
      ipAddress: verificationRequest.ipAddress,
      deviceId: verificationRequest.deviceId,
      result: validationResult.valid ? "SUCCESS" : "FAILED",
      timestamp: new Date(),
    });
    console.log("Validation result:", validationResult.valid);
    // 8. Log the attempt
    await logVerificationAttempt(
      verificationRequest,
      validationResult.valid ? "SUCCESS" : "FAILED",
      validationResult.errorCode,
    );
    console.log("Validation result:", validationResult);
    // 9. Return response
    if (!validationResult.valid) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: {
            code: validationResult.errorCode!,
            message: validationResult.errorMessage!,
          },
        } satisfies VoucherVerificationResponse,
        { status: 400 },
      );
    }

    // Success!
    return NextResponse.json(
      {
        success: true,
        valid: true,
        voucher: validationResult.voucher!,
      } satisfies VoucherVerificationResponse,
      { status: 200 },
    );
  } catch (error) {
    console.error("Voucher verification error:", error);

    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred during verification",
        },
      },
      { status: 500 },
    );
  }
}
