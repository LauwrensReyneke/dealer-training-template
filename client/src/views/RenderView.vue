<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">Render / Populate Template</h2>
      <RouterLink to="/dealers" class="text-sm text-blue-600 hover:underline">Manage Dealers</RouterLink>
    </div>

    <div v-if="!dealers.length && !loading" class="text-sm text-gray-600 bg-white p-4 rounded border">
      No dealers yet. Please add one first.
    </div>

    <div v-else class="space-y-4">
      <div class="flex flex-wrap gap-4 items-end">
        <label class="text-xs font-medium">Select Dealer
          <select v-model="selectedDealer" class="mt-1 border rounded px-2 py-1 text-sm min-w-[14rem]" :disabled="loading">
            <option disabled value="">-- choose dealer --</option>
            <option v-for="d in dealers" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </label>
        <label class="text-xs font-medium">Template
          <select v-model="selectedTemplate" class="mt-1 border rounded px-2 py-1 text-sm min-w-[10rem]">
            <option v-for="t in templates" :key="t.key" :value="t.key">{{ t.key }}</option>
          </select>
        </label>
        <button @click="copy" :disabled="!rendered" class="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-40">Copy</button>
        <span class="text-sm" v-if="status">{{ status }}</span>
      </div>

      <div v-if="rendered" class="space-y-2">
        <h3 class="font-medium text-sm">Preview</h3>
        <div class="p-4 border rounded bg-white whitespace-pre-wrap text-sm leading-relaxed min-h-[8rem]">{{ rendered }}</div>
      </div>
      <div v-else-if="!loading" class="text-sm text-gray-500">Select a dealer to render the template.</div>
    </div>
  </div>
</template>
<script setup>
import { ref, watch, onMounted } from 'vue';
import { listDealers, renderDealer, copyText, listTemplates } from '../api';

const dealers = ref([]);
const templates = ref([{ key:'main'}]);
const loading = ref(false);
const selectedDealer = ref('');
const selectedTemplate = ref('main');
const rendered = ref('');
const status = ref('');
let timer;

function setStatus(msg, ttl=1200){
  status.value = msg;
  clearTimeout(timer);
  if (msg) timer = setTimeout(()=> status.value='', ttl);
}

async function loadDealers(){
  loading.value = true;
  try { dealers.value = await listDealers(); } catch { setStatus('Failed to load dealers'); }
  finally { loading.value = false; }
}
async function loadTemplates(){
  try { templates.value = await listTemplates(); if (!templates.value.length) templates.value=[{ key:'main'}]; if(!templates.value.some(t=>t.key===selectedTemplate.value)) selectedTemplate.value='main'; } catch { /* ignore */ }
}

async function doRender(){
  rendered.value='';
  if (!selectedDealer.value) return;
  setStatus('Rendering...', 800);
  try {
    rendered.value = await renderDealer(selectedDealer.value, selectedTemplate.value);
    setStatus('Rendered');
  } catch { setStatus('Render failed'); }
}

async function copy(){
  if (!rendered.value) return;
  const ok = await copyText(rendered.value);
  setStatus(ok ? 'Copied' : 'Copy failed');
}

watch([selectedDealer, selectedTemplate], doRender);

onMounted(async ()=>{ await Promise.all([loadDealers(), loadTemplates()]); });
</script>
