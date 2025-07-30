// S3 Upload API TypeScript Definitions
// This is the backend version - copy to frontend and add React types as needed

// Enums
export enum DocumentType {
  INVOICE = 'INVOICE',
  RECEIPT = 'RECEIPT',
  CREDIT_NOTE = 'CREDIT_NOTE',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  BANK_STATEMENT = 'BANK_STATEMENT',
  PAYSLIP = 'PAYSLIP',
  CONTRACT = 'CONTRACT',
  OTHER = 'OTHER',
}

export enum DocumentStatus {
  UNPROCESSED = 'UNPROCESSED',
  PROCESSED = 'PROCESSED',
  PAID = 'PAID',
  UNPAID = 'UNPAID',
  FLAGGED = 'FLAGGED',
}

export enum UploadStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
}

// Request Interfaces
export interface PresignedUrlRequest {
  fileName: string;
  fileType: string;
  fileSize?: number;
  workspaceId?: string;
}

export interface CreateUploadRecordRequest {
  key: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  workspaceId?: string;
}

export interface CreateDocumentRequest {
  uploadId: string;
  fileName: string;
  documentUrl: string;
  type: DocumentType;
  workspaceId?: string;
}

export interface CreateJobRequest {
  uploadId: string;
  type: DocumentType;
}

export interface UpdateUploadStatusRequest {
  status: UploadStatus;
}

export interface UpdateDocumentStatusRequest {
  status: DocumentStatus;
}

export interface UpdateJobStatusRequest {
  status: JobStatus;
  errorMessage?: string;
  errorCode?: string;
}

// Response Interfaces
export interface PresignedUrlResponse {
  uploadUrl: string;
  key: string;
  expiresIn: number;
  maxFileSize: number;
}

export interface UploadRecordResponse {
  id: string;
  key: string;
  fileName: string;
  fileType: string;
  fileSize?: number | null;
  status: UploadStatus;
  uploadedAt: string;
  userId: string;
  workspaceId?: string | null;
}

export interface DocumentResponse {
  id: string;
  fileName: string;
  documentUrl: string;
  type: DocumentType;
  status: DocumentStatus;
  uploadId?: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobResponse {
  id: string;
  status: JobStatus;
  type: DocumentType;
  uploadId: string;
  userId: string;
  startedAt: string;
  completedAt?: string | null;
  errorMessage?: string | null;
  errorCode?: string | null;
}

// Error Response Interface
export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// Upload Error Types
export enum UploadErrorType {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  WORKSPACE_ACCESS_DENIED = 'WORKSPACE_ACCESS_DENIED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  S3_UPLOAD_FAILED = 'S3_UPLOAD_FAILED',
  DOCUMENT_CREATION_FAILED = 'DOCUMENT_CREATION_FAILED',
  UPLOAD_RECORD_CREATION_FAILED = 'UPLOAD_RECORD_CREATION_FAILED',
}

export interface UploadError {
  type: UploadErrorType;
  message: string;
  details?: any;
  retryable: boolean;
}

// Upload Result Interface
export interface UploadResult {
  uploadId: string;
  documentId: string;
  jobId?: string;
  fileName: string;
  s3Key: string;
  status: DocumentStatus;
}

// File Constraints
export const FILE_CONSTRAINTS = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB in bytes
  PRESIGNED_URL_EXPIRY: 600, // 10 hour in seconds
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ] as const,
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  GENERATE_PRESIGNED_URL: '/api/upload/generate-url',
  CREATE_UPLOAD_RECORD: '/api/upload/records',
  GET_UPLOAD_BY_ID: '/api/upload/records/:id',
  GET_UPLOADS_BY_WORKSPACE: '/api/upload/workspace/:workspaceId',
  UPDATE_UPLOAD_STATUS: '/api/upload/records/:id/status',

  CREATE_DOCUMENT: '/api/documents',
  GET_DOCUMENT_BY_ID: '/api/documents/:id',
  GET_DOCUMENTS_BY_WORKSPACE: '/api/documents/workspace/:workspaceId',
  UPDATE_DOCUMENT_STATUS: '/api/documents/:id/status',

  CREATE_JOB: '/api/jobs',
  GET_JOB_BY_ID: '/api/jobs/:id',
  GET_JOB_BY_UPLOAD_ID: '/api/jobs/upload/:uploadId',
  GET_USER_JOBS: '/api/jobs/my-jobs',
  UPDATE_JOB_STATUS: '/api/jobs/:id/status',
} as const;

// Utility Types
export type SupportedMimeType = (typeof FILE_CONSTRAINTS.ALLOWED_MIME_TYPES)[number];

// API Client Interface
export interface S3UploadApiClient {
  generatePresignedUrl(request: PresignedUrlRequest): Promise<PresignedUrlResponse>;
  uploadToS3(uploadUrl: string, file: File): Promise<void>;
  createUploadRecord(request: CreateUploadRecordRequest): Promise<UploadRecordResponse>;
  createDocument(request: CreateDocumentRequest): Promise<DocumentResponse>;
  createJob(request: CreateJobRequest): Promise<JobResponse>;

  getUploadById(id: string): Promise<UploadRecordResponse>;
  getUploadsByWorkspace(workspaceId: string): Promise<UploadRecordResponse[]>;

  getDocumentById(id: string): Promise<DocumentResponse>;
  getDocumentsByWorkspace(workspaceId: string): Promise<DocumentResponse[]>;

  getJobById(id: string): Promise<JobResponse>;
  getJobByUploadId(uploadId: string): Promise<JobResponse>;
  getUserJobs(): Promise<JobResponse[]>;

  uploadFile(file: File, workspaceId?: string): Promise<UploadResult>;
}

// Frontend-specific interfaces (add these when copying to frontend project)
/*
// Hook Interface for React
export interface UseS3UploadOptions {
  workspaceId?: string;
  onUploadComplete?: (result: UploadResult) => void;
  onUploadError?: (error: UploadError) => void;
  maxFileSize?: number;
  acceptedFileTypes?: SupportedMimeType[];
}

export interface UseS3UploadReturn {
  uploadFile: (file: File) => Promise<UploadResult>;
  uploadFiles: (files: File[]) => Promise<UploadResult[]>;
  progress: number; // 0-100
  isUploading: boolean;
  error: UploadError | null;
  cancelUpload: () => void;
  reset: () => void;
}

// Component Props Interfaces
export interface UploadDropzoneProps {
  workspaceId?: string;
  multiple?: boolean;
  acceptedFileTypes?: SupportedMimeType[];
  maxFileSize?: number;
  onUploadComplete?: (results: UploadResult[]) => void;
  onUploadError?: (error: UploadError) => void;
  className?: string;
  disabled?: boolean;
}

export interface UploadButtonProps {
  workspaceId?: string;
  multiple?: boolean;
  acceptedFileTypes?: SupportedMimeType[];
  maxFileSize?: number;
  onUploadComplete?: (results: UploadResult[]) => void;
  onUploadError?: (error: UploadError) => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}
*/
