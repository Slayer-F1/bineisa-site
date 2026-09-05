/* Bin Eisa — site configuration (publishable key: safe to expose in the browser) */
window.BINEISA_CONFIG = {
  supabaseUrl: "https://rnbomgxmurdnwmvgklru.supabase.co",
  supabaseKey: "sb_publishable_5JjqQiUuj0uLfboeKoM9sg_JqleOLer",

  /* Auth: passwordless. Email one-time code is always on.
     Set phoneOtpEnabled to true after adding an SMS provider (Twilio etc.)
     in Supabase → Authentication → Providers → Phone. */
  phoneOtpEnabled: false,

  /* Optional bot protection on auth forms: Cloudflare Turnstile site key.
     Also enable Turnstile in Supabase → Authentication → Attack Protection. */
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
