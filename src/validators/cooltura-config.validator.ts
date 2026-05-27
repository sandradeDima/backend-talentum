import { AppError } from '../errors/appError';
import { upsertCoolturaConfigDtoSchema } from '../dto/cooltura-config.dto';

const fieldLabels: Record<string, string> = {
  linkedinUrl: 'LinkedIn',
  youtubeUrl: 'YouTube',
  instagramUrl: 'Instagram',
  facebookUrl: 'Facebook',
  tiktokUrl: 'TikTok',
  whatsappLink: 'Enlace de WhatsApp',
  boliviaDireccion: 'Dirección de Bolivia',
  boliviaTelefono: 'Teléfono de Bolivia',
  boliviaEmail: 'Correo de Bolivia',
  paraguayDireccion: 'Dirección de Paraguay',
  paraguayTelefono: 'Teléfono de Paraguay',
  paraguayEmail: 'Correo de Paraguay'
};

const formatFieldError = (field: string, message: string) => {
  const label = fieldLabels[field] ?? field;

  if (message === 'URL inválida') {
    return `${label} debe tener una URL válida o quedar en blanco.`;
  }

  if (message === 'Correo inválido') {
    return `${label} debe tener un correo válido o quedar en blanco.`;
  }

  return `${label}: ${message}.`;
};

const buildValidationMessage = (
  fieldErrors: Record<string, string[] | undefined>,
  formErrors: string[]
) => {
  const details = Object.entries(fieldErrors).flatMap(([field, errors]) =>
    (errors ?? []).map((message) => formatFieldError(field, message))
  );

  details.push(...formErrors);

  if (details.length === 0) {
    return 'Revisa los datos ingresados.';
  }

  return `Revisa los datos ingresados. ${details.join(' ')}`;
};

export const validateUpsertCoolturaConfig = (body: unknown) => {
  const result = upsertCoolturaConfigDtoSchema.safeParse(body);
  if (!result.success) {
    const flattened = result.error.flatten();

    throw new AppError(
      buildValidationMessage(flattened.fieldErrors, flattened.formErrors),
      400,
      JSON.stringify(flattened)
    );
  }
  return result.data;
};
