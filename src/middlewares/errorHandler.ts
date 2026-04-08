import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError } from '../errors/appError';
import { logger } from '../lib/logger';
import { errorResponse } from '../utils/apiResponse';
import { buildTechnicalMessage } from '../utils/errorDetails';

const externalStatusMessageMap: Record<number, string> = {
  400: 'Solicitud inválida',
  401: 'Credenciales inválidas',
  403: 'No tienes permisos para esta acción',
  404: 'Recurso no encontrado',
  409: 'Conflicto de datos'
};

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (error instanceof ZodError) {
    logger.warn('request_validation_failed', {
      requestId: req.requestId,
      route: req.originalUrl,
      method: req.method,
      details: error.flatten()
    });

    const technical =
      env.NODE_ENV === 'production'
        ? 'VALIDATION_ERROR'
        : JSON.stringify(error.flatten(), null, 2);
    res.status(400).json(errorResponse('Datos de entrada inválidos', technical));
    return;
  }

  if (error instanceof AppError) {
    logger.warn('application_error', {
      requestId: req.requestId,
      route: req.originalUrl,
      method: req.method,
      statusCode: error.statusCode,
      message: error.message,
      technicalCode: error.mensajeTecnico ?? null
    });

    const technical = (() => {
      if (env.NODE_ENV !== 'production') {
        return error.mensajeTecnico ?? error.message;
      }

      if (error.mensajeTecnico && /^[A-Z0-9_:-]+$/.test(error.mensajeTecnico)) {
        return error.mensajeTecnico;
      }

      if (error.mensajeTecnico?.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(error.mensajeTecnico);
          return JSON.stringify(parsed);
        } catch {
          return 'APPLICATION_ERROR';
        }
      }

      return 'APPLICATION_ERROR';
    })();
    res.status(error.statusCode).json(errorResponse(error.message, technical));
    return;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof (error as { status: unknown }).status === 'number'
  ) {
    const apiError = error as { status: number; message?: unknown };
    const status = apiError.status;
    const message = externalStatusMessageMap[status] ?? 'Error de autenticación';
    const technical =
      env.NODE_ENV === 'production' ? 'AUTH_PROVIDER_ERROR' : buildTechnicalMessage(error);

    logger.warn('external_auth_error', {
      requestId: req.requestId,
      route: req.originalUrl,
      method: req.method,
      statusCode: status,
      message: typeof apiError.message === 'string' ? apiError.message : null
    });

    res.status(status).json(errorResponse(message, technical));
    return;
  }

  const technicalMessage = buildTechnicalMessage(error);
  logger.error('unhandled_error', {
    requestId: req.requestId,
    route: req.originalUrl,
    method: req.method,
    technicalMessage
  });

  res
    .status(500)
    .json(
      errorResponse(
        'Ocurrió un error interno del servidor',
        env.NODE_ENV === 'production' ? 'INTERNAL_SERVER_ERROR' : technicalMessage
      )
    );
};
