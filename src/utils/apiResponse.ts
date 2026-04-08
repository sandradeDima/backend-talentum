import type { ApiError, ApiSuccess } from '../types/api';

export const successResponse = <T>(mensaje: string, data: T): ApiSuccess<T> => ({
  error: false,
  mensaje,
  data,
  mensajeTecnico: null
});

export const errorResponse = (mensaje: string, technicalMessage: string): ApiError => ({
  error: true,
  mensaje,
  data: null,
  mensajeTecnico: technicalMessage
});
