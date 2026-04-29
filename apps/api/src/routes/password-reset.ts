/**
 * Password reset routes — F2.
 * POST /api/v1/auth/forgot-password — generate single-use token, send email
 * POST /api/v1/auth/reset-password  — validate token, update password
 * Rate-limited: max 3 reset requests per email per hour.
 */
import type { FastifyInstance } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { pool } from '../db.js';
import { hashPassword } from '../auth.js';

// ── Rate limiter (in-memory, resets on restart) ───────────────────────────────
const resetRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RESET_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RESET_RATE_MAX = 3;

function checkResetRateLimit(email: string): boolean {
  const now = Date.now();
  const key = `reset:${email}`;
  const entry = resetRateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    resetRateLimitMap.set(key, { count: 1, resetAt: now + RESET_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RESET_RATE_MAX) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of resetRateLimitMap) {
    if (now > v.resetAt) resetRateLimitMap.delete(k);
  }
}, 60 * 60 * 1000);

// ── Email sender ──────────────────────────────────────────────────────────────
async function sendResetEmail(toEmail: string, resetUrl: string): Promise<void> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const fromAddress = process.env.SMTP_FROM ?? 'noreply@huntledger.se';

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.log(`[PASSWORD RESET] Reset link for ${toEmail}: ${resetUrl}`);
    return;
  }

  const nodemailer = await import('nodemailer');
  const transporter = (nodemailer as any).createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const emailBody =
    `Hej,\n\nDu har begärt att återställa ditt lösenord för HuntLog.\n\n` +
    `Klicka på länken nedan för att skapa ett nytt lösenord (giltig i 1 timme):\n\n` +
    `${resetUrl}\n\n` +
    `Om du inte begärde detta kan du ignorera detta mail.\n` +
    `Länken slutar gälla efter 1 timme.\n\n/ HuntLog`;

  await transporter.sendMail({
    from: fromAddress,
    to: toEmail,
    subject: 'Återställ ditt lösenord — HuntLog',
    text: emailBody,
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────
export async function registerPasswordResetRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/auth/forgot-password
  app.post('/api/v1/auth/forgot-password', async (req, reply) => {
    const GENERIC_MSG = 'Om kontot finns skickas ett mail';
    const body = req.body as { email?: string };
    const email = body.email?.toLowerCase().trim();

    if (!email) {
      return reply.status(400).send({ error: 'E-postadress krävs' });
    }

    if (!checkResetRateLimit(email)) {
      return reply.send({ message: GENERIC_MSG });
    }

    const client = await pool.connect();
    try {
      const userResult = await client.query(
        'SELECT id FROM users WHERE LOWER(email) = $1',
        [email],
      );

      if (userResult.rows.length === 0) {
        return reply.send({ message: GENERIC_MSG });
      }

      const userId = userResult.rows[0].id;

      // Generate secure random token
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      // Invalidate any previous tokens for this user
      await client.query(
        'DELETE FROM password_reset_tokens WHERE user_id = $1',
        [userId],
      );

      // Store hashed token (expires in 1 hour)
      await client.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
        [userId, tokenHash],
      );

      // Build reset URL — use APP_BASE_URL or fall back to huntlog domain
      const baseUrl = (process.env.APP_BASE_URL ?? 'https://huntlog-e293.polsia.app').replace(/\/$/, '');
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

      // Send email — non-blocking, don't fail the request if email fails
      sendResetEmail(email, resetUrl).catch(err => {
        console.error('Password reset email failed:', err.message);
      });

      return reply.send({ message: GENERIC_MSG });
    } finally {
      client.release();
    }
  });

  // POST /api/v1/auth/reset-password
  app.post('/api/v1/auth/reset-password', async (req, reply) => {
    const body = req.body as { token?: string; password?: string };
    const { token, password } = body;

    if (!token || !password) {
      return reply.status(400).send({ error: 'Token och lösenord krävs' });
    }
    if (password.length < 6) {
      return reply.status(400).send({ error: 'Lösenordet måste vara minst 6 tecken' });
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, user_id FROM password_reset_tokens
         WHERE token_hash = $1
           AND expires_at > NOW()
           AND used_at IS NULL`,
        [tokenHash],
      );

      if (result.rows.length === 0) {
        return reply.status(400).send({ error: 'Ogiltig eller utgången länk. Begär en ny.' });
      }

      const { id: tokenId, user_id: userId } = result.rows[0];

      const newHash = await hashPassword(password);
      await client.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newHash, userId],
      );

      // Invalidate token (mark as used)
      await client.query(
        'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
        [tokenId],
      );

      return reply.send({ message: 'Lösenordet har uppdaterats' });
    } finally {
      client.release();
    }
  });
}
