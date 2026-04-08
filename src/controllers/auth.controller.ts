import type { Request, Response } from 'express';
import { authService } from '../lib/container';
import { ensureCsrfCookie } from '../middlewares/csrf.middleware';
import { successResponse } from '../utils/apiResponse';
import {
  validateLogin,
  validateSocialFinalize,
  validateSocialProvider,
  validateSocialSignInStart
} from '../validators/auth.validator';
import { appendSetCookies } from '../utils/cookies';

export class AuthController {
  async csrfToken(req: Request, res: Response) {
    const token = ensureCsrfCookie(req, res);
    res.status(200).json(
      successResponse('Token CSRF generado', {
        token,
        headerName: 'x-csrf-token'
      })
    );
  }

  async login(req: Request, res: Response) {
    const input = validateLogin(req.body);
    const result = await authService.login(input, req.headers);
    const statusCode = typeof result.status === 'number' ? result.status : 200;

    appendSetCookies(res, result.cookies);

    res
      .status(statusCode)
      .json(successResponse('Inicio de sesión exitoso', result.response));
  }

  async logout(req: Request, res: Response) {
    const result = await authService.logout(req.headers);
    const statusCode = typeof result.status === 'number' ? result.status : 200;

    appendSetCookies(res, result.cookies);

    res.status(statusCode).json(successResponse('Sesión cerrada', result.response));
  }

  async me(req: Request, res: Response) {
    const result = await authService.me(req.headers);
    res.status(200).json(successResponse('Sesión actual', result));
  }

  async companyContext(req: Request, res: Response) {
    const slugParam = req.params.slug;
    const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
    const result = await authService.getCompanyContextBySlug(slug ?? '');
    res.status(200).json(successResponse('Contexto de empresa obtenido', result));
  }

  async startSocialSignIn(req: Request, res: Response) {
    const providerParam = req.params.provider;
    const provider = validateSocialProvider(
      Array.isArray(providerParam) ? providerParam[0] : providerParam
    );
    const queryInput = validateSocialSignInStart({
      companySlug: Array.isArray(req.query.companySlug)
        ? req.query.companySlug[0]
        : req.query.companySlug
    });

    const result = await authService.startSocialSignIn({
      provider,
      payload: queryInput,
      headers: req.headers
    });

    appendSetCookies(res, result.cookies);

    res
      .status(result.status)
      .json(successResponse(`Continuar con ${provider}`, result.response));
  }

  async finalizeSocialSignIn(req: Request, res: Response) {
    const payload = validateSocialFinalize(req.body);
    const result = await authService.finalizeSocialSignIn(payload, req.headers);
    res
      .status(200)
      .json(successResponse('Acceso social validado correctamente', result));
  }
}

export const authController = new AuthController();
