import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wfpacsoyoalkdzksnmdg.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_OE__Egoq2JlJASb3QnqrbA_lnpaaTd6'

export const supabase = createClient(supabaseUrl, supabaseKey)
