import { sb } from './supabase';

// 一次載入全部資料表（與舊版相同）
export async function loadAll() {
  const [sections, entries, contacts, avatars, developments, sampleRequests, appSettings] = await Promise.all([
    sb.from('sections').select('*').order('sort_order'),
    sb.from('entries').select('*').order('sort_order'),
    sb.from('contacts').select('*').order('sort_order'),
    sb.from('avatars').select('*').order('sort_order'),
    sb.from('developments').select('*').order('sort_order'),
    sb.from('sample_requests').select('*').order('sort_order'),
    sb.from('app_settings').select('*'),
  ]);
  return {
    sections: sections.data || [],
    entries: entries.data || [],
    contacts: contacts.data || [],
    avatars: avatars.data || [],
    developments: developments.data || [],
    sampleRequests: sampleRequests.data || [],
    settings: Object.fromEntries((appSettings.data || []).map((r) => [r.key, r.value])),
    error: sections.error || entries.error || contacts.error || null,
  };
}

// 依 sort_order 排序後，依 group_name 分組（保留出現順序）
export function groupByName(entries) {
  const list = [...entries].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const groups = [];
  const idx = {};
  list.forEach((e) => {
    const g = e.group_name || '';
    if (!(g in idx)) { idx[g] = groups.length; groups.push({ name: g, items: [] }); }
    groups[idx[g]].items.push(e);
  });
  return groups;
}
