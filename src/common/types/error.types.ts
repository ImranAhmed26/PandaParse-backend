export interface PrismaError extends Error {
  code?: string;
  meta?: any;
}

export interface ErrorWithMessage extends Error {
  message: string;
  stack?: string;
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
