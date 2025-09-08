<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">Render / Populate Template</h2>
      <RouterLink to="/dealers" class="text-sm text-blue-600 hover:underline">Manage Dealers</RouterLink>
    </div>

    <div v-if="!dealers.length" class="text-sm text-gray-600 bg-white p-4 rounded border">
      No dealers yet. Please add one first.
    </div>

    <div v-else class="space-y-4">
      <div class="flex flex-wrap gap-4 items-end">
        <label class="text-xs font-medium">Select Dealer
          <select v-model="selected" class="mt-1 border rounded px-2 py-1 text-sm min-w-[14rem]">
            <option disabled value="">-- choose dealer --</option>
            <option v-for="d in dealers" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </label>
        <button @click="copy" :disabled="!rendered" class="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-40">Copy</button>
        <span class="text-sm" v-if="status">{{ status }}</span>
      </div>

      <div v-if="rendered" class="space-y-2">
        <h3 class="font-medium text-sm">Preview</h3>
        <div class="p-4 border rounded bg-white whitespace-pre-wrap text-sm leading-relaxed min-h-[8rem]">{{ rendered }}</div>
      </div>
      <div v-else class="text-sm text-gray-500">Select a dealer to render the template.</div>
    </div>
  </div>
</template>
<script setup>
import { ref, watch, onMounted } from 'vue';

const dealers = ref([]);
const selected = ref('');
const rendered = ref('');
const status = ref('');

async function loadDealers(){
  try {
    const r = await fetch('/api/dealers');
    dealers.value = (await r.json()).dealers || [];
  } catch { status.value='Failed to load dealers'; }
}
async function render(){
  rendered.value='';
  if (!selected.value) return;
  status.value='Rendering...';
  try {
    const r = await fetch(`/api/render?id=${encodeURIComponent(selected.value)}`);
    if (!r.ok) throw new Error();
    const j = await r.json();
    rendered.value = j.rendered;
    status.value='Rendered';
    setTimeout(()=> status.value='', 1200);
  } catch { status.value='Render failed'; }
}
async function copy(){
  if (!rendered.value) return;
  try { await navigator.clipboard.writeText(rendered.value); status.value='Copied'; setTimeout(()=> status.value='', 1200); }
  catch { status.value='Copy failed'; }
}

watch(selected, render);

onMounted(loadDealers);
</script>
