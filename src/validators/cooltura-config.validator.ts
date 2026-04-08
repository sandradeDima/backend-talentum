import { AppError } from '../errors/appError';
import { upsertCoolturaConfigDtoSchema } from '../dto/cooltura-config.dto';

export const validateUpsertCoolturaConfig = (body: unknown) => {
  const result = upsertCoolturaConfigDtoSchema.safeParse(body);
  if (!result.success) {
    throw new AppError(
      'Datos de entrada inválidos',
      400,
      JSON.stringify(result.error.flatten())
    );
  }
  return result.data;
};
