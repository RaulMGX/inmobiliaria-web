import { PartialType } from '@nestjs/swagger';
import { CreatePropiedadDto } from './create-propiedad.dto';

export class UpdatePropiedadDto extends PartialType(CreatePropiedadDto) {}

