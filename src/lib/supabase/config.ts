// Supabase connection settings.
//
// The URL and the publishable (anon) key are PUBLIC by design — the
// publishable key is meant to ship to the browser and all data is protected
// by Row Level Security. Hardcoding them as defaults lets the app run on any
// host without extra configuration. Environment variables override them.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://wesihatopiznatsyfxer.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "sb_publishable_uy1TETiYJvc3XNFf4a8yUQ_djWGu-W4";
