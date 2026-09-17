# BIN EISA registration email setup

Project: `rnbomgxmurdnwmvgklru` ([dashboard](https://supabase.com/dashboard/project/rnbomgxmurdnwmvgklru)).

## Verified on September 17, 2026

- The project recovered to Healthy; public Auth health and settings endpoints returned HTTP 200 using the site's publishable key.
- Email and new registrations are enabled; email confirmation remains required.
- Custom SMTP is disabled. Supabase's default sender is restricted to project team addresses, so it cannot serve public registration. See [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).
- Email OTP length is **8 digits**, expiry **3,600 seconds**. The frontend accepts complete 6–10 digit codes and lets Supabase validate the exact token, supporting email and SMS without truncation.
- Site URL and allowed callbacks below were saved in the production dashboard.

## Connect the existing email provider

In **Authentication → Emails → SMTP Settings**, configure the SMTP host, port, username and password issued by the chosen email provider. Enter secrets directly in Supabase; never commit them or paste them into chat. Authenticate a sender on a domain BIN EISA owns and has verified with that provider, such as `no-reply@bineisa.com`. Use sender name **BIN EISA Stocks**.

Complete any sender/domain verification and SPF/DKIM records required by the provider. Choose the hourly email limit in Supabase to match the provider's allowance and expected traffic. Do not assume the business mailbox automatically supplies a production transactional-email service.

## Install both templates after SMTP is connected

Under **Authentication → Emails → Templates**:

| Supabase template | File | Suggested subject |
|---|---|---|
| Confirm sign up | `confirm-signup.html` | Your BIN EISA confirmation code |
| Magic link or OTP | `magic-link.html` | Your BIN EISA sign-in code |

Keep `{{ .Token }}` in both templates. New members and existing members use different templates. These files are prepared in the repository but have **not** been installed in production. Copy does not promise an expiry that could disagree with the provider configuration.

## Production destinations

- Site URL: `https://bineisastocks.com`
- Redirect: `https://bineisastocks.com/auth/login.html`
- Redirect with the app's return path: `https://bineisastocks.com/auth/login.html?next=**`

The query wildcard supports returning to a watchlist or stock after sign-in. The application separately restricts allowed return paths. The main business website remains `https://bineisa.com`; it is not the stock platform's authentication callback.

## Acceptance still required

Using an owner-authorized email address outside the Supabase team, register, receive the code, verify it, check account/profile creation, sign out, and sign in again. Check both new-member and existing-member emails and Arabic/mobile code entry. Do not claim registration is ready based on the health endpoint alone.

SMS is disabled. For a future SMS rollout, follow [AUTH-SETUP.md](../AUTH-SETUP.md) and configure `authChannel` / `allowChannelSwap` in `assets/config.js` after the SMS provider is working.
