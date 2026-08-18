import { prisma } from './prisma'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'noreply@jerryhomes.com'

export async function sendAdminLoginOtp(email: string, otp: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY is not configured. OTP was generated but not emailed.')
    return false
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [email],
        subject: 'Your JerryHomes admin verification code',
        html: `
          <div style="font-family: Arial, sans-serif; color: #111827;">
            <h2>Admin sign-in verification</h2>
            <p>Your verification code is:</p>
            <div style="font-size: 32px; font-weight: 700; letter-spacing: 0.25em; margin: 20px 0; color: #111827;">${otp}</div>
            <p>This code expires in 5 minutes.</p>
            <p>If you did not request this, please ignore this email.</p>
          </div>
        `,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Email] Resend request failed:', response.status, errorText)
      return false
    }

    return true
  } catch (error) {
    console.error('[Email] Failed to send OTP email:', error)
    return false
  }
}

export async function getUserEmailAddress(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })

  return user?.email ?? null
}
