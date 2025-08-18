# Upload Completion Error Handling and Logging

This document describes the comprehensive error handling and logging implementation for the upload completion workflow.

## Overview

The upload completion workflow has been enhanced with structured error handling, detailed logging, and fallback mechanisms to ensure robust operation and easy troubleshooting.

## Key Features

### 1. Structured Error Handling

- **Consistent Error Types**: All errors are categorized with specific error codes and messages
- **Context Preservation**: Errors include relevant context like user ID, workspace ID, and operation details
- **Retryable Error Detection**: System can identify which errors are temporary and retryable

### 2. Comprehensive Logging

- **Operation Tracking**: Each upload completion gets a unique operation ID for tracing
- **Performance Monitoring**: Duration tracking for database transactions and SQS operations
- **Structured Logs**: All logs include consistent metadata for easy filtering and analysis

### 3. Transaction Safety

- **Atomic Operations**: Database operations are wrapped in transactions with proper rollback
- **Timeout Configuration**: Transactions have configurable timeouts to prevent hanging
- **Partial Failure Handling**: SQS failures don't rollback successful database operations

### 4. SQS Fallback Behavior

- **Graceful Degradation**: Upload processing continues even if SQS is unavailable
- **Job Status Tracking**: Failed SQS operations are recorded in job status
- **Retry Logic**: Retryable SQS errors are identified for potential retry mechanisms

## Error Categories

### Validation Errors (400 Bad Request)

```typescript
// User ID mismatch
{
  code: 'USER_MISMATCH',
  message: 'User ID does not match authenticated user',
  context: { providedUserId: '...', authenticatedUserId: '...' }
}

// Missing required fields
{
  code: 'MISSING_REQUIRED_FIELDS',
  message: 'Missing required fields in processing message: jobId',
  context: { missingFields: ['jobId'] }
}

// Invalid S3 key format
{
  code: 'INVALID_S3_KEY_FORMAT',
  message: 'Invalid S3 key format: invalid key with spaces!',
  context: { s3Key: 'invalid key with spaces!' }
}
```

### Authorization Errors (403 Forbidden)

```typescript
// Workspace access denied
{
  code: 'WORKSPACE_ACCESS_DENIED',
  message: 'Access denied to workspace',
  context: {
    workspaceId: '...',
    workspaceOwnerId: '...',
    workspaceOwnerType: 0,
    userRole: 2,
    userCompanyId: '...'
  }
}
```

### Database Errors (500 Internal Server Error)

```typescript
// Transaction failure
{
  code: 'DATABASE_TRANSACTION_FAILED',
  message: 'Database operation failed temporarily, please retry',
  context: {
    originalError: '...',
    isRetryable: true,
    s3Key: '...',
    fileName: '...',
    documentType: 'INVOICE'
  }
}

// Duplicate key constraint
{
  code: 'P2002',
  message: 'A record with this unique constraint already exists',
  context: { s3Key: '...', fileName: '...' }
}
```

### SQS Errors

```typescript
// Queue unavailable
{
  code: 'SQS_SEND_FAILED',
  message: 'Failed to send SQS processing message',
  context: {
    jobId: '...',
    uploadId: '...',
    documentId: '...',
    originalError: 'NetworkingError: ...',
    isRetryable: true
  }
}

// Configuration error
{
  code: 'SQS_QUEUE_URL_NOT_CONFIGURED',
  message: 'SQS_QUEUE_URL not configured. Cannot send processing message.',
  context: { jobId: '...', uploadId: '...', documentId: '...' }
}
```

## Logging Structure

### Operation Start

```json
{
  "level": "log",
  "message": "Starting upload completion processing",
  "operationId": "upload-completion-1640995200000",
  "userId": "user-123",
  "workspaceId": "workspace-456",
  "fileName": "invoice.pdf",
  "fileType": "application/pdf",
  "documentType": "INVOICE",
  "s3Key": "uploads/2024/01/invoice.pdf",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Database Transaction Success

```json
{
  "level": "log",
  "message": "Database transaction completed successfully",
  "operationId": "upload-completion-1640995200000",
  "uploadId": "upload-789",
  "documentId": "document-101",
  "jobId": "job-202",
  "transactionDuration": "150ms"
}
```

### SQS Message Success

```json
{
  "level": "log",
  "message": "SQS processing message sent successfully",
  "operationId": "upload-completion-1640995200000",
  "jobId": "job-202",
  "uploadId": "upload-789",
  "documentId": "document-101",
  "sqsMessageId": "12345678-1234-1234-1234-123456789012"
}
```

### Error Logging

```json
{
  "level": "error",
  "message": "Database transaction failed",
  "operationId": "upload-completion-1640995200000",
  "code": "P2002",
  "errorMessage": "A record with this unique constraint already exists",
  "context": {
    "originalError": "Unique constraint failed on the fields: (`key`)",
    "isRetryable": false,
    "s3Key": "uploads/2024/01/invoice.pdf",
    "fileName": "invoice.pdf",
    "documentType": "INVOICE"
  },
  "operation": "processUploadedFile",
  "userId": "user-123",
  "workspaceId": "workspace-456",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "transactionDuration": "75ms",
  "stack": "Error: Unique constraint failed..."
}
```

## Fallback Mechanisms

### SQS Unavailable

When SQS is unavailable:

1. Database transaction completes successfully
2. SQS error is logged with full context
3. Job status is updated to 'failed' with error details
4. Response returns with `sqsMessageId: 'FAILED_TO_SEND'`
5. Client receives successful response but knows SQS failed

### Database Transaction Failure

When database operations fail:

1. All changes are automatically rolled back
2. Detailed error information is logged
3. Appropriate HTTP status code is returned
4. No SQS message is sent (avoiding orphaned messages)

### Workspace Access Issues

When workspace access validation fails:

1. Operation stops before any database changes
2. Detailed access context is logged
3. 403 Forbidden response is returned
4. No resources are created or modified

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Error Rates**: Track error frequency by error code
2. **Transaction Duration**: Monitor database transaction performance
3. **SQS Success Rate**: Track SQS message delivery success
4. **Operation Duration**: Monitor end-to-end processing time

### Log Queries for Troubleshooting

```bash
# Find all failed upload completions
grep "Upload completion processing failed" logs/*.log

# Find SQS-related errors
grep "SQS_SEND_FAILED" logs/*.log

# Find database transaction failures
grep "DATABASE_TRANSACTION_FAILED" logs/*.log

# Track specific operation
grep "upload-completion-1640995200000" logs/*.log
```

### Alerting Thresholds

- **Error Rate**: Alert if error rate > 5% over 5 minutes
- **SQS Failures**: Alert if SQS failure rate > 10% over 5 minutes
- **Transaction Duration**: Alert if average duration > 5 seconds
- **Database Errors**: Alert immediately on any P1001, P1002, P1008, P1017 errors

## Testing Error Scenarios

The error handling can be tested using the provided test suite:

```bash
npm test -- --testPathPattern="upload-error-handling"
```

Test scenarios include:

- Missing SQS queue URL configuration
- Invalid processing message data
- Invalid S3 key formats
- Database constraint violations
- Network connectivity issues

## Configuration

### Environment Variables

```bash
# Required for SQS operations
SQS_QUEUE_URL=https://sqs.region.amazonaws.com/account/queue-name

# Database connection with retry configuration
DATABASE_URL=postgresql://user:pass@host:port/db?connection_limit=10&pool_timeout=20

# AWS region for SQS client
AWS_REGION=us-east-1
```

### Transaction Configuration

```typescript
// Transaction timeout and retry settings
await this.prisma.$transaction(
  async tx => {
    // ... operations
  },
  {
    timeout: 30000, // 30 second timeout
    maxWait: 5000, // 5 second max wait for transaction to start
  },
);
```

This comprehensive error handling ensures the upload completion workflow is robust, observable, and maintainable.
