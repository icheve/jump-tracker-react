import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SB_URL, SB_KEY } from './config';

/** null — локальный режим без аккаунтов (если ключи не заполнены) */
export const sb: SupabaseClient | null =
  SB_URL && SB_KEY ? createClient(SB_URL, SB_KEY) : null;
