import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env')
}

export const supabase = createClient(url, key)

// Dominio de correo permitido (ej. "universidad.edu.pe"). Si queda vacío, no se restringe en el navegador.
export const allowedDomain = String(import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN ?? '')
  .trim()
  .toLowerCase()
  .replace(/^@/, '')
