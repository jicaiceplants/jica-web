import { createClient } from "@supabase/supabase-js";

function cleanSupabaseUrl(input?: string): string {
  const fallback = "https://fskbdjedfhjxmxkgkstg.supabase.co";
  if (!input) return fallback;

  let url = input.trim();

  // Strip surrounding single or double quotes
  url = url.replace(/^["']+|["']+$/g, "").trim();

  // If Markdown link format: [text](url) -> extract url
  const markdownMatch = url.match(/\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  if (markdownMatch && markdownMatch[1]) {
    url = markdownMatch[1].trim();
  }

  // Handle parenthesized URL: (https://...)
  const parenMatch = url.match(/^\((https?:\/\/[^\s)]+)\)$/);
  if (parenMatch && parenMatch[1]) {
    url = parenMatch[1].trim();
  }

  // Strip trailing /rest/v1 or trailing slashes
  url = url.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "").trim();

  // Validate standard HTTP/HTTPS URL
  const isValidUrl = /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(url);
  if (!isValidUrl) {
    return fallback;
  }

  return url;
}

function cleanSupabaseKey(input?: string): string {
  const fallback = "placeholder-anon-key";
  if (!input) return fallback;

  let key = input.trim();
  // Strip surrounding quotes
  key = key.replace(/^["']+|["']+$/g, "").trim();

  return key || fallback;
}

const supabaseUrl = cleanSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseAnonKey = cleanSupabaseKey(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
  },
});
