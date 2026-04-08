import type { IncomingMessage, ServerResponse } from 'http';
import { env } from '../config/env';
import { prisma } from './prisma';

type BetterAuthModule = typeof import('better-auth');
type BetterAuthPrismaAdapterModule = typeof import('better-auth/adapters/prisma');
type BetterAuthNodeIntegrationModule = typeof import('better-auth/node');

const importModule = new Function(
  'modulePath',
  'return import(modulePath)'
) as (modulePath: string) => Promise<unknown>;

type BetterAuthInstance = {
  api: {
    signInEmail: (context: unknown) => Promise<unknown>;
    signInSocial: (context: unknown) => Promise<unknown>;
    signOut: (context: unknown) => Promise<unknown>;
    getSession: (context: unknown) => Promise<unknown>;
  };
  $context: Promise<{
    password: {
      hash: (password: string) => Promise<string>;
    };
  }>;
};

type BetterAuthNodeHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<void> | void;
type BetterAuthNodeInput = {
  handler: (request: Request) => Promise<Response>;
} | ((request: Request) => Promise<Response>);

let authInstancePromise: Promise<BetterAuthInstance> | null = null;
let authNodeHandlerPromise: Promise<BetterAuthNodeHandler> | null = null;

export const getAuth = async (): Promise<BetterAuthInstance> => {
  if (!authInstancePromise) {
    authInstancePromise = (async () => {
      const [betterAuthModule, prismaAdapterModule] = (await Promise.all([
        importModule('better-auth'),
        importModule('better-auth/adapters/prisma')
      ])) as [BetterAuthModule, BetterAuthPrismaAdapterModule];

      const { betterAuth } = betterAuthModule;
      const { prismaAdapter } = prismaAdapterModule;

      return betterAuth({
        appName: 'talentum',
        baseURL: env.AUTH_BASE_URL,
        basePath: '/api/auth/internal',
        secret: env.AUTH_SECRET,
        trustedOrigins: Array.from(new Set([env.FRONTEND_URL, ...env.CORS_ORIGINS])),
        database: prismaAdapter(prisma, {
          provider: 'mysql'
        }),
        emailAndPassword: {
          enabled: true,
          disableSignUp: true
        },
        socialProviders: {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            disableSignUp: true,
            disableImplicitSignUp: true,
            prompt: 'select_account'
          },
          microsoft: {
            clientId: env.MICROSOFT_CLIENT_ID,
            clientSecret: env.MICROSOFT_CLIENT_SECRET,
            tenantId: env.MICROSOFT_TENANT_ID,
            disableSignUp: true,
            disableImplicitSignUp: true,
            prompt: 'select_account'
          }
        },
        account: {
          accountLinking: {
            enabled: true,
            trustedProviders: ['google', 'microsoft']
          }
        },
        session: {
          expiresIn: 60 * 60 * 24 * 7,
          updateAge: 60 * 60 * 24,
          cookieCache: {
            enabled: true,
            maxAge: 60 * 5
          }
        },
        // We intentionally use httpOnly cookie sessions for web security:
        // cookies are not readable by JS, reducing XSS token theft risk vs localStorage JWTs.
        user: {
          additionalFields: {
            role: {
              type: 'string',
              required: true,
              input: false
            },
            companyId: {
              type: 'string',
              required: false,
              input: false
            },
            isActive: {
              type: 'boolean',
              required: true,
              input: false,
              defaultValue: true
            }
          }
        },
        advanced: {
          useSecureCookies: env.NODE_ENV === 'production',
          defaultCookieAttributes: {
            httpOnly: true,
            sameSite: 'lax',
            secure: env.NODE_ENV === 'production'
          }
        }
      }) as unknown as BetterAuthInstance;
    })();
  }

  return authInstancePromise as Promise<BetterAuthInstance>;
};

export const getAuthNodeHandler = async (): Promise<BetterAuthNodeHandler> => {
  if (!authNodeHandlerPromise) {
    authNodeHandlerPromise = (async () => {
      const [auth, nodeIntegrationModule] = (await Promise.all([
        getAuth(),
        importModule('better-auth/node')
      ])) as [BetterAuthInstance, BetterAuthNodeIntegrationModule];

      return nodeIntegrationModule.toNodeHandler(auth as unknown as BetterAuthNodeInput);
    })();
  }

  return authNodeHandlerPromise;
};

export const hashPassword = async (password: string): Promise<string> => {
  const auth = await getAuth();
  const context = await auth.$context;
  return context.password.hash(password);
};
