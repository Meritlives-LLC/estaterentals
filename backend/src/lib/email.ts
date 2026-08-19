// backend/src/lib/email.ts

import { prisma } from './prisma'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.RESEND_FROM_EMAIL

export async function sendAdminLoginOtp(
  email: string,
  otp: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error(
      '[Email] RESEND_API_KEY is not configured.'
    )
    return false
  }

  if (!EMAIL_FROM) {
    console.error(
      '[Email] RESEND_FROM_EMAIL is not configured.'
    )
    return false
  }

  try {
    const response = await fetch(
      'https://api.resend.com/emails',
      {
        method: 'POST',

        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          from: EMAIL_FROM,

          to: [email],

          subject:
            'Your JerryHomes admin verification code',

          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8" />
                <meta
                  name="viewport"
                  content="width=device-width, initial-scale=1.0"
                />
                <title>JerryHomes Verification Code</title>
              </head>

              <body
                style="
                  margin:0;
                  padding:0;
                  background:#f3f4f6;
                  font-family:Arial,Helvetica,sans-serif;
                "
              >
                <div
                  style="
                    max-width:600px;
                    margin:40px auto;
                    background:#ffffff;
                    border-radius:12px;
                    padding:32px;
                    box-shadow:0 4px 20px rgba(0,0,0,0.08);
                  "
                >
                  <div style="text-align:center;">
                    <h1
                      style="
                        margin:0 0 8px;
                        color:#111827;
                        font-size:28px;
                      "
                    >
                      JerryHomes
                    </h1>

                    <p
                      style="
                        margin:0 0 30px;
                        color:#6b7280;
                        font-size:14px;
                      "
                    >
                      Admin Portal Verification
                    </p>
                  </div>

                  <h2
                    style="
                      color:#111827;
                      font-size:22px;
                      margin-bottom:12px;
                    "
                  >
                    Admin sign-in verification
                  </h2>

                  <p
                    style="
                      color:#374151;
                      font-size:15px;
                      line-height:1.6;
                    "
                  >
                    Use the verification code below to complete
                    your JerryHomes administrator login.
                  </p>

                  <div
                    style="
                      margin:28px 0;
                      padding:20px;
                      background:#fff7ed;
                      border:1px solid #fed7aa;
                      border-radius:10px;
                      text-align:center;
                    "
                  >
                    <div
                      style="
                        color:#f97316;
                        font-size:36px;
                        font-weight:700;
                        letter-spacing:8px;
                      "
                    >
                      ${otp}
                    </div>
                  </div>

                  <p
                    style="
                      color:#6b7280;
                      font-size:14px;
                      line-height:1.6;
                    "
                  >
                    This verification code expires in 5 minutes.
                  </p>

                  <p
                    style="
                      color:#6b7280;
                      font-size:14px;
                      line-height:1.6;
                    "
                  >
                    If you did not attempt to sign in to JerryHomes,
                    you can safely ignore this email.
                  </p>

                  <hr
                    style="
                      border:none;
                      border-top:1px solid #e5e7eb;
                      margin:28px 0;
                    "
                  />

                  <p
                    style="
                      color:#9ca3af;
                      font-size:12px;
                      text-align:center;
                      margin:0;
                    "
                  >
                    This is an automated security email from JerryHomes.
                  </p>
                </div>
              </body>
            </html>
          `,
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()

      console.error(
        '[Email] Resend request failed:',
        response.status,
        errorText
      )

      return false
    }

    const result = (await response.json().catch(() => null)) as
      | { id?: string }
      | null

    console.log(
      '[Email] Admin OTP sent successfully:',
      {
        recipient: email,
        resendId: result?.id ?? null,
      }
    )

    return true
  } catch (error) {
    console.error(
      '[Email] Failed to send OTP email:',
      error
    )

    return false
  }
}

export async function getUserEmailAddress(
  userId: string
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
    },
  })

  return user?.email ?? null
}