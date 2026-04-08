import type { Request, Response } from 'express';
import { errorResponse } from '../utils/apiResponse';

export const notFoundHandler = (req: Request, res: Response) => {
  res
    .status(404)
    .json(
      errorResponse(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 'NOT_FOUND')
    );
};
