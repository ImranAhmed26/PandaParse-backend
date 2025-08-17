import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DocumentDeletionPreviewDto {
  @ApiProperty({
    description: 'Document information',
    example: {
      id: 'doc-uuid',
      fileName: 'invoice.pdf',
    },
  })
  document!: {
    id: string;
    fileName: string;
  };

  @ApiPropertyOptional({
    description: 'Upload information (if exists)',
    example: {
      id: 'upload-uuid',
      fileName: 'invoice.pdf',
      fileSize: 1024000,
    },
  })
  upload?: {
    id: string;
    fileName: string;
    fileSize?: number | null;
  } | null;

  @ApiPropertyOptional({
    description: 'Job information (if exists)',
    example: {
      id: 'job-uuid',
      type: 'INVOICE',
      status: 'success',
    },
  })
  job?: {
    id: string;
    type: string;
    status: string;
  } | null;

  @ApiPropertyOptional({
    description: 'Document result information (if exists)',
    example: {
      id: 'result-uuid',
      jsonUrl: 's3://bucket/results.json',
      csvUrl: 's3://bucket/results.csv',
    },
  })
  documentResult?: {
    id: string;
    jsonUrl?: string | null;
    csvUrl?: string | null;
  } | null;

  @ApiProperty({
    description: 'Invoice items that will be deleted',
    type: 'array',
    example: [
      {
        id: 'item-uuid',
        name: 'Product A',
        total: 100.0,
      },
    ],
  })
  invoiceItems!: Array<{
    id: string;
    name?: string | null;
    total?: number | null;
  }>;

  @ApiProperty({
    description: 'Number of workspace associations',
    example: 2,
  })
  workspaceAssociations!: number;

  @ApiProperty({
    description: 'Total number of database records that will be deleted',
    example: 8,
  })
  totalRecordsToDelete!: number;
}
