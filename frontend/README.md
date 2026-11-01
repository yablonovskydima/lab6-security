# Frontend — Secure Accounts Lab

React 19 + TypeScript + Vite + React Router. Talks to the FastAPI backend over JSON with a Bearer JWT.

## Running

```bash
cp .env.example .env   # VITE_API_URL=http://localhost:8000
npm install
npm run dev            # http://localhost:5173
```

In Docker the app is built with `VITE_API_URL` (build arg) and served by nginx (`nginx.conf`: SPA fallback,
security headers, long cache for hashed assets) on http://localhost:5173 — see the [root README](../README.md).

The backend must be running and `FRONTEND_URL` in `backend/.env` must match this origin (CORS and email links).

## Structure

```
src/
├── api/
│   ├── client.ts           # fetch wrapper, Bearer token, error formatting
│   └── types.ts            # API response types
├── auth/
│   ├── AuthContext.tsx     # current user, sign in / sign out, token storage
│   └── guards.tsx          # RequireAuth, RequireAdmin, GuestOnly
├── components/             # Layout, ImageCaptcha, Captcha, PasswordStrength, Countdown, OrderList, Alert
└── pages/
    ├── LoginPage.tsx       # password step + 2FA code step, Google button, resend activation
    ├── RegisterPage.tsx    # password policy checklist, strength meter, CAPTCHA
    ├── ActivatePage.tsx    # /activate?token=… from the email
    ├── ForgotPasswordPage.tsx
    ├── ResetPasswordPage.tsx  # /reset-password?token=… from the email
    ├── OAuthCallbackPage.tsx  # /oauth/callback#access_token=… after Google
    ├── ProfilePage.tsx     # account status, change password, enable/disable 2FA
    ├── ProductsPage.tsx    # catalogue + cart + place order
    ├── MyOrdersPage.tsx
    └── admin/              # users (block/unblock, role), login log, products CRUD, all orders
```

## Pages per lab task

| Task | Where |
|---|---|
| 1. Registration, password policy, profile, logout | `/register`, `/profile`, "Log out" |
| 2. CAPTCHA | `/register` (image with distorted characters by default; Turnstile / reCAPTCHA widget if configured) |
| 3. Activation | link in the email → `/activate`; status on `/profile` |
| 4. Brute force + login log | wrong password 5× on `/login`; `/admin/login-log`, `/admin/users` |
| 5. 2FA | `/profile` → Enable 2FA; then `/login` asks for the emailed code |
| 6. Google sign-in | "Continue with Google" on `/login` |
| 7. Password reset | `/forgot-password` → link in the email → `/reset-password` |

The access token is kept in `localStorage` for simplicity; logout revokes it on the server.
