# Custom SMTP + email templates (Supabase project `bineisa`)

Project ref: `rnbomgxmurdnwmvgklru` · Dashboard: https://supabase.com/dashboard/project/rnbomgxmurdnwmvgklru

Until custom SMTP is on, Supabase's built-in mailer is the only sender. It is meant for
development only: it delivers reliably just to project team addresses and is capped at a
couple of messages an hour, so public sign-ups fail or silently never arrive.

---

## 1. Get SMTP credentials (needs a provider account — do this part yourself)

Any SMTP provider works. Recommended for the UAE + free tier:

| Provider | Free tier | Host | Port |
|---|---|---|---|
| **Resend** (simplest) | 3,000/month | `smtp.resend.com` | `465` |
| Brevo | 300/day | `smtp-relay.brevo.com` | `587` |
| SendGrid | 100/day | `smtp.sendgrid.net` | `587` |

Steps (Resend): create the account → **Domains → Add Domain** → add the DNS records it
shows (SPF/DKIM at your domain registrar) → wait for "Verified" → **API Keys → Create**.
For SMTP: username is `resend`, password is the API key.

> Verify a real domain rather than sending from a free mailbox — unverified senders land
> in spam, which for a one-time-code email means members simply cannot sign in.

## 2. Enter them in Supabase

**Authentication → Emails → SMTP Settings → Enable custom SMTP**

| Field | Value |
|---|---|
| Sender email | `no-reply@bineisa.ae` (must be on the verified domain) |
| Sender name | `Bin Eisa General Trading` |
| Host | provider host from the table |
| Port | `465` (Resend) or `587` |
| Username | provider username (`resend` for Resend) |
| Password | the provider API key — paste it here, in the dashboard |

Then **Authentication → Rate Limits** → raise "Emails per hour" from the default (`2`)
to something usable, e.g. `100`.

## 3. Paste the two templates

**Authentication → Emails → Templates.** Both matter — Supabase picks a different one
depending on whether the address is new:

| Template | When the site triggers it | File |
|---|---|---|
| **Confirm signup** | a new member registers (`shouldCreateUser: true`) | `confirm-signup.html` |
| **Magic Link** | an existing member signs in | `magic-link.html` |

Editing only one leaves half the members without a visible code. Each template must keep
`{{ .Token }}` — that is the 6-digit code the site's second step asks for.

Subject lines:
- Confirm signup: `Your Bin Eisa confirmation code` — `رمز تأكيد حسابك في بن عيسى`
- Magic Link: `Your Bin Eisa sign-in code` — `رمز الدخول إلى بن عيسى`

## 4. Point auth at the live site

**Authentication → URL Configuration**

- Site URL: `https://bineisa.ae` (or the current `http://bineisa.116.203.231.112.sslip.io`)
- Redirect URLs: add `https://bineisa.ae/auth/login.html` and
  `http://bineisa.116.203.231.112.sslip.io/auth/login.html`

Without this, the fallback sign-in link in the email points at the wrong host.

## 5. Verify

Register at `/auth/register` with an address that is **not** a Supabase team member.
The code email should arrive within seconds; entering it should land on `/account/`.

```sql
-- confirm the account and profile were created
select u.email, u.email_confirmed_at is not null as confirmed, p.full_name, p.phone
from auth.users u left join public.profiles p on p.id = u.id
order by u.created_at desc limit 5;
```

---

## SMS (optional, later)

Phone one-time codes are built but switched off. To enable: **Authentication → Providers
→ Phone**, connect Twilio/MessageBird, then set `phoneOtpEnabled: true` in
`assets/config.js`. UAE SMS sender IDs need TDRA registration through the provider.
