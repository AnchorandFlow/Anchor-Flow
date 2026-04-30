import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://sbgbyptkunvyxjfpzght.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiZ2J5cHRrdW52eXhqZnB6Z2h0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0Njk2MDYsImV4cCI6MjA5MDA0NTYwNn0.jbrKplCdnPeqS3QEKMDMClsIVBvQYgph_U5xK5iCxY0"

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
