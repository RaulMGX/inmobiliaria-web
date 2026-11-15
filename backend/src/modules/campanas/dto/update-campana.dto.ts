import { PartialType } from '@nestjs/swagger';
import { CreateCampanaDto } from './campanas.dto';

export class UpdateCampanaDto extends PartialType(CreateCampanaDto) {}
