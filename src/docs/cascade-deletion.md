# Document Cascade Deletion Guide

## Overview

When a document is deleted, the system performs **cascade deletion** to maintain data integrity and prevent orphaned records. This document explains what gets deleted and in what order.

## Deletion Chain

```
Document → WorkspaceDocument → Upload → Job → DocumentResult → InvoiceItem[]
```

## Detailed Deletion Process

### 1. **InvoiceItems** (Deepest Level)

- **What**: Individual line items from invoice processing
- **When**: If the document has OCR results with parsed items
- **Example**: Product names, quantities, prices from an invoice

### 2. **DocumentResult**

- **What**: OCR processing results and metadata
- **When**: If the document was processed through OCR
- **Includes**: JSON results, CSV exports, processing summary

### 3. **Job**

- **What**: Processing job record
- **When**: If a processing job was created for the document
- **Includes**: Job status, error messages, processing metadata

### 4. **WorkspaceDocument Associations**

- **What**: Many-to-many relationships between document and workspaces
- **When**: Always (if document is in any workspaces)
- **Purpose**: Removes document from workspace listings

### 5. **Document**

- **What**: The main document record
- **When**: Always
- **Includes**: File metadata, status, document type

### 6. **Upload** (Conditional)

- **What**: S3 upload record and metadata
- **When**: Only if no other documents reference the same upload
- **Safety**: Preserves upload if shared by multiple documents

## API Endpoints

### Preview Deletion

```http
GET /api/documents/:id/delete-preview
```

**Response:**

```json
{
  "document": {
    "id": "doc-uuid",
    "fileName": "invoice.pdf"
  },
  "upload": {
    "id": "upload-uuid",
    "fileName": "invoice.pdf",
    "fileSize": 1024000
  },
  "job": {
    "id": "job-uuid",
    "type": "INVOICE",
    "status": "success"
  },
  "documentResult": {
    "id": "result-uuid",
    "jsonUrl": "s3://bucket/results.json",
    "csvUrl": "s3://bucket/results.csv"
  },
  "invoiceItems": [
    {
      "id": "item-uuid",
      "name": "Product A",
      "total": 100.0
    }
  ],
  "workspaceAssociations": 2,
  "totalRecordsToDelete": 8
}
```

### Delete Document

```http
DELETE /api/documents/:id
```

### Bulk Delete

```http
DELETE /api/documents/bulk
Body: { "documentIds": ["id1", "id2", "id3"] }
```

### Delete Workspace Documents

```http
DELETE /api/documents/workspace/:workspaceId
```

## Safety Features

### 1. **Upload Preservation**

- Upload records are only deleted if no other documents reference them
- Prevents data loss when multiple documents share the same upload

### 2. **Permission Checks**

- All deletion operations verify user permissions
- Users can only delete documents they own or have workspace access to
- Admins can delete any document

### 3. **Transaction Safety**

- Deletions are performed in the correct order to avoid foreign key violations
- If any step fails, the entire operation is rolled back

### 4. **Audit Logging**

- All deletion operations are logged with details
- Includes user information and number of records deleted

## Examples

### Simple Document (No Processing)

```
Document → WorkspaceDocument (if in workspace)
Total Records: 1-2
```

### Processed Document with OCR

```
Document → WorkspaceDocument → Upload → Job → DocumentResult → InvoiceItems[5]
Total Records: 9
```

### Shared Upload Scenario

```
Document A (deleted) → WorkspaceDocument
Document B (exists) → Same Upload ← Preserved
Total Records: 2 (Upload preserved)
```

## Best Practices

### 1. **Preview Before Delete**

Always use the preview endpoint to understand what will be deleted:

```javascript
// Preview deletion
const preview = await fetch(`/api/documents/${docId}/delete-preview`);
const data = await preview.json();

console.log(`This will delete ${data.totalRecordsToDelete} records`);

// Confirm with user, then delete
if (confirm(`Delete ${data.document.fileName} and ${data.totalRecordsToDelete} related records?`)) {
  await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
}
```

### 2. **Bulk Operations**

For multiple documents, use bulk delete for better performance:

```javascript
// Instead of multiple single deletes
const results = await fetch('/api/documents/bulk', {
  method: 'DELETE',
  body: JSON.stringify({ documentIds: selectedIds }),
});

console.log(`${results.totalSuccessful} documents deleted successfully`);
```

### 3. **Error Handling**

Handle partial failures in bulk operations:

```javascript
const results = await bulkDelete(documentIds);

if (results.totalFailed > 0) {
  console.warn('Some deletions failed:', results.failed);
  // Show user which documents couldn't be deleted
}
```

## Database Schema Impact

### Foreign Key Relationships

```sql
-- These relationships ensure proper cascade behavior
Document.uploadId → Upload.id (nullable)
Job.uploadId → Upload.id (required)
DocumentResult.jobId → Job.id (required)
InvoiceItem.resultId → DocumentResult.id (required)
WorkspaceDocument.documentId → Document.id (required)
```

### Deletion Order Importance

The deletion order prevents foreign key constraint violations:

1. **Children First**: InvoiceItems → DocumentResult → Job
2. **Associations**: WorkspaceDocument
3. **Parent**: Document
4. **Conditional**: Upload (only if not referenced)

## Monitoring and Troubleshooting

### Logs to Monitor

```
Document ${documentId} and all related records deleted by user ${userId}
Deleted ${count} invoice items for document ${documentId}
Deleted document result for document ${documentId}
Deleted job for document ${documentId}
Upload record preserved - still referenced by ${count} other documents
```

### Common Issues

1. **Foreign Key Violations**: Usually indicates incorrect deletion order
2. **Permission Errors**: User doesn't have access to document or workspace
3. **Orphaned Records**: Rare, but can happen if deletion is interrupted

### Recovery

If deletion fails partway through:

1. Check logs for the exact failure point
2. Manually clean up any orphaned records
3. Consider running a cleanup script for consistency

## Performance Considerations

- **Single Document**: ~10-50ms depending on related records
- **Bulk Delete**: Scales linearly, ~100ms per 10 documents
- **Workspace Delete**: Can be slow for workspaces with many documents
- **Database Load**: Minimal impact due to proper indexing

## Security Considerations

- All deletions require authentication
- Workspace-level permissions are enforced
- Admin users can delete any document
- Audit logs track all deletion activities
- No way to recover deleted data (implement backups if needed)
