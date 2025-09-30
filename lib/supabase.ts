import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://siaawxcgyghuphwgufkn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpYWF3eGNneWdodXBod2d1ZmtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDU2MTYsImV4cCI6MjA3NDgyMTYxNn0.xqcDMCqKm5Vch-tVByvSbHgWjNqGFQ8gwQeEC8-Tvyc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
