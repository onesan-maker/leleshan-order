# Security Notes

- Frontend reads only public, non-secret config from `config.public.js` and `public/config.public.js`.
- Local overrides belong in ignored files such as `config.js`, `public/config.js`, `.env`, or `functions/.env`.
- LINE Messaging API tokens must be injected through environment variables or Firebase Functions runtime config only.
- `node scripts/check-secrets.js` is used by the repo pre-commit hook to block known leaked tokens and common token patterns.
