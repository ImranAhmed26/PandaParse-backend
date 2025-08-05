# Internal API Documentation

## Overview

The Internal API provides endpoints for AWS operations and system-to-system communication without requiring user authentication. These endpoints are secured with an internal API key.

## Authentication

All internal endpoints require an API key in the request headers:

```
X-API-Key: your_internal_api_key
```

Alternative header names:

- `X-Internal-API-Key`
- `Internal-API-Key`

## Environment Configuration

Add to your `.env` file:

```
INTERNAL_API_KEY=your_secure_internal_api_key_here
```

## Internal Endpoints

### Upload Operations

#### Generate Presigned URL (Internal)

```
POST /api/upload/internal/generate-url
Headers: X-API-Key: <internal_api_key>
Body: {
  fileName: string;
  fileType: string;
  fileSize?: number;
  workspaceId?: string;
  userId: string;  // Required for internal calls
}
```

#### Create Upload Record (Internal)

```
POST /api/upload/internal/records
Headers: X-API-Key: <internal_api_key>
Body: {
  key: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  workspaceId?: string;
  userId: string;  // Required for internal calls
}
```

#### Update Upload Status (Internal)

```
PATCH /api/upload/internal/records/:id/status
Headers: X-API-Key: <internal_api_key>
Body: {
  status: 'uploaded' | 'processing' | 'complete' | 'failed';
}
```

### Document Operations

#### Create Document (Internal)

```
POST /api/documents/internal
Headers: X-API-Key: <internal_api_key>
Body: {
  uploadId: string;
  fileName: string;
  documentUrl: string;
  type: DocumentType;
  workspaceId?: string;
  userId: string;  // Required for internal calls
}
```

#### Update Document Status (Internal)

```
PATCH /api/documents/internal/:id/status
Headers: X-API-Key: <internal_api_key>
Body: {
  status: 'UNPROCESSED' | 'PROCESSED' | 'PAID' | 'UNPAID' | 'FLAGGED';
}
```

### Job Operations

#### Create Job (Internal)

```
POST /api/jobs/internal
Headers: X-API-Key: <internal_api_key>
Body: {
  uploadId: string;
  type: DocumentType;
  userId: string;  // Required for internal calls
}
```

#### Update Job Status (Internal)

```
PATCH /api/jobs/internal/:id/status
Headers: X-API-Key: <internal_api_key>
Body: {
  status: 'pending' | 'processing' | 'success' | 'failed';
  errorMessage?: string;
  errorCode?: string;
}
```

## Usage Examples

### Node.js/JavaScript Example

```javascript
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
const BASE_URL = 'http://localhost:8000/api';

async function createInternalUpload(userId, fileName, fileType, workspaceId) {
  // Step 1: Generate presigned URL
  const presignedResponse = await fetch(`${BASE_URL}/upload/internal/generate-url`, {
    method: 'POST',
    headers: {
      'X-API-Key': INTERNAL_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName,
      fileType,
      userId,
      workspaceId,
    }),
  });

  const { uploadUrl, key } = await presignedResponse.json();

  // Step 2: Upload file to S3 (your file upload logic here)
  // await uploadFileToS3(uploadUrl, file);

  // Step 3: Create upload record
  const uploadRecord = await fetch(`${BASE_URL}/upload/internal/records`, {
    method: 'POST',
    headers: {
      'X-API-Key': INTERNAL_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key,
      fileName,
      fileType,
      userId,
      workspaceId,
    }),
  });

  return await uploadRecord.json();
}

async function updateJobStatus(jobId, status, errorMessage = null) {
  const response = await fetch(`${BASE_URL}/jobs/internal/${jobId}/status`, {
    method: 'PATCH',
    headers: {
      'X-API-Key': INTERNAL_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status,
      ...(errorMessage && { errorMessage }),
    }),
  });

  return await response.json();
}
```

### Python Example

```python
import requests
import os

INTERNAL_API_KEY = os.getenv('INTERNAL_API_KEY')
BASE_URL = 'http://localhost:8000/api'

def create_internal_document(upload_id, file_name, document_url, doc_type, user_id, workspace_id=None):
    headers = {
        'X-API-Key': INTERNAL_API_KEY,
        'Content-Type': 'application/json'
    }

    data = {
        'uploadId': upload_id,
        'fileName': file_name,
        'documentUrl': document_url,
        'type': doc_type,
        'userId': user_id
    }

    if workspace_id:
        data['workspaceId'] = workspace_id

    response = requests.post(
        f'{BASE_URL}/documents/internal',
        headers=headers,
        json=data
    )

    return response.json()

def update_document_status(document_id, status):
    headers = {
        'X-API-Key': INTERNAL_API_KEY,
        'Content-Type': 'application/json'
    }

    response = requests.patch(
        f'{BASE_URL}/documents/internal/{document_id}/status',
        headers=headers,
        json={'status': status}
    )

    return response.json()
```

### AWS Lambda Example

```javascript
// AWS Lambda function for processing documents
exports.handler = async event => {
  const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;
  const API_BASE_URL = process.env.API_BASE_URL;

  try {
    // Process the document (OCR, analysis, etc.)
    const result = await processDocument(event.documentId);

    // Update job status to success
    await fetch(`${API_BASE_URL}/jobs/internal/${event.jobId}/status`, {
      method: 'PATCH',
      headers: {
        'X-API-Key': INTERNAL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'success',
      }),
    });

    // Update document status
    await fetch(`${API_BASE_URL}/documents/internal/${event.documentId}/status`, {
      method: 'PATCH',
      headers: {
        'X-API-Key': INTERNAL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'PROCESSED',
      }),
    });

    return { statusCode: 200, body: 'Success' };
  } catch (error) {
    // Update job status to failed
    await fetch(`${API_BASE_URL}/jobs/internal/${event.jobId}/status`, {
      method: 'PATCH',
      headers: {
        'X-API-Key': INTERNAL_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        status: 'failed',
        errorMessage: error.message,
      }),
    });

    return { statusCode: 500, body: 'Error' };
  }
};
```

## Security Considerations

1. **API Key Security**: Store the internal API key securely and rotate it regularly
2. **Network Security**: Use HTTPS in production
3. **Access Control**: Internal endpoints bypass user authentication but still validate data
4. **Logging**: All internal API calls are logged for audit purposes
5. **Rate Limiting**: Consider implementing rate limiting for internal endpoints

## Error Responses

### 401 Unauthorized

```json
{
  "statusCode": 401,
  "message": "Internal API key is required"
}
```

### 401 Invalid API Key

```json
{
  "statusCode": 401,
  "message": "Invalid internal API key"
}
```

### 400 Bad Request

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

## Best Practices

1. **Use Environment Variables**: Never hardcode API keys
2. **Validate Input**: Always validate request data even for internal calls
3. **Error Handling**: Implement proper error handling and logging
4. **Monitoring**: Monitor internal API usage and performance
5. **Documentation**: Keep internal API documentation up to date
6. **Testing**: Test internal endpoints thoroughly
