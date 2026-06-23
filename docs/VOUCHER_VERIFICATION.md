# Voucher Verification System

A comprehensive voucher/redemption code verification API with fraud detection, rate limiting, and audit logging.

## Overview

The voucher verification system provides a secure endpoint for validating voucher codes before redemption. It includes multiple layers of protection against fraud and abuse.

## Features

- ✅ **Multi-layer Validation**: Checks voucher existence, status, expiration, usage limits, and eligibility
- ✅ **Fraud Detection**: Detects duplicate attempts, brute force, code enumeration, and suspicious patterns
- ✅ **Rate Limiting**: Protects against abuse with per-user, per-IP, and per-device limits
- ✅ **Audit Logging**: Tracks all verification attempts for security analysis
- ✅ **Cross-Company Protection**: Prevents users from accessing vouchers from other companies
- ✅ **Device Fingerprinting**: Tracks suspicious device patterns

## API Endpoint

### POST `/api/vouchers/verify`

Verify a voucher/redemption code.

#### Request

```json
{
  "code": "ABC123XYZ",
  "userId": "user-uuid",
  "merchantId": "merchant-uuid",  // optional
  "companyId": "company-uuid"     // optional
}
```

**Headers:**
- `Authorization`: Bearer token (required)
- `X-Device-ID`: Device identifier (optional, for fraud detection)
- `X-Forwarded-For`: Client IP (optional, for rate limiting)

#### Response

**Success (200):**
```json
{
  "success": true,
  "valid": true,
  "voucher": {
    "id": "offer-uuid",
    "title": "20% Off All Items",
    "merchant": "Test Merchant",
    "merchantId": "merchant-uuid",
    "discountValue": 20,
    "discountType": "PERCENTAGE",
    "expiresAt": "2025-12-31T23:59:59.000Z"
  }
}
```

**Validation Error (400):**
```json
{
  "success": false,
  "valid": false,
  "error": {
    "code": "VOUCHER_EXPIRED",
    "message": "Voucher has expired (expired: 2024-01-01T00:00:00.000Z)"
  }
}
```

**Fraud Detected (403):**
```json
{
  "success": false,
  "valid": false,
  "error": {
    "code": "SUSPICIOUS_ACTIVITY",
    "message": "Verification blocked due to suspicious activity"
  },
  "fraudFlags": ["DUPLICATE_ATTEMPT", "RAPID_ATTEMPTS"]
}
```

**Rate Limited (429):**
```json
{
  "success": false,
  "valid": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many verification attempts. Please try again in 45 seconds."
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Authentication required or invalid token |
| `INVALID_REQUEST` | 400 | Missing or invalid request parameters |
| `VOUCHER_NOT_FOUND` | 400 | Voucher code does not exist |
| `VOUCHER_INACTIVE` | 400 | Voucher status is not LIVE |
| `VOUCHER_EXPIRED` | 400 | Voucher end date has passed |
| `VOUCHER_NOT_STARTED` | 400 | Voucher start date is in the future |
| `VOUCHER_USAGE_LIMIT_REACHED` | 400 | Maximum redemptions reached |
| `USER_NOT_ELIGIBLE` | 400 | User not found, not active, or suspended |
| `COMPANY_NOT_ELIGIBLE` | 400 | Company not active or billing on hold |
| `MERCHANT_NOT_ELIGIBLE` | 400 | Merchant not active |
| `ALREADY_REDEEMED` | 400 | User already redeemed this voucher |
| `SUSPICIOUS_ACTIVITY` | 403 | Fraud detection triggered |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## Fraud Detection

The system monitors for the following fraud patterns:

### 1. Duplicate Attempts
**Detection:** Same user trying to redeem the same code multiple times  
**Risk Score:** 30 points  
**Action:** Block verification

### 2. Rapid Attempts
**Detection:** More than 10 verification attempts in 5 minutes  
**Risk Score:** 40 points  
**Action:** Flag as suspicious

### 3. Brute Force Attempts
**Detection:** More than 20 failed code attempts in 10 minutes  
**Risk Score:** 90 points  
**Action:** Block verification

### 4. Code Enumeration
**Detection:** Sequential or similar codes being tested (e.g., ABC123, ABC124, ABC125)  
**Risk Score:** 80 points  
**Action:** Block verification

### 5. Excessive IP Requests
**Detection:** More than 50 requests from same IP in 10 minutes  
**Risk Score:** 60 points  
**Action:** Flag as suspicious

### 6. Suspicious Device
**Detection:** More than 5 different users from same device in 10 minutes  
**Risk Score:** 70 points  
**Action:** Block verification

### 7. Cross-Company Abuse
**Detection:** User trying to use voucher from different company  
**Risk Score:** 85 points  
**Action:** Block verification

### Risk Score Threshold
- **Score < 70:** Allow verification
- **Score >= 70:** Block verification and return `SUSPICIOUS_ACTIVITY`

## Rate Limiting

The system enforces rate limits at three levels:

| Level | Limit | Window |
|-------|-------|--------|
| Per User | 10 requests | 1 minute |
| Per IP | 30 requests | 1 minute |
| Per Device | 15 requests | 1 minute |

When a limit is exceeded, the API returns `429 Too Many Requests` with a `Retry-After` header indicating when the limit resets.

## Validation Checks

The verification process performs the following checks in order:

1. **Authentication**: Verify user is authenticated
2. **Authorization**: Verify user can verify for the specified userId
3. **Rate Limiting**: Check user, IP, and device limits
4. **Fraud Detection**: Run all fraud detection checks
5. **Voucher Exists**: Verify code exists in database
6. **Voucher Active**: Verify status is `LIVE`
7. **Voucher Dates**: Verify not expired and has started
8. **Usage Limits**: Verify max redemptions not reached
9. **User Eligibility**: Verify user is active and belongs to company
10. **Company Eligibility**: Verify company is active and billing is not on hold
11. **Merchant Eligibility**: Verify merchant is active

If any check fails, the process stops and returns the appropriate error.

## Audit Logging

All verification attempts are logged to the `AuditLog` table with the following information:

```json
{
  "actorType": "EMPLOYEE",
  "action": "VOUCHER_VERIFICATION_ATTEMPT",
  "entityType": "voucher_verification",
  "entityId": "user-uuid",
  "metadata": {
    "code": "ABC123XYZ",
    "userId": "user-uuid",
    "merchantId": "merchant-uuid",
    "companyId": "company-uuid",
    "ipAddress": "192.168.1.1",
    "deviceId": "device-uuid",
    "userAgent": "Mozilla/5.0...",
    "result": "SUCCESS",
    "errorCode": null,
    "fraudFlags": [],
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

Fraud detection events are logged separately with action `VOUCHER_FRAUD_DETECTED`.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     API Endpoint                             │
│                  POST /api/vouchers/verify                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Authentication      │
         │   & Authorization     │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Rate Limiting       │
         │   (User/IP/Device)    │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Fraud Detection     │
         │   (7 checks)          │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Voucher Validation  │
         │   (11 checks)         │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Audit Logging       │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Response            │
         └───────────────────────┘
```

## File Structure

```
src/
├── app/
│   └── api/
│       └── vouchers/
│           └── verify/
│               └── route.ts              # API endpoint
├── lib/
│   ├── voucher-validation.ts             # Voucher validation service
│   ├── fraud-detection.ts                # Fraud detection service
│   └── rate-limiter.ts                   # Rate limiting service
├── types/
│   └── voucher.ts                        # TypeScript types

tests/
├── unit/
│   ├── voucher-validation.test.ts        # Validation unit tests
│   ├── fraud-detection.test.ts           # Fraud detection unit tests
│   └── rate-limiter.test.ts              # Rate limiter unit tests
└── integration/
    └── voucher-verification.test.ts      # API integration tests
```

## Usage Examples

### Basic Verification

```typescript
const response = await fetch('/api/vouchers/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    code: 'ABC123XYZ',
    userId: 'user-123',
  }),
})

const data = await response.json()

if (data.success && data.valid) {
  console.log('Voucher is valid:', data.voucher)
  // Proceed with redemption
} else {
  console.error('Voucher invalid:', data.error)
}
```

### With Device Tracking

```typescript
const response = await fetch('/api/vouchers/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Device-ID': getDeviceFingerprint(), // Client-side device ID
  },
  body: JSON.stringify({
    code: 'ABC123XYZ',
    userId: 'user-123',
    companyId: 'company-456',
  }),
})
```

### Error Handling

```typescript
const response = await fetch('/api/vouchers/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    code: 'ABC123XYZ',
    userId: 'user-123',
  }),
})

const data = await response.json()

switch (response.status) {
  case 200:
    // Success
    if (data.valid) {
      showVoucherDetails(data.voucher)
    }
    break
  
  case 400:
    // Validation error
    showErrorMessage(data.error.message)
    break
  
  case 403:
    // Fraud detected
    showSecurityWarning('Suspicious activity detected')
    logSecurityEvent(data.fraudFlags)
    break
  
  case 429:
    // Rate limited
    const retryAfter = response.headers.get('Retry-After')
    showRateLimitMessage(`Please try again in ${retryAfter} seconds`)
    break
  
  default:
    showGenericError()
}
```

## Security Considerations

### Never Expose
- Internal database IDs in error messages
- Voucher generation algorithms
- Fraud detection scoring formulas
- Detailed system architecture

### Always Validate
- User authentication before processing
- User authorization for the specified userId
- All input parameters
- Rate limits before expensive operations

### Always Log
- All verification attempts (success and failure)
- Fraud detection events
- Rate limit violations
- Authentication failures

## Testing

Run the test suite:

```bash
# Unit tests
npm test tests/unit/voucher-validation.test.ts
npm test tests/unit/fraud-detection.test.ts
npm test tests/unit/rate-limiter.test.ts

# Integration tests
npm test tests/integration/voucher-verification.test.ts

# All tests
npm test
```

## Performance

The verification endpoint is optimized for performance:

- **Parallel Database Queries**: Independent checks run in parallel
- **In-Memory Rate Limiting**: No database overhead for rate checks
- **Early Exit**: Validation stops on first failure
- **Efficient Fraud Detection**: Uses in-memory tracking for recent attempts

**Expected Response Times:**
- Successful verification: ~100-200ms
- Validation failure: ~50-100ms
- Fraud detection: ~150-250ms
- Rate limited: ~10-20ms

## Monitoring

Monitor the following metrics:

1. **Verification Success Rate**: Percentage of successful verifications
2. **Fraud Detection Rate**: Percentage of attempts flagged as fraudulent
3. **Rate Limit Violations**: Number of 429 responses
4. **Average Response Time**: Endpoint performance
5. **Error Rate**: Percentage of 500 errors

## Future Enhancements

Potential improvements for future versions:

1. **Redis Integration**: Move rate limiting and fraud tracking to Redis for distributed systems
2. **Machine Learning**: Implement ML-based fraud detection
3. **Webhook Notifications**: Notify admins of suspicious activity
4. **Dashboard**: Admin dashboard for monitoring verification attempts
5. **Blacklist/Whitelist**: IP and device blacklisting
6. **Geolocation**: Add geolocation-based fraud detection
7. **CAPTCHA**: Require CAPTCHA for suspicious requests

## Support

For issues or questions:
- Check the test files for usage examples
- Review the audit logs for debugging
- Contact the development team

## License

Internal use only.
