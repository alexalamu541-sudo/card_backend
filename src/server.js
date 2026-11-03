import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { catalog } from './catalog.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',').map(x => x.trim()).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Origin not allowed'));
  }
}));
app.use(express.json({ limit: '10kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }));

const submissionSchema = z.object({
  cardId: z.string().min(1).max(60),
  currency: z.string().regex(/^[A-Z]{3}$/),
  amount: z.number().positive().max(100000),
  purchaseDate: z.string().max(30).optional().or(z.literal('')),
  reference: z.string().max(100).optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal(''))
}).strict();

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

const transporter = nodemailer.createTransport({
  host: requiredEnv('SMTP_HOST'),
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: requiredEnv('SMTP_USER'),
    pass: requiredEnv('SMTP_PASS')
  }
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/gift-cards', (_req, res) => {
  res.json({ items: catalog });
});

app.post('/api/submissions', async (req, res, next) => {
  try {
    // Strict allowlist: code/PIN/CVV/password fields and all unknown fields are rejected.
    const input = submissionSchema.parse(req.body);
    const card = catalog.find(item => item.id === input.cardId);
    if (!card) return res.status(400).json({ error: 'Unknown gift card brand' });
    if (!card.currencies.includes(input.currency)) {
      return res.status(400).json({ error: 'Unsupported currency for this brand' });
    }

    const receivedAt = new Date().toISOString();
    const safeText = [
      'New gift-card verification request (non-sensitive details only)',
      `Brand: ${card.name}`,
      `Currency: ${input.currency}`,
      `Amount: ${input.amount}`,
      `Purchase date: ${input.purchaseDate || 'Not provided'}`,
      `Receipt/reference: ${input.reference || 'Not provided'}`,
      `Notes: ${input.notes || 'Not provided'}`,
      `Received at: ${receivedAt}`
    ].join('\n');

    await transporter.sendMail({
      from: requiredEnv('SMTP_FROM'),
      to: requiredEnv('SUBMISSION_EMAIL'),
      subject: `Verification request: ${card.name}`,
      text: safeText
    });

    res.status(202).json({ ok: true, message: 'Your details were sent successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid submission. Only the listed non-sensitive fields are accepted.',
        fields: error.issues.map(issue => issue.path.join('.'))
      });
    }
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  // Do not log request bodies or user-submitted details.
  console.error(`Request failed: ${error.message}`);
  res.status(error.message?.includes('Origin') ? 403 : 500)
    .json({ error: 'Unable to process the request right now.' });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Email API listening on port ${port}`));
