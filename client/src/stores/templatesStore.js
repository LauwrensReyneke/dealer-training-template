import { ref } from 'vue';
import { listTemplates } from '../api';

export const templates = ref([]); // [{ key, updated_at }]
export const selectedTemplateKey = ref('');

const beforeChangeHandlers = new Set();
export function registerBeforeTemplateChange(fn){
  beforeChangeHandlers.add(fn);
  return () => beforeChangeHandlers.delete(fn);
}

export async function refreshTemplates(preferKey){
  try {
    const list = await listTemplates();
    templates.value = list;
    if (templates.value.length === 0){
      selectedTemplateKey.value = '';
      return;
    }
    if (preferKey && templates.value.some(t=>t.key===preferKey)) {
      selectedTemplateKey.value = preferKey;
    } else if (!selectedTemplateKey.value || !templates.value.some(t=>t.key===selectedTemplateKey.value)) {
      selectedTemplateKey.value = templates.value[0].key;
    }
  } catch (e) {
    console.warn('Failed to refresh templates', e);
  }
}

export async function setSelectedTemplateKey(key){
  if (key === selectedTemplateKey.value) return true;
  for (const h of beforeChangeHandlers){
    try { const ok = await h(key); if (ok === false) return false; } catch { return false; }
  }
  if (!templates.value.length) await refreshTemplates();
  if (key && !templates.value.some(t=>t.key===key)) return false; // invalid selection
  selectedTemplateKey.value = key || '';
  return true;
}
