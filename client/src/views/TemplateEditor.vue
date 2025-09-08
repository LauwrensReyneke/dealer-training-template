<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-lg font-semibold">Template Editor</h2>
      <p class="text-sm text-gray-600" v-pre>
        Use placeholders: {{DEALER_NAME}}, {{ADDRESS}}, {{NUMBER}} and {{BRAND}}
      </p>
    </div>

    <section class="bg-white border rounded p-3 space-y-2">
      <h3 class="text-xs font-semibold tracking-wide text-gray-600">Insert Placeholder</h3>
      <div class="flex flex-wrap gap-2">
        <button v-for="p in placeholders" :key="p" @click="insert(p)" class="px-2 py-1 text-xs rounded border bg-gray-50 hover:bg-gray-100 font-mono">{{ p }}</button>
      </div>
    </section>

    <div>
      <textarea ref="templateArea" v-model="localTemplate" class="w-full h-96 p-3 font-mono text-xs border rounded resize-none focus:outline-none focus:ring" />
    </div>

    <div class="flex gap-2 items-center">
      <button @click="save" :disabled="saving || localTemplate===original" class="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-40">Save</button>
      <button @click="reset" :disabled="localTemplate===original" class="px-4 py-2 rounded bg-gray-200">Reset</button>
      <span class="text-sm" v-if="status">{{ status }}</span>
    </div>
  </div>
</template>
<script setup>
import { ref, onMounted } from 'vue';

const localTemplate = ref('');
const original = ref('');
const status = ref('');
const saving = ref(false);
const templateArea = ref(null);

// Only named placeholders now
const placeholders = ['{{DEALER_NAME}}','{{ADDRESS}}','{{NUMBER}}','{{BRAND}}'];

function insert(token){
  const el = templateArea.value;
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const value = localTemplate.value;
  localTemplate.value = value.slice(0,start) + token + value.slice(end);
  requestAnimationFrame(()=> {
    el.focus();
    const pos = start + token.length;
    el.setSelectionRange(pos,pos);
  });
}

async function load(){
  status.value='Loading...';
  try {
    const r = await fetch('/api/template');
    const j = await r.json();
    localTemplate.value = j.template || '';
    original.value = j.template || '';
    status.value = 'Loaded';
    setTimeout(()=> status.value='', 1000);
  } catch {
    status.value='Failed to load';
  }
}
async function save(){
  saving.value=true; status.value='Saving...';
  try {
    await fetch('/api/template', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ template: localTemplate.value }) });
    original.value = localTemplate.value;
    status.value='Saved';
    setTimeout(()=> status.value='', 1200);
  } catch { status.value='Save failed'; }
  finally { saving.value=false; }
}
function reset(){ localTemplate.value = original.value; }

onMounted(load);
</script>
