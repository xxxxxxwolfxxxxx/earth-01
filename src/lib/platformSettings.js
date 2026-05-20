import { supabase } from './supabase'

// Liest plattformweite Einstellung (z.B. Affiliate-Links).
// Öffentlich lesbar laut RLS.
export async function fetchSetting(key) {
  const { data } = await supabase
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  return data?.value ?? null
}

// Schreibt eine Einstellung. RLS verhindert das wenn der User kein Admin ist.
export async function saveSetting(key, value) {
  const { error } = await supabase
    .from('platform_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw error
}

// Prüft, ob aktueller User Admin-Rechte hat.
export async function fetchIsAdmin() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  return data?.is_admin === true
}
