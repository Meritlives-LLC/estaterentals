import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export const OTP_LENGTH = 6
export const OTP_TTL_MS = 5 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000
export const OTP_PURPOSE_ADMIN_LOGIN = 'ADMIN_LOGIN'

export function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString().padStart(OTP_LENGTH, '0')
}

export async function hashOtp(code: string) {
  return bcrypt.hash(code, 12)
}

export async function verifyOtpHash(code: string, hashedCode: string) {
  return bcrypt.compare(code, hashedCode)
}

export function isOtpExpired(expiresAt: Date) {
  return new Date(expiresAt).getTime() <= Date.now()
}
