import 'dotenv/config'

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5001),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET', 'change-me-access-secret'),
    refreshSecret: required('JWT_REFRESH_SECRET', 'change-me-refresh-secret'),
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },

  oauth: {
    stateSecret: required('OAUTH_STATE_SECRET', 'change-me-oauth-secret'),
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    googleRedirectUri:
      process.env.GOOGLE_REDIRECT_URI ??
      'http://localhost:5000/api/auth/google/callback',
  },

  ai: {
    baseUrl: process.env.AI_BASE_URL ?? '',
    serviceKey: process.env.AI_SERVICE_KEY ?? '',
  },

  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
}
