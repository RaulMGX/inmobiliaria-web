import { PartialType } from '@nestjs/swagger';
import { CreateComisionDto } from './create-comision.dto';

export class UpdateComisionDto extends PartialType(CreateComisionDto) {}
