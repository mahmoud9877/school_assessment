import {
  applyDecorators,
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  type ApiBodyOptions,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Auth } from '../auth/auth.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { UserRole } from '../generated/prisma/enums.js';
import { MAX_IMPORT_ROWS } from './csv.js';
import {
  ImportErrorResponseDto,
  ImportResultDto,
} from './dto/import-response.dto.js';
import { COLUMNS } from './dto/import-rows.dto.js';
import { ImportsService } from './imports.service.js';

const MAX_FILE_BYTES = 1024 * 1024;

// The two fields of an uploaded file this controller uses.
type UploadedCsv = { originalname: string; buffer: Buffer };

const fileBody: ApiBodyOptions = {
  schema: {
    type: 'object',
    required: ['file'],
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

// Accepts one multipart field "file" (max 1 MB) and documents it.
const CsvUpload = () =>
  applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody(fileBody),
    UseInterceptors(
      FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES } }),
    ),
  );

const describe = (columns: readonly string[], details: string) =>
  `CSV header: \`${columns.join(',')}\`. ${details}\n\n` +
  `All-or-nothing: if any row is invalid, nothing is imported and the response ` +
  `lists every error by line number. At most ${MAX_IMPORT_ROWS} rows and 1 MB.`;

// Guards run before the upload interceptor, so non-admins cannot even upload.
@ApiTags('Import (admin)')
@ApiCreatedResponse({ type: ImportResultDto })
@ApiBadRequestResponse({
  description: 'Missing file, bad header, or invalid rows',
  type: ImportErrorResponseDto,
})
@ApiPayloadTooLargeResponse({
  description: 'File over 1 MB',
  type: ErrorResponseDto,
})
@Auth()
@Roles(UserRole.ADMIN)
@Controller('import')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @ApiOperation({
    summary: 'Import teachers',
    description: describe(
      COLUMNS.teachers,
      'Creates a TEACHER account and teacher record per row. Emails must be new. ' +
        'Imported accounts cannot log in until a password is set.',
    ),
  })
  @CsvUpload()
  @Post('teachers')
  importTeachers(@UploadedFile() file?: UploadedCsv) {
    return this.importsService.importTeachers(requireCsv(file));
  }

  @ApiOperation({
    summary: 'Import classes',
    description: describe(
      COLUMNS.classes,
      'Creates a class per row. Names must be new; teacherEmail must belong to an existing teacher.',
    ),
  })
  @CsvUpload()
  @Post('classes')
  importClasses(@UploadedFile() file?: UploadedCsv) {
    return this.importsService.importClasses(requireCsv(file));
  }

  @ApiOperation({
    summary: 'Import students',
    description: describe(
      COLUMNS.students,
      'Creates a STUDENT account per row and enrols it in the named class, ' +
        'respecting class capacity. Emails must be new. ' +
        'Imported accounts cannot log in until a password is set.',
    ),
  })
  @CsvUpload()
  @Post('students')
  importStudents(@UploadedFile() file?: UploadedCsv) {
    return this.importsService.importStudents(requireCsv(file));
  }
}

function requireCsv(file?: UploadedCsv): Buffer {
  if (!file) {
    throw new BadRequestException('Upload a CSV file in the "file" field');
  }
  if (!file.originalname.toLowerCase().endsWith('.csv')) {
    throw new BadRequestException('File must have a .csv extension');
  }
  return file.buffer;
}
