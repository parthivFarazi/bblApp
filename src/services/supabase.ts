import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://jjlkqilpjdjslxunmbup.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqbGtxaWxwamRqc2x4dW5tYnVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxMjczODAsImV4cCI6MjA3ODcwMzM4MH0.L6LpGdJxa9cNjHSTxZuoRDZcpa7Ir07wsAfTMo3835I';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? FALLBACK_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_ANON_KEY;

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn('Using fallback Supabase credentials. Configure EXPO_PUBLIC_SUPABASE_URL/ANON_KEY for production.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});
