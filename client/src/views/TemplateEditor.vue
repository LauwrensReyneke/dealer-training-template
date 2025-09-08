<template>
  <div class="space-y-6">
    <div class="flex flex-wrap gap-4 items-end">
      <div>
        <h2 class="text-lg font-semibold">Template Editor</h2>
        <p class="text-sm text-gray-600" v-pre>
          Use placeholders: {{DEALER_NAME}}, {{ADDRESS}}, {{NUMBER}} and {{BRAND}}
        </p>
      </div>
      <div class="ml-auto flex flex-wrap gap-2 items-end">
        <label class="text-xs font-medium">Template
          <select v-model="currentKey" class="mt-1 border rounded px-2 py-1 text-xs" @change="handleTemplateChange">
            <option v-for="t in templates" :key="t.key" :value="t.key">{{ t.key }}</option>
          </select>
        </label>
        <button @click="openModal('new')" class="px-2 py-1 text-xs rounded bg-blue-600 text-white">New</button>
        <button @click="openModal('rename')" :disabled="!templates.length" class="px-2 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-40">Rename</button>
        <button @click="removeCurrent" :disabled="currentKey==='main' || deleting" class="px-2 py-1 text-xs rounded bg-red-600 text-white disabled:opacity-40">Delete</button>
      </div>
    </div>

    <section class="bg-white border rounded p-3 space-y-2">
      <h3 class="text-xs font-semibold tracking-wide text-gray-600">Insert Placeholder</h3>
      <div class="flex flex-wrap gap-2">
        <button v-for="p in placeholders" :key="p" @click="insertPlaceholder(p)" class="px-2 py-1 text-xs rounded border bg-gray-50 hover:bg-gray-100 font-mono">{{ p }}</button>
      </div>
    </section>

    <div>
      <textarea ref="templateArea" v-model="localTemplate" class="w-full h-96 p-3 font-mono text-xs border rounded resize-none focus:outline-none focus:ring"></textarea>
    </div>

    <div class="flex gap-2 items-center flex-wrap">
      <button @click="save" :disabled="saving || localTemplate===original" class="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-40">Save</button>
      <button @click="reset" :disabled="localTemplate===original" class="px-4 py-2 rounded bg-gray-200">Reset</button>
      <span class="text-xs text-gray-500" v-if="updatedAt">Updated: {{ updatedAtDisplay }}</span>
      <span class="text-sm" v-if="status">{{ status }}</span>
    </div>

    <div v-if="showModal" class="fixed inset-0 z-40 flex items-center justify-center">
      <div class="absolute inset-0 bg-black/40" @click="closeModal"></div>
      <div class="relative bg-white rounded shadow-lg w-full max-w-sm p-5 space-y-4 z-10">
        <h3 class="text-sm font-semibold" v-text="modalMode==='new' ? 'Create Template' : 'Rename Template'"></h3>
        <div class="space-y-2">
          <label class="block text-xs font-medium text-gray-600">Template Name</label>
          <input v-model="modalInput" @keydown.enter.prevent="confirmModal" autofocus class="w-full border rounded px-2 py-1 text-sm" placeholder="" />
          <p v-if="modalError" class="text-xs text-red-600">{{ modalError }}</p>
        </div>
        <div class="flex justify-end gap-2">
          <button @click="closeModal" type="button" class="px-3 py-1.5 text-xs rounded border bg-gray-50 hover:bg-gray-100">Cancel</button>
          <button @click="confirmModal" :disabled="submitting || !sanitizedModalInput" class="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-40" v-text="submitting ? 'Please wait' : (modalMode==='new' ? 'Create' : 'Rename')"></button>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted, computed } from 'vue';
import { listTemplates, getTemplate, saveTemplate, deleteTemplate, renameTemplate } from '../api';

const placeholders = Object.freeze(['{{DEALER_NAME}}','{{ADDRESS}}','{{NUMBER}}','{{BRAND}}']);
const templates = ref([]);
const currentKey = ref('main');
const localTemplate = ref('');
const original = ref('');
const status = ref('');
const saving = ref(false);
const deleting = ref(false);
const templateArea = ref(null);
const updatedAt = ref('');
let clearTimer;

// Modal state
const showModal = ref(false);
const modalMode = ref('new'); // 'new' | 'rename'
const modalInput = ref('');
const modalError = ref('');
const submitting = ref(false);

const sanitize = k => (k||'').replace(/[^a-zA-Z0-9._-]+/g,'').slice(0,48);
const sanitizedModalInput = computed(()=> sanitize(modalInput.value));
const updatedAtDisplay = computed(()=> updatedAt.value ? new Date(updatedAt.value).toLocaleString() : '');
const originalKeyBeforeChange = ref('main');

function setStatus(msg, ttl=1200){
  status.value = msg; clearTimeout(clearTimer); if (msg) clearTimer = setTimeout(()=> status.value='', ttl);
}
function insertPlaceholder(token){
  const el = templateArea.value; if (!el) return;
  const { selectionStart: start, selectionEnd: end } = el; const value = localTemplate.value;
  localTemplate.value = value.slice(0,start) + token + value.slice(end);
  requestAnimationFrame(()=>{ el.focus(); const pos = start + token.length; el.setSelectionRange(pos,pos); });
}

function openModal(mode){
  modalMode.value = mode;
  modalError.value='';
  if (mode==='rename') modalInput.value = currentKey.value; else modalInput.value='';
  showModal.value = true;
  setTimeout(()=>{ const el = document.querySelector('input[autofocus]'); if (el) el.focus(); }, 10);
}
function closeModal(){ if (submitting.value) return; showModal.value=false; }

async function confirmModal(){
  modalError.value='';
  const key = sanitizedModalInput.value;
  if (!key) { modalError.value='Invalid key'; return; }
  if (modalMode.value==='rename') {
    if (key === currentKey.value) { showModal.value=false; return; }
    if (templates.value.some(t=>t.key===key)) { modalError.value='Key already exists'; return; }
    // proceed rename
    submitting.value=true;
    try {
      await renameTemplate(currentKey.value, key);
      await loadTemplates(key);
      currentKey.value = key;
      originalKeyBeforeChange.value = key;
      setStatus('Renamed');
      showModal.value=false;
    } catch { modalError.value='Rename failed'; }
    finally { submitting.value=false; }
  } else { // new
    if (templates.value.some(t=>t.key===key)) { modalError.value='Key already exists'; return; }
    submitting.value=true;
    try {
      await saveTemplate(key, '');
      await loadTemplates(key);
      await loadTemplateContent();
      setStatus('Created');
      showModal.value=false;
    } catch { modalError.value='Create failed'; }
    finally { submitting.value=false; }
  }
}

async function loadTemplates(selectKey){
  try {
    const list = await listTemplates();
    templates.value = list.length ? list : [{ key:'main', updated_at: new Date().toISOString() }];
    if (selectKey && templates.value.some(t=>t.key===selectKey)) currentKey.value = selectKey;
    if (!templates.value.some(t=>t.key===currentKey.value)) currentKey.value = 'main';
  } catch { setStatus('Failed to list templates'); }
}
async function loadTemplateContent(){
  setStatus('Loading...',800);
  try {
    const tpl = await getTemplate(currentKey.value);
    localTemplate.value = tpl; original.value = tpl;
    const meta = templates.value.find(t=>t.key===currentKey.value); updatedAt.value = meta?.updated_at || '';
    setStatus('');
  } catch { setStatus('Load failed'); }
}
async function save(){
  saving.value=true; setStatus('Saving...');
  try { await saveTemplate(currentKey.value, localTemplate.value); original.value=localTemplate.value; setStatus('Saved'); await loadTemplates(currentKey.value); }
  catch { setStatus('Save failed'); }
  finally { saving.value=false; }
}
function reset(){ localTemplate.value = original.value; }
async function removeCurrent(){
  if (currentKey.value==='main') return;
  if (!confirm(`Delete template "${currentKey.value}"?`)) return;
  deleting.value=true; setStatus('Deleting...');
  try { await deleteTemplate(currentKey.value); await loadTemplates('main'); await loadTemplateContent(); setStatus('Deleted'); }
  catch { setStatus('Delete failed'); }
  finally { deleting.value=false; }
}
async function handleTemplateChange(){
  if (localTemplate.value !== original.value){
    const proceed = confirm('Discard unsaved changes?');
    if (!proceed){ currentKey.value = templates.value.find(t=>t.key===originalKeyBeforeChange.value)?.key || 'main'; return; }
  }
  originalKeyBeforeChange.value = currentKey.value;
  await loadTemplateContent();
}

onMounted(async ()=>{ await loadTemplates('main'); await loadTemplateContent(); originalKeyBeforeChange.value=currentKey.value; window.addEventListener('keydown', escListener); });
function escListener(e){ if (e.key==='Escape' && showModal.value){ closeModal(); } }
</script>
<style scoped>
/***** minimal fade *****/
</style>
