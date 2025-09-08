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
        <button v-for="p in placeholders" :key="p" @click="insertPlaceholder(p)" class="px-2 py-1 text-xs rounded border bg-gray-50 hover:bg-gray-100 font-mono">{{ p }}</button>
      </div>
    </section>

    <div>
      <textarea ref="templateArea" v-model="localTemplate" class="w-full h-96 p-3 font-mono text-xs border rounded resize-none focus:outline-none focus:ring"></textarea>
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
import { getTemplate, saveTemplate } from '../api';

const placeholders = Object.freeze(['{{DEALER_NAME}}','{{ADDRESS}}','{{NUMBER}}','{{BRAND}}']);

const localTemplate = ref('');
const original = ref('');
const status = ref('');
const saving = ref(false);
const templateArea = ref(null);
let clearTimer;

function setStatus(msg, ttl=1200){
  status.value = msg;
  clearTimeout(clearTimer);
  if (msg) clearTimer = setTimeout(()=> status.value='', ttl);
}

function insertPlaceholder(token){
  const el = templateArea.value; if (!el) return;
  const { selectionStart: start, selectionEnd: end } = el;
  const value = localTemplate.value;
  localTemplate.value = value.slice(0,start) + token + value.slice(end);
  requestAnimationFrame(()=> {
    el.focus();
    const pos = start + token.length;
    el.setSelectionRange(pos,pos);
  });
}

async function load(){
  setStatus('Loading...', 800);
  try {
    const tpl = await getTemplate();
    localTemplate.value = tpl; original.value = tpl;
  } catch { setStatus('Load failed'); }
}

async function save(){
  saving.value = true; setStatus('Saving...');
  try {
    await saveTemplate(localTemplate.value);
    original.value = localTemplate.value;
    setStatus('Saved');
  } catch { setStatus('Save failed'); }
  finally { saving.value=false; }
}

function reset(){ localTemplate.value = original.value; }

onMounted(load);
</script>
