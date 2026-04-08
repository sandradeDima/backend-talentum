import type { IncomingHttpHeaders } from 'http';
import { getAuth } from '../lib/auth';
import { AppError } from '../errors/appError';
import { getSetCookieHeaders, toWebHeaders } from '../utils/httpHeaders';

export type EndpointWithCookies<T> = {
  response: T;
  status: number;
  cookies: string[];
};

type BetterAuthResponse = Record<string, unknown>;
type BetterAuthEndpointResult = {
  response?: BetterAuthResponse;
  status?: number;
  statusCode?: number;
  headers?: Headers;
};

export type SupportedSocialProvider = 'google' | 'microsoft';

type BetterAuthSessionUser = {
  id: string;
  email: string;
  name: string;
} & Record<string, unknown>;

export type BetterAuthSession = {
  session: {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
  };
  user: BetterAuthSessionUser;
} | null;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const normalizeEndpointResult = (
  rawResult: unknown
): EndpointWithCookies<BetterAuthResponse> => {
  const parsedResult: BetterAuthEndpointResult = isRecord(rawResult)
    ? (rawResult as BetterAuthEndpointResult)
    : {};

  const status = typeof parsedResult.status === 'number'
    ? parsedResult.status
    : typeof parsedResult.statusCode === 'number'
      ? parsedResult.statusCode
      : 200;

  const headers = parsedResult.headers instanceof Headers
    ? parsedResult.headers
    : new Headers();

  const response = isRecord(parsedResult.response)
    ? parsedResult.response
    : isRecord(rawResult)
      ? (rawResult as BetterAuthResponse)
      : {};

  return {
    response,
    status,
    cookies: getSetCookieHeaders(headers)
  };
};

export class BetterAuthService {
  async signInWithEmail(input: {
    email: string;
    password: string;
    rememberMe?: boolean;
    headers: IncomingHttpHeaders;
  }): Promise<EndpointWithCookies<BetterAuthResponse>> {
    const auth = await getAuth();

    const rawResult = await auth.api.signInEmail({
      body: {
        email: input.email,
        password: input.password,
        rememberMe: input.rememberMe
      },
      headers: toWebHeaders(input.headers),
      returnHeaders: true,
      returnStatus: true
    });

    return normalizeEndpointResult(rawResult);
  }

  async signOut(
    headers: IncomingHttpHeaders
  ): Promise<EndpointWithCookies<BetterAuthResponse>> {
    const auth = await getAuth();

    const rawResult = await auth.api.signOut({
      headers: toWebHeaders(headers),
      returnHeaders: true,
      returnStatus: true
    });

    return normalizeEndpointResult(rawResult);
  }

  async signInWithSocial(input: {
    provider: SupportedSocialProvider;
    callbackURL: string;
    errorCallbackURL: string;
    headers: IncomingHttpHeaders;
    loginHint?: string;
  }): Promise<EndpointWithCookies<BetterAuthResponse>> {
    const auth = await getAuth();

    const rawResult = await auth.api.signInSocial({
      body: {
        provider: input.provider,
        callbackURL: input.callbackURL,
        errorCallbackURL: input.errorCallbackURL,
        disableRedirect: true,
        requestSignUp: false,
        ...(input.loginHint ? { loginHint: input.loginHint } : {})
      },
      headers: toWebHeaders(input.headers),
      returnHeaders: true,
      returnStatus: true
    });

    return normalizeEndpointResult(rawResult);
  }

  async getSession(headers: IncomingHttpHeaders): Promise<BetterAuthSession> {
    const auth = await getAuth();

    try {
      return (await auth.api.getSession({
        headers: toWebHeaders(headers),
        asResponse: false,
        returnHeaders: false,
        returnStatus: false
      })) as BetterAuthSession;
    } catch {
      throw new AppError('No se pudo validar la sesión actual', 401, 'SESSION_INVALID');
    }
  }
}
