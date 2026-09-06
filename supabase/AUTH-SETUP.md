# Auth setup — Twilio SMS one-time codes (Supabase project `bineisa`)

Project ref: `rnbomgxmurdnwmvgklru` · Dashboard: https://supabase.com/dashboard/project/rnbomgxmurdnwmvgklru

> **Launch config: email.** `assets/config.js` has `authChannel: "email"` and
> `allowChannelSwap: false`, because UAE SMS needs TDRA sender-ID registration before it
> delivers anything (see below). Set up custom SMTP to go live —
> [`email-templates/README.md`](email-templates/README.md).
>
> This document covers switching to SMS later. When Twilio is live, set
> `authChannel: "phone"` and `allowChannelSwap: true`; no other code changes are needed.
> Leave the swap off while a channel's provider is disabled, or the fallback link is a
> click that always fails.

With SMS selected, registration and sign-in send a 6-digit code by SMS and email stays an
account detail. Until the phone provider is switched on, Supabase answers
`phone_provider_disabled` and the site shows *"SMS sign-in is not switched on yet."*

---

## 1. Twilio account

1. Create the account at twilio.com and **upgrade it** — trial accounts only send to
   numbers you have verified by hand, which is useless for public sign-ups.
2. **Messaging → Services → Create Messaging Service** (name it e.g. `Bin Eisa OTP`),
   add a sender to its pool, and copy the **Messaging Service SID** (`MG…`).
3. From the console dashboard copy the **Account SID** (`AC…`) and **Auth Token**.

### Read this before buying anything — UAE delivery is regulated

The UAE is one of the strictest SMS markets in the world:

- Etisalat and du **block unregistered A2P traffic**. Sending to `+971` numbers needs a
  **sender ID registered with the TDRA**, arranged through Twilio.
- Registration requires your **trade licence** and takes days to weeks, and carriers
  charge a recurring fee for the sender ID.
- Until it is approved, codes to UAE mobiles will silently fail to deliver even though
  Twilio reports the message as sent.
- SMS to the UAE costs roughly **$0.03–0.05 per message**, so every sign-in has a real
  cost — unlike email.

Start the TDRA registration with Twilio support **before** you rely on this for launch.
If you need members signing in this week, the email channel (`authChannel: "email"` plus
custom SMTP — see `email-templates/README.md`) is the faster route.

## 2. Connect it to Supabase

**Authentication → Providers → Phone → Enable phone provider**

| Field | Value |
|---|---|
| SMS provider | Twilio |
| Twilio account SID | `AC…` |
| Twilio auth token | your auth token |
| Twilio message service SID | `MG…` |

Leave "Enable phone confirmations" on. Then edit the **SMS message template** so the code
is recognisable:

```
Bin Eisa: your verification code is {{ .Code }}. It expires in 10 minutes.
```

Keep it short — every 160 characters is billed as another segment, and Arabic text is
billed at 70 characters per segment.

## 3. Protect it — this part is not optional

An open SMS endpoint is a standing invoice. "SMS pumping" fraud drives thousands of
requests to premium-rate ranges and bills you for every one.

1. **Authentication → Attack Protection → enable Captcha** (Cloudflare Turnstile), then
   put the site key into `captchaSiteKey` in `assets/config.js`. The auth forms already
   render and submit the token when that value is set.
2. **Authentication → Rate Limits →** lower "SMS sent per hour" to something you would
   accept as a bill (e.g. 30–50 while starting out).
3. In Twilio: **Messaging → Geo permissions** — allow only the countries you serve
   (UAE plus wherever your members actually live). This alone stops most pumping.
4. Set a Twilio spend alert.

## 4. Verify

Register at `/auth/register` with a real UAE mobile. The code should arrive in seconds
and entering it should land on `/account/`.

```sql
-- the account, and the email carried through signup metadata
select u.phone, u.phone_confirmed_at is not null as phone_verified,
       p.full_name, p.email
from auth.users u left join public.profiles p on p.id = u.id
order by u.created_at desc limit 5;
```

If Twilio reports "delivered" but nothing arrives on a `+971` number, that is the sender
ID registration — not the code.

## Switching back to email

Set `authChannel: "email"` in `assets/config.js` and follow
`email-templates/README.md`. Both channels stay available to members either way through
the "use email / use mobile instead" link, as long as `allowChannelSwap` is true.
