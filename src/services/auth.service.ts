import type { IncomingHttpHeaders } from 'http';
import { Role, UserActivationStatus } from '@prisma/client';
import { AppError } from '../errors/appError';
import { BetterAuthService } from './better-auth.service';
import { UserRepository } from '../repositories/user.repository';
import { CompanyRepository } from '../repositories/company.repository';
import type {
  LoginDto,
  SocialFinalizeDto,
  SocialProviderDto,
  SocialSignInStartDto
} from '../dto/auth.dto';
import type { SessionPayload } from '../types/auth';
import { normalizeSlug } from '../utils/slug';
import { env } from '../config/env';

export class AuthService {
  constructor(
    private readonly betterAuthService: BetterAuthService,
    private readonly userRepository: UserRepository,
    private readonly companyRepository: CompanyRepository
  ) {}

  private mapAuthUser(
    user: NonNullable<Awaited<ReturnType<UserRepository['findById']>>>
  ) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      companySlug: user.company?.slug ?? null,
      isActive: user.isActive
    };
  }

  private resolvePostLoginPath(
    user: NonNullable<Awaited<ReturnType<UserRepository['findById']>>>
  ): string {
    if (user.role === Role.ADMIN) {
      return '/admin/companies';
    }

    if (user.company?.slug) {
      return `/admin/companies/${user.company.slug}`;
    }

    return '/admin/companies';
  }

  async login(input: LoginDto, headers: IncomingHttpHeaders) {
    const user = await this.userRepository.findByEmail(input.email);

    if (!user || !user.isActive) {
      throw new AppError('Credenciales inválidas', 401, 'INVALID_EMAIL_OR_PASSWORD');
    }

    const normalizedCompanySlug = input.companySlug
      ? normalizeSlug(input.companySlug)
      : undefined;

    if (typeof input.companySlug === 'string' && !normalizedCompanySlug) {
      throw new AppError('Slug de empresa inválido', 400, 'INVALID_COMPANY_SLUG');
    }

    const companyContext = normalizedCompanySlug
      ? await this.companyRepository.findPublicContextBySlug(normalizedCompanySlug)
      : null;

    if (normalizedCompanySlug && !companyContext) {
      throw new AppError('Empresa no encontrada', 404, 'COMPANY_NOT_FOUND');
    }

    if (user.role === Role.CLIENT_ADMIN) {
      if (!user.companyId || !user.company) {
        throw new AppError('Usuario cliente sin empresa asignada', 403, 'CLIENT_ADMIN_NO_COMPANY');
      }

      if (user.company.status === 'INACTIVE') {
        throw new AppError('La empresa está inactiva', 403, 'COMPANY_INACTIVE');
      }

      if (normalizedCompanySlug && user.company.slug !== normalizedCompanySlug) {
        throw new AppError('Credenciales inválidas para este contexto', 401, 'INVALID_COMPANY_CONTEXT');
      }
    }

    if (user.role === Role.ADMIN && normalizedCompanySlug) {
      throw new AppError('El ADMIN global no inicia por slug de empresa', 403, 'ADMIN_GLOBAL_LOGIN_ONLY');
    }

    const result = await this.betterAuthService.signInWithEmail({
      email: input.email,
      password: input.password,
      rememberMe: input.rememberMe,
      headers
    });

    await this.userRepository.touchLastLogin(user.id);

    return {
      ...result,
      response: {
        ...result.response,
        user: this.mapAuthUser(user)
      }
    };
  }

  async logout(headers: IncomingHttpHeaders) {
    return this.betterAuthService.signOut(headers);
  }

  async startSocialSignIn(input: {
    provider: SocialProviderDto;
    payload: SocialSignInStartDto;
    headers: IncomingHttpHeaders;
  }) {
    const normalizedCompanySlug = input.payload.companySlug
      ? normalizeSlug(input.payload.companySlug)
      : undefined;

    if (typeof input.payload.companySlug === 'string' && !normalizedCompanySlug) {
      throw new AppError('Slug de empresa inválido', 400, 'INVALID_COMPANY_SLUG');
    }

    if (normalizedCompanySlug) {
      const companyContext =
        await this.companyRepository.findPublicContextBySlug(normalizedCompanySlug);

      if (!companyContext) {
        throw new AppError('Empresa no encontrada', 404, 'COMPANY_NOT_FOUND');
      }

      if (companyContext.status === 'INACTIVE' || companyContext.status === 'PENDING_SETUP') {
        throw new AppError(
          'La empresa no tiene acceso habilitado todavía',
          403,
          'COMPANY_CONTEXT_NOT_ACTIVE'
        );
      }
    }

    const callbackURL = new URL('/auth/social/callback', env.FRONTEND_URL);
    callbackURL.searchParams.set('provider', input.provider);

    if (normalizedCompanySlug) {
      callbackURL.searchParams.set('companySlug', normalizedCompanySlug);
    }

    const loginPath = normalizedCompanySlug
      ? `/${encodeURIComponent(normalizedCompanySlug)}/login`
      : '/login';

    const errorCallbackURL = new URL(loginPath, env.FRONTEND_URL);

    const result = await this.betterAuthService.signInWithSocial({
      provider: input.provider,
      callbackURL: callbackURL.toString(),
      errorCallbackURL: errorCallbackURL.toString(),
      headers: input.headers
    });

    const url = typeof result.response.url === 'string' ? result.response.url : null;

    if (!url) {
      throw new AppError(
        'No se pudo iniciar el acceso con proveedor social',
        500,
        'SOCIAL_SIGN_IN_URL_MISSING'
      );
    }

    return {
      ...result,
      response: {
        provider: input.provider,
        url
      }
    };
  }

  async finalizeSocialSignIn(input: SocialFinalizeDto, headers: IncomingHttpHeaders) {
    const normalizedCompanySlug = input.companySlug
      ? normalizeSlug(input.companySlug)
      : undefined;

    if (typeof input.companySlug === 'string' && !normalizedCompanySlug) {
      throw new AppError('Slug de empresa inválido', 400, 'INVALID_COMPANY_SLUG');
    }

    const companyContext = normalizedCompanySlug
      ? await this.companyRepository.findPublicContextBySlug(normalizedCompanySlug)
      : null;

    if (normalizedCompanySlug && !companyContext) {
      throw new AppError('Empresa no encontrada', 404, 'COMPANY_NOT_FOUND');
    }

    const session = await this.betterAuthService.getSession(headers);

    if (!session) {
      throw new AppError(
        'No se pudo completar el acceso social. Intenta nuevamente.',
        401,
        'SOCIAL_SESSION_NOT_FOUND'
      );
    }

    let user = await this.userRepository.findById(session.user.id);

    if (!user) {
      throw new AppError('Sesión inválida', 401, 'SESSION_USER_INVALID');
    }

    let activatedBySocialLogin = false;

    if (user.activationStatus === UserActivationStatus.INACTIVO) {
      throw new AppError('Tu usuario está inactivo. Contacta al ADMIN.', 403, 'USER_INACTIVE');
    }

    if (!user.isActive && user.activationStatus !== UserActivationStatus.PENDIENTE_ACTIVACION) {
      throw new AppError('Tu usuario está inactivo. Contacta al ADMIN.', 403, 'USER_INACTIVE');
    }

    if (user.role === Role.CLIENT_ADMIN) {
      if (!user.companyId || !user.company) {
        throw new AppError('Usuario cliente sin empresa asignada', 403, 'CLIENT_ADMIN_NO_COMPANY');
      }

      if (user.company.status === 'INACTIVE') {
        throw new AppError('La empresa está inactiva', 403, 'COMPANY_INACTIVE');
      }

      if (normalizedCompanySlug && user.company.slug !== normalizedCompanySlug) {
        throw new AppError(
          'Esta cuenta no pertenece a esta empresa o contexto.',
          403,
          'INVALID_COMPANY_CONTEXT'
        );
      }

      if (companyContext && companyContext.status !== 'ACTIVE') {
        throw new AppError(
          'La empresa no tiene acceso habilitado todavía',
          403,
          'COMPANY_CONTEXT_NOT_ACTIVE'
        );
      }
    }

    if (user.role === Role.ADMIN && normalizedCompanySlug) {
      throw new AppError(
        'El ADMIN global debe ingresar desde el acceso de plataforma',
        403,
        'ADMIN_GLOBAL_LOGIN_ONLY'
      );
    }

    if (
      user.role === Role.CLIENT_ADMIN &&
      user.activationStatus === UserActivationStatus.PENDIENTE_ACTIVACION
    ) {
      await this.userRepository.updateById(user.id, {
        activationStatus: UserActivationStatus.ACTIVO,
        isActive: true,
        emailVerified: true
      });

      user = await this.userRepository.findById(user.id);

      if (!user) {
        throw new AppError('Sesión inválida', 401, 'SESSION_USER_INVALID');
      }

      activatedBySocialLogin = true;
    }

    await this.userRepository.touchLastLogin(user.id);

    return {
      user: this.mapAuthUser(user),
      redirectPath: this.resolvePostLoginPath(user),
      activatedBySocialLogin
    };
  }

  async me(headers: IncomingHttpHeaders) {
    const session = await this.betterAuthService.getSession(headers);

    if (!session) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const user = await this.userRepository.findById(session.user.id);

    if (!user || !user.isActive) {
      throw new AppError('Sesión inválida', 401, 'SESSION_USER_INVALID');
    }

    return {
      session,
      user: this.mapAuthUser(user)
    };
  }

  async getSessionPayload(headers: IncomingHttpHeaders): Promise<SessionPayload> {
    const session = await this.betterAuthService.getSession(headers);

    if (!session) {
      throw new AppError('No autenticado', 401, 'SESSION_NOT_FOUND');
    }

    const user = await this.userRepository.findById(session.user.id);

    if (!user || !user.isActive) {
      throw new AppError('Sesión inválida', 401, 'SESSION_USER_INVALID');
    }

    return {
      session: {
        id: session.session.id,
        token: session.session.token,
        userId: session.session.userId,
        expiresAt: session.session.expiresAt
      },
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companySlug: user.company?.slug ?? null,
        isActive: user.isActive
      }
    };
  }

  async getCompanyContextBySlug(slug: string) {
    const normalizedSlug = normalizeSlug(slug);

    if (!normalizedSlug) {
      throw new AppError('Slug inválido', 400, 'INVALID_COMPANY_SLUG');
    }

    const company = await this.companyRepository.findPublicContextBySlug(normalizedSlug);

    if (!company) {
      throw new AppError('Empresa no encontrada', 404, 'COMPANY_NOT_FOUND');
    }

    return company;
  }
}
