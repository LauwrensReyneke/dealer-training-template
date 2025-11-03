<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">Vehicle Prices</h2>
      <button @click="openNew" class="px-3 py-1.5 rounded bg-blue-600 text-white text-sm">Add Price</button>
    </div>

    <div v-if="loading" class="text-sm text-gray-500">Loading prices...</div>

    <table v-else-if="prices.length" class="w-full text-sm border rounded bg-white">
      <thead class="bg-gray-50">
        <tr>
          <th class="p-2 text-left">Brand</th>
          <th class="p-2 text-left">Preview</th>
          <th class="p-2 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in prices" :key="p.brand" class="border-t">
          <td class="p-2 font-medium">{{ p.brand }}</td>
          <td class="p-2 text-xs text-gray-700 break-words max-w-xl">{{ previews[p.brand] || '' }}</td>
          <td class="p-2">
            <div class="flex justify-end gap-2">
              <button @click="edit(p.brand)" class="px-2 py-1 text-xs rounded bg-blue-500 text-white">Edit</button>
              <button @click="remove(p.brand)" class="px-2 py-1 text-xs rounded bg-red-600 text-white">Delete</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="text-sm text-gray-500">No prices yet.</div>

    <div v-if="statusMsg" class="text-xs text-gray-600">{{ statusMsg }}</div>

    <teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-[1000]">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4">
          <form @submit.prevent="save" class="relative bg-white rounded shadow-lg w-full max-w-2xl p-5 space-y-4" novalidate>
            <h3 class="font-semibold text-sm">{{ form.brand ? 'Edit Prices' : 'New Brand Prices' }}</h3>
            <div class="grid gap-3">
              <label class="text-xs font-medium">Brand
                <input v-model.trim="form.brand" required class="mt-1 w-full border rounded px-2 py-1 text-sm" />
              </label>
              <label class="text-xs font-medium">Content (markdown/plain text)
                <textarea v-model="form.content" rows="8" class="mt-1 w-full border rounded px-2 py-1 text-sm font-mono text-xs"></textarea>
              </label>
            </div>
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" @click="close" class="px-3 py-1.5 rounded bg-gray-200 text-sm">Cancel</button>
              <button type="submit" :disabled="saving || !form.brand.trim()" class="px-3 py-1.5 rounded bg-blue-600 text-white text-sm disabled:opacity-40">{{ saving ? 'Saving…' : 'Save' }}</button>
            </div>
          </form>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { listPrices, getPrice, savePrice, deletePrice } from '../api';

const prices = ref([]);
const previews = reactive({});
const loading = ref(false);
const showModal = ref(false);
const saving = ref(false);
const form = reactive({ brand:'', content:'' });
const statusMsg = ref('');
let clearTimer;

function setStatus(msg, ttl=2000){ statusMsg.value = msg; clearTimeout(clearTimer); if (msg) clearTimer = setTimeout(()=> statusMsg.value='', ttl); }

async function load(){
  loading.value = true;
  try {
    prices.value = await listPrices();
    // load previews
    for (const p of prices.value){
      const c = await getPrice(p.brand).catch(()=> '');
      previews[p.brand] = (String(c || '')).slice(0,200);
    }
  } catch (e){ setStatus('Failed to load prices'); }
  finally { loading.value = false; }
}

function openNew(){ Object.assign(form, { brand:'', content:'' }); showModal.value = true; focusSoon(); }
function edit(brand){ showModal.value = true; form.brand = brand; form.content = previews[brand] || ''; // we'll fetch full content
  getPrice(brand).then(c=> form.content = c||''); focusSoon(); }
function close(){ if (saving.value) return; showModal.value = false; }
function focusSoon(){ setTimeout(()=> { const el = document.querySelector('input[required]'); if (el) el.focus(); }, 20); }

async function save(){
  const b = (form.brand || '').trim();
  if (!b) return;
  saving.value = true;
  try {
    await savePrice(b, form.content || '');
    await load();
    close();
    setStatus('Saved');
  } catch (e){ setStatus('Save failed'); }
  finally { saving.value = false; }
}

async function remove(brand){
  if (!confirm(`Delete prices for ${brand}?`)) return;
  try { await deletePrice(brand); await load(); setStatus('Deleted'); } catch { setStatus('Delete failed'); }
}

onMounted(()=> load());
</script>

<style scoped>
</style>

