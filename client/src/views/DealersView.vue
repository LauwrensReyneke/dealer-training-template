<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">Dealers</h2>
      <button @click="openNew" class="px-3 py-1.5 rounded bg-blue-600 text-white text-sm">Add Dealer</button>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">Loading dealers...</div>

    <table v-else-if="dealers.length" class="w-full text-sm border rounded bg-white">
      <thead class="bg-gray-50">
        <tr>
          <th class="p-2 text-left">Name</th>
          <th class="p-2 text-left">Address</th>
          <th class="p-2 text-left">Number</th>
          <th class="p-2 text-left">Brand</th>
          <th class="p-2 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in dealers" :key="d.id" class="border-t" :class="d.id===lastCopiedId ? 'bg-indigo-50' : ''">
          <td class="p-2">{{ d.name }}</td>
          <td class="p-2">{{ d.address }}</td>
          <td class="p-2">{{ d.number }}</td>
          <td class="p-2">{{ d.brand }}</td>
          <td class="p-2">
            <div class="flex flex-wrap justify-end gap-2">
              <button @click="copyTemplate(d)" :disabled="copyingId===d.id" class="px-2 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-50">{{ copyingId===d.id ? 'Copying…' : 'Copy Template' }}</button>
              <button @click="openEdit(d)" class="px-2 py-1 text-xs rounded bg-blue-500 text-white">Edit</button>
              <button @click="removeDealer(d)" class="px-2 py-1 text-xs rounded bg-red-600 text-white">Delete</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="text-sm text-gray-500">No dealers yet.</div>

    <div v-if="statusMsg" class="text-xs text-gray-600">{{ statusMsg }}</div>

    <!-- Teleport Modal -->
    <teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-[1000]">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4">
          <form @submit.prevent="save" class="relative bg-white rounded shadow-lg w-full max-w-md p-5 space-y-4" novalidate>
            <h3 class="font-semibold text-sm">{{ form.id ? 'Edit Dealer' : 'New Dealer' }}</h3>
            <div class="grid gap-3">
              <label class="text-xs font-medium">Name
                <input v-model.trim="form.name" required class="mt-1 w-full border rounded px-2 py-1 text-sm" />
              </label>
              <label class="text-xs font-medium">Address
                <input v-model.trim="form.address" class="mt-1 w-full border rounded px-2 py-1 text-sm" />
              </label>
              <label class="text-xs font-medium">Number
                <input v-model.trim="form.number" class="mt-1 w-full border rounded px-2 py-1 text-sm" />
              </label>
              <label class="text-xs font-medium">Brand
                <input v-model.trim="form.brand" class="mt-1 w-full border rounded px-2 py-1 text-sm" />
              </label>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" @click="close" class="px-3 py-1.5 rounded bg-gray-200 text-sm">Cancel</button>
              <button type="submit" :disabled="savingDealer || !form.name.trim()" class="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-40">{{ savingDealer ? 'Saving…' : 'Save' }}</button>
            </div>
          </form>
        </div>
      </div>
    </teleport>
  </div>
</template>
<script setup>
import { reactive, ref, onMounted } from 'vue';
import { listDealers, createDealer, updateDealer, deleteDealer, renderDealer, copyText } from '../api';

const dealers = ref([]);
const loading = ref(false);
const form = reactive({ id:'', name:'', address:'', number:'', brand:'' });
const copyingId = ref('');
const lastCopiedId = ref('');
const statusMsg = ref('');
const showModal = ref(false);
const savingDealer = ref(false);
let clearTimer;

function setStatus(msg, ttl=1800){
  statusMsg.value = msg;
  clearTimeout(clearTimer);
  if (msg) clearTimer = setTimeout(()=> statusMsg.value='', ttl);
}

async function load(){
  loading.value = true;
  try { dealers.value = await listDealers(); }
  catch { setStatus('Failed to load dealers'); }
  finally { loading.value = false; }
}

function openNew(){ Object.assign(form,{ id:'', name:'', address:'', number:'', brand:'' }); showModal.value=true; focusSoon(); }
function openEdit(d){ Object.assign(form,d); showModal.value=true; focusSoon(); }
function close(){ if (savingDealer.value) return; showModal.value=false; }
function focusSoon(){ setTimeout(()=> { const el = document.querySelector('input[required]'); if (el) el.focus(); }, 20); }

async function save(){
  if (!form.name.trim()) return;
  savingDealer.value = true;
  const payload = { name: form.name.trim(), address: form.address.trim(), number: form.number.trim(), brand: form.brand.trim() };
  try {
    if (form.id) await updateDealer(form.id, payload); else await createDealer(payload);
    await load();
    close();
  } catch { setStatus('Save failed'); }
  finally { savingDealer.value=false; }
}

async function removeDealer(d){
  if (!confirm(`Delete dealer ${d.name}?`)) return;
  try { await deleteDealer(d.id); await load(); }
  catch { setStatus('Delete failed'); }
}

async function copyTemplate(d){
  copyingId.value = d.id;
  try {
    const rendered = await renderDealer(d.id);
    if (!rendered) throw new Error('empty');
    const ok = await copyText(rendered);
    if (!ok) throw new Error('clipboard');
    lastCopiedId.value = d.id;
    setStatus(`Copied template for ${d.name}`);
  } catch { setStatus(`Copy failed for ${d.name}`); }
  finally { copyingId.value=''; }
}

onMounted(()=>{
  load();
  window.addEventListener('keydown', e=>{ if (e.key==='Escape' && showModal.value) close(); });
});
</script>
<style scoped>
/* no dialog backdrop now */
</style>
