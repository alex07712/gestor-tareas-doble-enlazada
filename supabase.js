// supabase.js
// Este archivo crea el cliente Supabase y lo exporta para usar en app.js

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://eswsjfhyhqpreifhdibo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVzd3NqZmh5aHFwcmVpZmhkaWJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODM4ODUsImV4cCI6MjA4MDI1OTg4NX0.p8yZbKPJI58rrSbmFRQ5zt87GOM82hKBr2Wf7DUs1ds";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);