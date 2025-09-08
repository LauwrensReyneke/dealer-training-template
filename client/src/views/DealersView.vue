<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">Dealers</h2>
      <button @click="newDealer" class="px-3 py-1.5 rounded bg-green-600 text-white text-sm">Add Dealer</button>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">Loading dealers...</div>

    <table v-if="!loading && dealers.length" class="w-full text-sm border rounded bg-white">
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
            <td class="p-2 text-right space-x-2">
              <button @click="copyTemplate(d)" :disabled="copyingId===d.id" class="px-2 py-1 text-xs rounded bg-indigo-600 text-white disabled:opacity-50">{{ copyingId===d.id ? 'Copying…' : 'Copy Template' }}</button>
              <button @click="editDealer(d)" class="px-2 py-1 text-xs rounded bg-blue-600 text-white">Edit</button>
              <button @click="removeDealer(d)" class="px-2 py-1 text-xs rounded bg-red-600 text-white">Delete</button>
            </td>
        </tr>
      </tbody>
    </table>
    <div v-else-if="!loading" class="text-sm text-gray-500">No dealers yet.</div>

    <div v-if="statusMsg" class="text-xs text-gray-600">{{ statusMsg }}</div>

    <dialog ref="dialog" class="rounded shadow max-w-md w-full p-0">
      <form @submit.prevent="save" class="p-4 space-y-3">
        <h3 class="font-semibold" v-text="form.id ? 'Edit Dealer' : 'New Dealer'" />
        <div class="grid gap-2">
          <label class="text-xs font-medium">Name
            <input v-model="form.name" required class="mt-1 w-full border rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs font-medium">Address
            <input v-model="form.address" class="mt-1 w-full border rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs font-medium">Number
            <input v-model="form.number" class="mt-1 w-full border rounded px-2 py-1 text-sm" />
          </label>
          <label class="text-xs font-medium">Brand
            <input v-model="form.brand" class="mt-1 w-full border rounded px-2 py-1 text-sm" />
          </label>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" @click="close" class="px-3 py-1.5 rounded bg-gray-200 text-sm">Cancel</button>
          <button type="submit" class="px-3 py-1.5 rounded bg-blue-600 text-white text-sm">Save</button>
        </div>
      </form>
    </dialog>
  </div>
</template>
<script setup>
import { reactive, ref, onMounted } from 'vue';

const dealers = ref([]);
const loading = ref(false);
const dialog = ref(null);
const form = reactive({ id:'', name:'', address:'', number:'', brand:'' });
const copyingId = ref('');
const lastCopiedId = ref('');
const statusMsg = ref('');
let clearTimer;

function setStatus(msg){
  statusMsg.value = msg;
  clearTimeout(clearTimer);
  clearTimer = setTimeout(()=> statusMsg.value='', 1800);
}

async function load(){
  loading.value = true;
  try {
    const r = await fetch('/api/dealers');
    dealers.value = (await r.json()).dealers || [];
  } catch (e) {
    setStatus('Failed to load dealers');
  } finally {
    loading.value = false;
  }
}
function newDealer(){ Object.assign(form,{ id:'', name:'', address:'', number:'', brand:'' }); dialog.value.showModal(); }
function editDealer(d){ Object.assign(form,d); dialog.value.showModal(); }
function close(){ dialog.value.close(); }
async function save(){
  const payload = { name: form.name, address: form.address, number: form.number, brand: form.brand };
  try {
    if (form.id){
      await fetch(`/api/dealer?id=${encodeURIComponent(form.id)}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    } else {
      await fetch('/api/dealer', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    }
    await load();
    close();
  } catch (e) {
    setStatus('Save failed');
  }
}
async function removeDealer(d){
  if (!confirm(`Delete dealer ${d.name}?`)) return;
  try {
    await fetch(`/api/dealer?id=${encodeURIComponent(d.id)}`, { method:'DELETE' });
    await load();
  } catch { setStatus('Delete failed'); }
}
async function copyTemplate(d){
  copyingId.value = d.id;
  try {
    const r = await fetch(`/api/dealer/render?id=${encodeURIComponent(d.id)}`);
    if (!r.ok) throw new Error('render failed');
    const j = await r.json();
    const text = j.rendered || '';
    if (!text) throw new Error('empty render');
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }
    lastCopiedId.value = d.id;
    setStatus(`Copied template for ${d.name}`);
  } catch (e) {
    setStatus(`Copy failed for ${d.name}`);
  } finally {
    copyingId.value='';
  }
}

onMounted(load);
</script>
<style scoped>
dialog::backdrop { background: rgba(0,0,0,0.35); }
</style>
