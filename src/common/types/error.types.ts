export interface PrismaError extends Error {
  code?: string;
  meta?: any;
}

export interface ErrorWithMessage extends Error {
  message: string;
  stack?: string;
}

export interface StructuredError {
  code: string;
  message: string;
  context?: Record<string, any>;
  timestamp: string;
  operation?: string;
  userId?: string;
  workspaceId?: string;
}

export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  );
}

export function isPrismaError(error: unknown): error is PrismaError {
  return (
    isErrorWithMessage(error) &&
    'code' in error &&
    typeof (error as Record<string, unknown>).code === 'string'
  );
}

export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return 'Unknown error occurred';
}

export function getErrorStack(error: unknown): string | undefined {
  if (isErrorWithMessage(error)) {
    return error.stack;
  }
  return undefined;
}

export function getPrismaErrorCode(error: unknown): string | undefined {
  if (isPrismaError(error)) {
    return error.code;
  }
  return undefined;
}

export function createStructuredError(
  code: string,
  message: string,
  context?: Record<string, any>,
  operation?: string,
  userId?: string,
  workspaceId?: string,
): StructuredError {
  return {
    code,
    message,
    context,
    timestamp: new Date().toISOString(),
    operation,
    userId,
    workspaceId,
  };
}

export function getPrismaErrorMessage(error: unknown): string {
  if (isPrismaError(error)) {
    const code = error.code;
    switch (code) {
      case 'P2002':
        return 'A record with this unique constraint already exists';
      case 'P2025':
        return 'Record not found or has been deleted';
      case 'P2003':
        return 'Foreign key constraint violation';
      case 'P2014':
        return 'Invalid ID provided in the query';
      case 'P2021':
        return 'Table does not exist in the database';
      case 'P2022':
        return 'Column does not exist in the database';
      case 'P1001':
        return 'Cannot reach database server';
      case 'P1002':
        return 'Database server connection timeout';
      case 'P1008':
        return 'Database operation timeout';
      case 'P1017':
        return 'Database server has closed the connection';
      default:
        return error.message || 'Database operation failed';
    }
  }
  return getErrorMessage(error);
}

export function isRetryableError(error: unknown): boolean {
  if (isPrismaError(error)) {
    const retryableCodes = ['P1001', 'P1002', 'P1008', 'P1017'];
    return retryableCodes.includes(error.code || '');
  }

  if (error instanceof Error) {
    const retryableMessages = [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'NetworkingError',
      'TimeoutError',
    ];
    return retryableMessages.some(msg => error.message.includes(msg));
  }

  return false;
}
