import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentResultStatus } from './document-result-response.dto';

export class UpdateDocumentResultStatusDto {
  @ApiProperty({ enum: DocumentResultStatus, description: 'New status for the document result' })
  @IsEnum(DocumentResultStatus)
  status!: DocumentResultStatus;

  @ApiPropertyOptional({ description: 'User ID who is approving (required for approved status)' })
  @IsString()
  @IsOptional()
  approvedById?: string;
}
