import { ApiProperty } from '@nestjs/swagger';

// Shape of every error response produced by Nest's exception layer.
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Class #42 not found',
    description: 'A message, or a list of validation messages.',
  })
  message: string | string[];

  @ApiProperty({ example: 'Not Found', required: false })
  error?: string;
}
