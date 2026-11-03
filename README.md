# Card Validator Email Backend (no database)

This Express backend sends an email notification containing only non-sensitive verification metadata. It does not use MongoDB, SQLite, or any other database.

## Requirements
- Node.js 20+
- SMTP credentials from an email provider

## Setup
1. Extract the folder and run `npm install`.
2. Copy `.env.example` to `.env`.
3. Fill in SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, and SUBMISSION_EMAIL.
4. Set CORS_ORIGINS to the exact frontend origin(s).
5. Run `npm run dev` locally or `npm start` in production.

## Endpoints
- `GET /api/health`
- `GET /api/gift-cards`
- `POST /api/submissions`

## POST /api/submissions example
```json
{
  "cardId": "amazon",
  "currency": "USD",
  "amount": 50,
  "purchaseDate": "2026-11-03",
  "reference": "receipt-reference-123",
  "notes": "Optional note"
}
```

The request schema is strict. It rejects any additional fields. Do not collect or email gift-card redemption codes, PINs, payment-card CVVs, passwords, or other financial credentials. Use the issuer's official verification channel for sensitive checks.

## Deployment
Set all environment variables in your hosting provider's server-side environment settings. Never expose SMTP credentials in frontend code or variables prefixed with VITE_. Use a dedicated SMTP/app password and restrict access to the receiving inbox.
