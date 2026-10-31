import { ApiProperty } from '@nestjs/swagger';

export class ImportResultDto {
  @ApiProperty({ example: 25, description: 'Number of rows imported.' })
  imported: number;
}

class RowErrorDto {
  @ApiProperty({ example: 3, description: 'Line number in the CSV file.' })
  line: number;

  @ApiProperty({ example: 'Class "Math 101" is full (capacity 30)' })
  message: string;
}

export class ImportErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    example: 'CSV import failed with 2 error(s); nothing was imported',
  })
  message: string;

  @ApiProperty({ example: 'Bad Request' })
  error: string;

  @ApiProperty({ type: [RowErrorDto] })
  errors: RowErrorDto[];
}
