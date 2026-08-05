# Security Policy

## Scope

This repository is an educational prototype. Do not use it to process private
content or production credentials without an independent security review.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability that could expose keys,
user data, or server-side network access. Use a private GitHub Security
Advisory for this repository when available, and include a minimal
reproduction, affected route, and impact.

## Secrets

- Never commit `.env`, `.env.local`, Supabase service keys, SerpApi keys, or
  Apps Script tokens.
- Keep service-role credentials in Vercel server-side environment variables.
- Rotate a token immediately if it has appeared in a commit, log, screenshot,
  or shared spreadsheet.
