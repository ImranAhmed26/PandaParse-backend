# S3 Upload API Documentation

## Overview

This document provides comprehensive API documentation for the S3 upload system, designed for frontend integration. The system allows direct uploads to S3 using presigned URLs while maintaining proper backend tracking and processing.

## Authentication

All endpoints require JWT authentication via the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

## Complete Upload Flow

### 1. Generate Presigned URL

**Endpoint:** `POST /api/upload/generate-url`

**Description:** Generate a presigned URL for direct S3 upload

**Request Body:**

```typescript
{
  fileName: string;        // Original filename (e.g., "invoice.pdf")
  fileType: string;        // MIME type (e.g., "application/pdf")
  fileSize?: number;       // File size in bytes (optional)
  workspaceId?: string;    // Target workspace UUID (optional)
}
```

**Response:**

```typescript
{
  uploadUrl: string; // S3 presigned URL for upload
  key: string; // S3 object key
  expiresIn: number; // URL expiration time in seconds (3600)
  maxFileSize: number; // Maximum allowed file size in bytes
}
```

**Example:**

```javascript
const response = await fetch('/api/upload/generate-url', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    fileName: 'invoice.pdf',
    fileType: 'application/pdf',
    fileSize: 1048576,
    workspaceId: '123e4567-e89b-12d3-a456-426614174000',
  }),
});
```

### 2. Upload to S3

**Description:** Upload file directly to S3 using the presigned URL

**Method:** `PUT` to the `uploadUrl` from step 1

**Headers:**

```
Content-Type: <fileType from step 1>
```

**Body:** Raw file data

**Example:**

```javascript
const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/pdf',
  },
  body: file,
});
```

### 3. Create Upload Record

**Endpoint:** `POST /api/upload/records`

**Description:** Create a database record for the uploaded file

**Request Body:**

```typescript
{
  key: string;            // S3 key from step 1
  fileName: string;       // Original filename
  fileType: string;       // MIME type
  fileSize?: number;      // File size in bytes
  workspaceId?: string;   // Workspace UUID
}
```

**Response:**

```typescript
{
  id: string;             // Upload record ID
  key: string;            // S3 object key
  fileName: string;       // Original filename
  fileType: string;       // MIME type
  fileSize?: number;      // File size in bytes
  status: 'uploaded' | 'processing' | 'complete' | 'failed';
  uploadedAt: string;     // ISO date string
  userId: string;         // User ID
  workspaceId?: string;   // Workspace ID
}
```

### 4. Create Document Record

**Endpoint:** `POST /api/documents`

**Description:** Create a document record linked to the upload

**Request Body:**

```typescript
{
  uploadId: string;       // Upload ID from step 3
  fileName: string;       // Original filename
  documentUrl: string;    // S3 URL (construct from bucket + key)
  type: 'INVOICE' | 'RECEIPT' | 'CREDIT_NOTE' | 'PURCHASE_ORDER' | 'BANK_STATEMENT' | 'PAYSLIP' | 'CONTRACT' | 'OTHER';
  workspaceId?: string;   // Workspace UUID
}
```

**Response:**

```typescript
{
  id: string; // Document ID
  fileName: string; // Original filename
  documentUrl: string; // S3 URL
  type: string; // Document type
  status: 'UNPROCESSED' | 'PROCESSED' | 'PAID' | 'UNPAID' | 'FLAGGED';
  uploadId: string; // Associated upload ID
  userId: string; // User ID
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}
```

### 5. Create Processing Job (Optional)

**Endpoint:** `POST /api/jobs`

**Description:** Create a processing job for OCR/analysis

**Request Body:**

```typescript
{
  uploadId: string; // Upload ID from step 3
  type: 'INVOICE' |
    'RECEIPT' |
    'CREDIT_NOTE' |
    'PURCHASE_ORDER' |
    'BANK_STATEMENT' |
    'PAYSLIP' |
    'CONTRACT' |
    'OTHER';
}
```

**Response:**

```typescript
{
  id: string;             // Job ID
  status: 'pending' | 'processing' | 'success' | 'failed';
  type: string;           // Document type
  uploadId: string;       // Associated upload ID
  userId: string;         // User ID
  startedAt: string;      // ISO date string
  completedAt?: string;   // ISO date string (when completed)
  errorMessage?: string;  // Error message if failed
  errorCode?: string;     // Error code if failed
}
```

## TypeScript Interfaces

```typescript
// Request interfaces
interface PresignedUrlRequest {
  fileName: string;
  fileType: string;
  fileSize?: number;
  workspaceId?: string;
}

interface CreateUploadRecordRequest {
  key: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  workspaceId?: string;
}

interface CreateDocumentRequest {
  uploadId: string;
  fileName: string;
  documentUrl: string;
  type: DocumentType;
  workspaceId?: string;
}

interface CreateJobRequest {
  uploadId: string;
  type: DocumentType;
}

// Response interfaces
interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
  maxFileSize: number;
}

interface UploadRecordResponse {
  id: string;
  key: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  status: UploadStatus;
  uploadedAt: string;
  userId: string;
  workspaceId?: string;
}

interface DocumentResponse {
  id: string;
  fileName: string;
  documentUrl: string;
  type: DocumentType;
  status: DocumentStatus;
  uploadId?: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface JobResponse {
  id: string;
  status: JobStatus;
  type: DocumentType;
  uploadId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  errorCode?: string;
}

// Enums
type DocumentType =
  | 'INVOICE'
  | 'RECEIPT'
  | 'CREDIT_NOTE'
  | 'PURCHASE_ORDER'
  | 'BANK_STATEMENT'
  | 'PAYSLIP'
  | 'CONTRACT'
  | 'OTHER';
type DocumentStatus = 'UNPROCESSED' | 'PROCESSED' | 'PAID' | 'UNPAID' | 'FLAGGED';
type UploadStatus = 'uploaded' | 'processing' | 'complete' | 'failed';
type JobStatus = 'pending' | 'processing' | 'success' | 'failed';
```

## Additional Endpoints

### Get Upload Records

**Endpoint:** `GET /api/upload/workspace/:workspaceId`
**Description:** Get all uploads in a workspace
**Response:** Array of `UploadRecordResponse`

**Endpoint:** `GET /api/upload/records/:id`
**Description:** Get upload record by ID
**Response:** `UploadRecordResponse`

### Get Documents

**Endpoint:** `GET /api/documents/workspace/:workspaceId`
**Description:** Get all documents in a workspace
**Response:** Array of `DocumentResponse`

**Endpoint:** `GET /api/documents/:id`
**Description:** Get document by ID
**Response:** `DocumentResponse`

### Get Jobs

**Endpoint:** `GET /api/jobs/my-jobs`
**Description:** Get all jobs for current user
**Response:** Array of `JobResponse`

**Endpoint:** `GET /api/jobs/upload/:uploadId`
**Description:** Get job by upload ID
**Response:** `JobResponse`

**Endpoint:** `GET /api/jobs/:id`
**Description:** Get job by ID
**Response:** `JobResponse`

## Error Handling

### Common Error Responses

**400 Bad Request:**

```typescript
{
  statusCode: 400,
  message: string | string[],
  error: "Bad Request"
}
```

**401 Unauthorized:**

```typescript
{
  statusCode: 401,
  message: "Unauthorized"
}
```

**403 Forbidden:**

```typescript
{
  statusCode: 403,
  message: "Access denied to workspace" | "Insufficient permissions"
}
```

**404 Not Found:**

```typescript
{
  statusCode: 404,
  message: "Upload not found" | "Document not found" | "Workspace not found"
}
```

**500 Internal Server Error:**

```typescript
{
  statusCode: 500,
  message: "Internal server error"
}
```

### Upload-Specific Errors

**File Type Not Allowed:**

```typescript
{
  statusCode: 400,
  message: "File type 'text/html' not allowed. Supported types: application/pdf, image/jpeg, image/png, image/jpg, text/csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, text/plain"
}
```

**File Too Large:**

```typescript
{
  statusCode: 400,
  message: "File size exceeds maximum allowed size of 50 MB"
}
```

## File Constraints

### Supported File Types

- `application/pdf` - PDF documents
- `image/jpeg` - JPEG images
- `image/png` - PNG images
- `image/jpg` - JPG images
- `text/csv` - CSV files
- `application/vnd.ms-excel` - Excel files (.xls)
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` - Excel files (.xlsx)
- `text/plain` - Text files

### File Size Limits

- Maximum file size: 50 MB (52,428,800 bytes)
- Presigned URL expiration: 1 hour (3600 seconds)

## S3 Object Structure

Files are organized in S3 with the following structure:

```
bucket-name/
├── documents/
│   ├── {userId}/
│   │   ├── {workspaceId}/
│   │   │   ├── {filename}-{uuid}.{ext}
│   │   │   └── ...
│   │   └── personal/
│   │       ├── {filename}-{uuid}.{ext}
│   │       └── ...
│   └── ...
```

## Complete Frontend Example

```typescript
class S3UploadService {
  private baseUrl = '/api';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async uploadFile(file: File, workspaceId?: string): Promise<DocumentResponse> {
    try {
      // Step 1: Generate presigned URL
      const presignedResponse = await fetch(`${this.baseUrl}/upload/generate-url`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          workspaceId,
        }),
      });

      if (!presignedResponse.ok) {
        throw new Error('Failed to generate presigned URL');
      }

      const { uploadUrl, key } = await presignedResponse.json();

      // Step 2: Upload to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload to S3');
      }

      // Step 3: Create upload record
      const uploadRecordResponse = await fetch(`${this.baseUrl}/upload/records`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          workspaceId,
        }),
      });

      if (!uploadRecordResponse.ok) {
        throw new Error('Failed to create upload record');
      }

      const uploadRecord = await uploadRecordResponse.json();

      // Step 4: Create document record
      const documentResponse = await fetch(`${this.baseUrl}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadId: uploadRecord.id,
          fileName: file.name,
          documentUrl: `https://your-bucket.s3.amazonaws.com/${key}`,
          type: 'OTHER', // Determine based on your logic
          workspaceId,
        }),
      });

      if (!documentResponse.ok) {
        throw new Error('Failed to create document record');
      }

      return await documentResponse.json();
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }
}
```

## Security Considerations

1. **Authentication:** All endpoints require valid JWT tokens
2. **Authorization:** Users can only access their own uploads and workspaces they belong to
3. **File Validation:** Server validates file types and sizes before generating presigned URLs
4. **Presigned URL Expiration:** URLs expire after 10 minutes for security
5. **Workspace Access:** Workspace permissions are validated BEFORE generating presigned URLs
6. **Early Validation:** Workspace access is checked at presigned URL generation, not after upload
7. **Rate Limiting:** Consider implementing rate limiting on presigned URL generation
8. **S3 Bucket Security:** Ensure S3 bucket is private and properly configured

## Best Practices

1. **Error Handling:** Always handle errors gracefully and provide user feedback
2. **Progress Tracking:** Implement upload progress tracking for better UX
3. **Retry Logic:** Implement retry mechanisms for network failures
4. **File Validation:** Validate files on the client side before upload
5. **Cleanup:** Handle failed uploads by cleaning up partial records
6. **Security:** Never expose S3 credentials to the frontend
