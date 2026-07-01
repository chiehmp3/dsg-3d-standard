import { createClient } from '@supabase/supabase-js';

// 公開（publishable）金鑰＝唯讀，透過 RLS 只允許 select。安全。
export const sb = createClient(
  'https://bpsfptwxridmmnlqjrrv.supabase.co',
  'sb_publishable_aPDBHVpm7hrNyzaHtA4xzg_kGt9W4uD',
);
