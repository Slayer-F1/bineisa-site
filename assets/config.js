/* Bin Eisa — site configuration (publishable key: safe to expose in the browser) */
window.BINEISA_CONFIG = {
  supabaseUrl: "https://rnbomgxmurdnwmvgklru.supabase.co",
  supabaseKey: "sb_publishable_5JjqQiUuj0uLfboeKoM9sg_JqleOLer",

  /* Auth: passwordless one-time codes, no passwords.
     authChannel "phone" = code by SMS (Twilio, configured in Supabase → Auth → Providers → Phone).
     authChannel "email" = code by email (needs custom SMTP).
     allowChannelSwap offers the other channel from the form — keep it false while that
     channel's provider is switched off, otherwise the link is a click that always fails.
     Turn it back on once Twilio phone auth is live in Supabase. */
  authChannel: "email",
  allowChannelSwap: false,

  /* Optional bot protection on auth forms: Cloudflare Turnstile site key.
     Also enable Turnstile in Supabase → Authentication → Attack Protection.
     Strongly recommended with SMS — every unprotected request costs real money. */
  captchaSiteKey: "",

  /* Members are signed out after this many minutes without activity. */
  idleLogoutMinutes: 15,

  /* Contact channels. Leave a value empty to show "Available soon" instead of a dead link. */
  contact: {
    email: "info@bineisa.ae",
    phoneE164: "",      // e.g. "+971501234567"
    whatsappE164: ""    // e.g. "+971501234567"
  }
};
