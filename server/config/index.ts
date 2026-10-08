/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  JWT_SECRET: z.string().default('ropenix_jwt_secure_session_secret_2026'),
  OTP_HMAC_SECRET: z.string().default('ropenix_secure_otp_hmac_secret_2026_key'),
  VITE_API_BASE_URL: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('[Config Error] Invalid environment configuration:', parsedEnv.error.format());
}

export const config = {
  env: parsedEnv.success ? parsedEnv.data.NODE_ENV : 'development',
  isProduction: (parsedEnv.success ? parsedEnv.data.NODE_ENV : 'development') === 'production',
  isDev: (parsedEnv.success ? parsedEnv.data.NODE_ENV : 'development') !== 'production',
  port: parsedEnv.success ? (Number(parsedEnv.data.PORT) || 3000) : 3000,
  secrets: {
    jwt: parsedEnv.success ? parsedEnv.data.JWT_SECRET : 'ropenix_jwt_secure_session_secret_2026',
    otpHmac: parsedEnv.success ? parsedEnv.data.OTP_HMAC_SECRET : 'ropenix_secure_otp_hmac_secret_2026_key',
  },
  branding: {
    name: 'Ropenix Collections',
    supportEmail: 'concierge@ropenix.co.ke',
    adminEmail: 'admin@ropenix.co.ke',
  },
};

export default config;
