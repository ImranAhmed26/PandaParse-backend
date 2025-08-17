/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable, Logger } from '@nestjs/common';
import {
  SQSClient,
  SendMessageCommand,
  SendMessageResult,
  SQSServiceException,
} from '@aws-sdk/client-sqs';

export interface ProcessingMessageData {
  jobId: string;
  uploadId: string;
  documentId: string;
  s3Key: string;
  documentType: string;
  userId: string;
  workspaceId?: string;
  fileName: string;
  fileType: string;
  timestamp: string;
}

@Injectable()
export class AwsSqsService {
  private readonly logger = new Logger(AwsSqsService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string | undefined;

  constructor() {
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'eu-west-1',
    });

    this.queueUrl = process.env.SQS_QUEUE_URL;

    if (!this.queueUrl) {
      this.logger.warn('SQS_QUEUE_URL not configured. SQS operations will fail.');
    }
  }

  /**
   * Send a generic message to SQS queue
   * @param queueUrl - The SQS queue URL
   * @param messageBody - The message body object to send
   * @returns Promise<SendMessageResult>
   */
  async sendMessage(queueUrl: string, messageBody: object): Promise<SendMessageResult> {
    const startTime = Date.now();
    const messageSize = JSON.stringify(messageBody).length;

    this.logger.debug(`Attempting to send SQS message`, {
      queueUrl,
      messageSize,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate message size (SQS limit is 256KB)
      if (messageSize > 262144) {
        throw new Error(`Message size ${messageSize} bytes exceeds SQS limit of 256KB`);
      }

      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(messageBody),
      });

      const result = await this.sqsClient.send(command);
      const duration = Date.now() - startTime;

      this.logger.log(`SQS message sent successfully`, {
        queueUrl,
        messageId: result.MessageId,
        messageSize,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorDetails = this.extractSqsErrorDetails(error);

      this.logger.error(`Failed to send SQS message`, {
        queueUrl,
        messageSize,
        duration: `${duration}ms`,
        errorCode: errorDetails.code,
        errorMessage: errorDetails.message,
        errorType: errorDetails.type,
        retryable: errorDetails.retryable,
        timestamp: new Date().toISOString(),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Throw enhanced error with context
      throw new Error(
        `SQS send message failed: ${errorDetails.message} (Code: ${errorDetails.code}, Type: ${errorDetails.type})`,
      );
    }
  }

  /**
   * Send a processing message for upload workflow
   * @param jobData - The job data to send for processing
   * @returns Promise<string> - Returns the SQS message ID
   */
  async sendProcessingMessage(jobData: ProcessingMessageData): Promise<string> {
    if (!this.queueUrl) {
      const error = 'SQS_QUEUE_URL not configured. Cannot send processing message.';
      this.logger.error(`SQS configuration error`, {
        jobId: jobData.jobId,
        uploadId: jobData.uploadId,
        documentId: jobData.documentId,
        error,
        timestamp: new Date().toISOString(),
      });
      throw new Error(error);
    }

    this.logger.debug(`Preparing processing message for upload workflow`, {
      jobId: jobData.jobId,
      uploadId: jobData.uploadId,
      documentId: jobData.documentId,
      documentType: jobData.documentType,
      userId: jobData.userId,
      workspaceId: jobData.workspaceId,
      fileName: jobData.fileName,
      fileType: jobData.fileType,
      s3Key: jobData.s3Key,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate required fields
      this.validateProcessingMessageData(jobData);

      const messageBody = {
        ...jobData,
        timestamp: jobData.timestamp || new Date().toISOString(),
        messageType: 'UPLOAD_PROCESSING',
        version: '1.0',
      };

      const result = await this.sendMessage(this.queueUrl, messageBody);
      const messageId = result.MessageId ?? '';

      this.logger.log(`Processing message sent successfully for upload workflow`, {
        jobId: jobData.jobId,
        uploadId: jobData.uploadId,
        documentId: jobData.documentId,
        messageId,
        queueUrl: this.queueUrl,
        timestamp: new Date().toISOString(),
      });

      return messageId;
    } catch (error) {
      this.logger.error(`Failed to send processing message for upload workflow`, {
        jobId: jobData.jobId,
        uploadId: jobData.uploadId,
        documentId: jobData.documentId,
        queueUrl: this.queueUrl,
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new Error(
        `Failed to send processing message for job ${jobData.jobId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate processing message data
   * @param jobData - The job data to validate
   */
  private validateProcessingMessageData(jobData: ProcessingMessageData): void {
    const requiredFields = [
      'jobId',
      'uploadId',
      'documentId',
      's3Key',
      'documentType',
      'userId',
      'fileName',
      'fileType',
    ];
    const missingFields = requiredFields.filter(
      field => !jobData[field as keyof ProcessingMessageData],
    );

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields in processing message: ${missingFields.join(', ')}`);
    }

    // Validate S3 key format
    if (!jobData.s3Key.match(/^[a-zA-Z0-9\-_/.]+$/)) {
      throw new Error(`Invalid S3 key format: ${jobData.s3Key}`);
    }

    // Validate document type
    if (!jobData.documentType || jobData.documentType.trim().length === 0) {
      throw new Error('Document type cannot be empty');
    }
  }

  /**
   * Extract detailed error information from SQS errors
   * @param error - The error to analyze
   * @returns Structured error details
   */
  private extractSqsErrorDetails(error: unknown): {
    code: string;
    message: string;
    type: string;
    retryable: boolean;
  } {
    if (error instanceof SQSServiceException) {
      return {
        code: error.name || 'UNKNOWN_SQS_ERROR',
        message: error.message || 'Unknown SQS service error',
        type: 'SQS_SERVICE_EXCEPTION',
        retryable: this.isRetryableSqsError(error.name),
      };
    }

    if (error instanceof Error) {
      // Check for common AWS SDK errors
      if (error.message.includes('NetworkingError') || error.message.includes('TimeoutError')) {
        return {
          code: 'NETWORK_ERROR',
          message: error.message,
          type: 'NETWORK_EXCEPTION',
          retryable: true,
        };
      }

      if (
        error.message.includes('CredentialsError') ||
        error.message.includes('SignatureDoesNotMatch')
      ) {
        return {
          code: 'CREDENTIALS_ERROR',
          message: error.message,
          type: 'AUTHENTICATION_EXCEPTION',
          retryable: false,
        };
      }

      return {
        code: 'GENERIC_ERROR',
        message: error.message,
        type: 'GENERIC_EXCEPTION',
        retryable: false,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      type: 'UNKNOWN_EXCEPTION',
      retryable: false,
    };
  }

  /**
   * Determine if an SQS error is retryable
   * @param errorName - The SQS error name
   * @returns Whether the error is retryable
   */
  private isRetryableSqsError(errorName?: string): boolean {
    if (!errorName) return false;

    const retryableErrors = [
      'ServiceUnavailable',
      'InternalError',
      'RequestTimeout',
      'ThrottlingException',
      'ProvisionedThroughputExceededException',
    ];

    return retryableErrors.includes(errorName);
  }
}
