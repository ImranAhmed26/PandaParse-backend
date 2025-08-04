# Frontend Integration Examples

## Complete Upload Service Implementation

```typescript
// s3-upload.service.ts
import {
  PresignedUrlRequest,
  PresignedUrlResponse,
  CreateUploadRecordRequest,
  UploadRecordResponse,
  CreateDocumentRequest,
  DocumentResponse,
  UploadResult,
  UploadError,
  UploadErrorType,
  DocumentType,
  API_ENDPOINTS,
  FILE_CONSTRAINTS,
} from './s3-upload-types';

export class S3UploadService {
  private baseUrl: string;
  private getAuthToken: () => string;

  constructor(baseUrl: string, getAuthToken: () => string) {
    this.baseUrl = baseUrl;
    this.getAuthToken = getAuthToken;
  }

  private async apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.getAuthToken()}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'API request failed');
    }

    return response.json();
  }

  async generatePresignedUrl(request: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    return this.apiCall<PresignedUrlResponse>(API_ENDPOINTS.GENERATE_PRESIGNED_URL, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async uploadToS3(
    uploadUrl: string,
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', event => {
        if (event.lengthComputable && onProgress) {
          const progress = Math.round((event.loaded / event.total) * 100);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`S3 upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('S3 upload failed'));
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  }

  async createUploadRecord(request: CreateUploadRecordRequest): Promise<UploadRecordResponse> {
    return this.apiCall<UploadRecordResponse>(API_ENDPOINTS.CREATE_UPLOAD_RECORD, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async createDocument(request: CreateDocumentRequest): Promise<DocumentResponse> {
    return this.apiCall<DocumentResponse>(API_ENDPOINTS.CREATE_DOCUMENT, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async uploadFile(
    file: File,
    workspaceId?: string,
    onProgress?: (progress: number) => void,
  ): Promise<UploadResult> {
    try {
      // Validate file
      this.validateFile(file);

      // Step 1: Generate presigned URL
      const presignedResponse = await this.generatePresignedUrl({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        workspaceId,
      });

      // Step 2: Upload to S3
      await this.uploadToS3(presignedResponse.uploadUrl, file, onProgress);

      // Step 3: Create upload record
      const uploadRecord = await this.createUploadRecord({
        key: presignedResponse.key,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        workspaceId,
      });

      // Step 4: Create document record
      const document = await this.createDocument({
        uploadId: uploadRecord.id,
        fileName: file.name,
        documentUrl: this.constructS3Url(presignedResponse.key),
        type: this.inferDocumentType(file),
        workspaceId,
      });

      return {
        uploadId: uploadRecord.id,
        documentId: document.id,
        fileName: file.name,
        s3Key: presignedResponse.key,
        status: document.status,
      };
    } catch (error) {
      throw this.classifyError(error);
    }
  }

  private validateFile(file: File): void {
    if (file.size > FILE_CONSTRAINTS.MAX_FILE_SIZE) {
      throw new Error(
        `File size exceeds maximum allowed size of ${this.formatFileSize(FILE_CONSTRAINTS.MAX_FILE_SIZE)}`,
      );
    }

    if (!FILE_CONSTRAINTS.ALLOWED_MIME_TYPES.includes(file.type as any)) {
      throw new Error(`File type '${file.type}' not allowed`);
    }
  }

  private inferDocumentType(file: File): DocumentType {
    const fileName = file.name.toLowerCase();

    if (fileName.includes('invoice')) return DocumentType.INVOICE;
    if (fileName.includes('receipt')) return DocumentType.RECEIPT;
    if (fileName.includes('contract')) return DocumentType.CONTRACT;

    return DocumentType.OTHER;
  }

  private constructS3Url(key: string): string {
    // Replace with your actual S3 bucket URL
    return `https://your-bucket.s3.amazonaws.com/${key}`;
  }

  private formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  }

  private classifyError(error: any): UploadError {
    if (error.message?.includes('File size exceeds')) {
      return {
        type: UploadErrorType.FILE_TOO_LARGE,
        message: error.message,
        retryable: false,
      };
    }

    if (error.message?.includes('File type') && error.message?.includes('not allowed')) {
      return {
        type: UploadErrorType.INVALID_FILE_TYPE,
        message: error.message,
        retryable: false,
      };
    }

    if (error.message?.includes('S3 upload failed')) {
      return {
        type: UploadErrorType.S3_UPLOAD_FAILED,
        message: error.message,
        retryable: true,
      };
    }

    return {
      type: UploadErrorType.NETWORK_ERROR,
      message: error.message || 'Unknown error occurred',
      retryable: true,
    };
  }
}
```

## React Hook Implementation

```typescript
// useS3Upload.ts
import { useState, useCallback, useRef } from 'react';
import { S3UploadService } from './s3-upload.service';
import {
  UseS3UploadOptions,
  UseS3UploadReturn,
  UploadResult,
  UploadError,
  SupportedMimeType,
  FILE_CONSTRAINTS,
} from './s3-upload-types';

export function useS3Upload(options: UseS3UploadOptions = {}): UseS3UploadReturn {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<UploadError | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const uploadServiceRef = useRef<S3UploadService>();

  // Initialize service (you'll need to provide these)
  if (!uploadServiceRef.current) {
    uploadServiceRef.current = new S3UploadService(
      process.env.REACT_APP_API_BASE_URL || '',
      () => localStorage.getItem('authToken') || '',
    );
  }

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        // Validate file type if specified
        if (
          options.acceptedFileTypes &&
          !options.acceptedFileTypes.includes(file.type as SupportedMimeType)
        ) {
          throw new Error(`File type '${file.type}' not accepted`);
        }

        // Validate file size if specified
        const maxSize = options.maxFileSize || FILE_CONSTRAINTS.MAX_FILE_SIZE;
        if (file.size > maxSize) {
          throw new Error(`File size exceeds maximum of ${maxSize} bytes`);
        }

        const result = await uploadServiceRef.current!.uploadFile(
          file,
          options.workspaceId,
          setProgress,
        );

        options.onUploadComplete?.(result);
        return result;
      } catch (err: any) {
        const uploadError: UploadError = {
          type: 'NETWORK_ERROR',
          message: err.message,
          retryable: true,
        };

        setError(uploadError);
        options.onUploadError?.(uploadError);
        throw uploadError;
      } finally {
        setIsUploading(false);
      }
    },
    [options],
  );

  const uploadFiles = useCallback(
    async (files: File[]): Promise<UploadResult[]> => {
      const results: UploadResult[] = [];

      for (const file of files) {
        try {
          const result = await uploadFile(file);
          results.push(result);
        } catch (error) {
          // Continue with other files even if one fails
          console.error(`Failed to upload ${file.name}:`, error);
        }
      }

      return results;
    },
    [uploadFile],
  );

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsUploading(false);
      setProgress(0);
    }
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setError(null);
    setIsUploading(false);
  }, []);

  return {
    uploadFile,
    uploadFiles,
    progress,
    isUploading,
    error,
    cancelUpload,
    reset,
  };
}
```

## React Components

### Upload Dropzone Component

```typescript
// UploadDropzone.tsx
import React, { useCallback, useState } from 'react';
import { useS3Upload } from './useS3Upload';
import { UploadDropzoneProps, UploadResult } from './s3-upload-types';

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  workspaceId,
  multiple = false,
  acceptedFileTypes,
  maxFileSize,
  onUploadComplete,
  onUploadError,
  className = '',
  disabled = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const { uploadFile, uploadFiles, progress, isUploading, error } = useS3Upload({
    workspaceId,
    acceptedFileTypes,
    maxFileSize,
    onUploadComplete: (result) => onUploadComplete?.([result]),
    onUploadError,
  });

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (disabled || isUploading) return;

    const files = Array.from(e.dataTransfer.files);

    if (multiple) {
      const results = await uploadFiles(files);
      onUploadComplete?.(results);
    } else if (files.length > 0) {
      const result = await uploadFile(files[0]);
      onUploadComplete?.([result]);
    }
  }, [disabled, isUploading, multiple, uploadFile, uploadFiles, onUploadComplete]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (multiple) {
      const results = await uploadFiles(files);
      onUploadComplete?.(results);
    } else if (files.length > 0) {
      const result = await uploadFile(files[0]);
      onUploadComplete?.([result]);
    }
  }, [multiple, uploadFile, uploadFiles, onUploadComplete]);

  return (
    <div
      className={`upload-dropzone ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
    >
      <input
        type="file"
        multiple={multiple}
        accept={acceptedFileTypes?.join(',')}
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
        style={{ display: 'none' }}
        id="file-input"
      />

      <label htmlFor="file-input" className="upload-label">
        {isUploading ? (
          <div className="upload-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span>Uploading... {progress}%</span>
          </div>
        ) : (
          <div className="upload-content">
            <div className="upload-icon">📁</div>
            <p>
              {isDragOver
                ? 'Drop files here'
                : `Drag & drop files here or click to select`
              }
            </p>
            {acceptedFileTypes && (
              <p className="file-types">
                Accepted: {acceptedFileTypes.join(', ')}
              </p>
            )}
          </div>
        )}
      </label>

      {error && (
        <div className="upload-error">
          {error.message}
        </div>
      )}
    </div>
  );
};
```

### Upload Button Component

```typescript
// UploadButton.tsx
import React, { useCallback } from 'react';
import { useS3Upload } from './useS3Upload';
import { UploadButtonProps } from './s3-upload-types';

export const UploadButton: React.FC<UploadButtonProps> = ({
  workspaceId,
  multiple = false,
  acceptedFileTypes,
  maxFileSize,
  onUploadComplete,
  onUploadError,
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
}) => {
  const { uploadFile, uploadFiles, isUploading } = useS3Upload({
    workspaceId,
    acceptedFileTypes,
    maxFileSize,
    onUploadComplete: (result) => onUploadComplete?.([result]),
    onUploadError,
  });

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    if (multiple) {
      const results = await uploadFiles(files);
      onUploadComplete?.(results);
    } else if (files.length > 0) {
      const result = await uploadFile(files[0]);
      onUploadComplete?.([result]);
    }
  }, [multiple, uploadFile, uploadFiles, onUploadComplete]);

  return (
    <div className="upload-button-container">
      <input
        type="file"
        multiple={multiple}
        accept={acceptedFileTypes?.join(',')}
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
        style={{ display: 'none' }}
        id={`upload-input-${Math.random()}`}
      />

      <label
        htmlFor={`upload-input-${Math.random()}`}
        className={`upload-button ${variant} ${size} ${disabled || isUploading ? 'disabled' : ''}`}
      >
        {isUploading ? 'Uploading...' : children}
      </label>
    </div>
  );
};
```

## Usage Examples

### Basic Usage

```typescript
// App.tsx
import React from 'react';
import { UploadDropzone, UploadButton } from './components';
import { UploadResult } from './s3-upload-types';

function App() {
  const handleUploadComplete = (results: UploadResult[]) => {
    console.log('Upload completed:', results);
    // Update your UI, refresh document list, etc.
  };

  const handleUploadError = (error: UploadError) => {
    console.error('Upload failed:', error);
    // Show error notification
  };

  return (
    <div className="app">
      <h1>Document Upload</h1>

      <UploadDropzone
        workspaceId="workspace-123"
        multiple={true}
        onUploadComplete={handleUploadComplete}
        onUploadError={handleUploadError}
      />

      <UploadButton
        workspaceId="workspace-123"
        onUploadComplete={handleUploadComplete}
        onUploadError={handleUploadError}
      >
        Select Files
      </UploadButton>
    </div>
  );
}
```

### Advanced Usage with Custom Hook

```typescript
// DocumentManager.tsx
import React, { useState } from 'react';
import { useS3Upload } from './useS3Upload';
import { DocumentType } from './s3-upload-types';

function DocumentManager() {
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);

  const { uploadFile, progress, isUploading, error } = useS3Upload({
    workspaceId: 'workspace-123',
    onUploadComplete: (result) => {
      // Add to documents list
      setDocuments(prev => [...prev, {
        id: result.documentId,
        fileName: result.fileName,
        documentUrl: `https://bucket.s3.amazonaws.com/${result.s3Key}`,
        type: DocumentType.OTHER,
        status: result.status,
        uploadId: result.uploadId,
        userId: 'current-user-id',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileSelect} disabled={isUploading} />

      {isUploading && (
        <div>
          <progress value={progress} max={100} />
          <span>{progress}%</span>
        </div>
      )}

      {error && <div className="error">{error.message}</div>}

      <div className="documents">
        {documents.map(doc => (
          <div key={doc.id} className="document">
            <span>{doc.fileName}</span>
            <span>{doc.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## CSS Styles

```css
/* upload-components.css */
.upload-dropzone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  transition: all 0.3s ease;
  cursor: pointer;
}

.upload-dropzone.drag-over {
  border-color: #007bff;
  background-color: #f8f9fa;
}

.upload-dropzone.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #007bff;
  transition: width 0.3s ease;
}

.upload-error {
  color: #dc3545;
  margin-top: 1rem;
  padding: 0.5rem;
  background-color: #f8d7da;
  border-radius: 4px;
}

.upload-button {
  display: inline-block;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.3s ease;
}

.upload-button.primary {
  background-color: #007bff;
  color: white;
}

.upload-button.secondary {
  background-color: #6c757d;
  color: white;
}

.upload-button.outline {
  background-color: transparent;
  border: 1px solid #007bff;
  color: #007bff;
}

.upload-button.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-button:hover:not(.disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}
```
