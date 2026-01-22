<template>
  <div class="min-h-screen flex flex-col">
    <header class="bg-white shadow p-4 flex items-center gap-4 flex-wrap">
      <h1 class="text-xl font-semibold">Template Builder</h1>
      <nav class="flex gap-3 text-sm">
        <RouterLink to="/" class="hover:underline" :class="linkClass('/')">Template</RouterLink>
        <RouterLink to="/dealers" class="hover:underline" :class="linkClass('/dealers')">Dealers</RouterLink>
        <RouterLink to="/render" class="hover:underline" :class="linkClass('/render')">Render</RouterLink>
      </nav>
      <!-- Global Template Selector -->
      <div class="ml-auto flex items-center gap-2" v-if="templates.length">
        <label class="text-[11px] font-medium text-gray-600">Template
          <select :value="selectedTemplateComputed" @change="onTemplateChange($event)" class="mt-0.5 border rounded px-2 py-1 text-xs min-w-[8rem]">
            <option value="">-- none --</option>
            <option v-for="t in templates" :key="t.key" :value="t.key">{{ t.key }}</option>
          </select>
        </label>
      </div>
    </header>
    <main class="flex-1 p-4 max-w-6xl w-full mx-auto">
      <RouterView />
    </main>
  </div>
</template>
<script setup>
import { useRoute } from 'vue-router';
import { computed, onMounted } from 'vue';
import { templates, selectedTemplateKey, setSelectedTemplateKey, refreshTemplates } from './stores/templatesStore';

const route = useRoute();
const linkClass = (path) => route.path === path ? 'font-bold text-blue-600' : 'text-gray-600';

const selectedTemplateComputed = computed(()=> selectedTemplateKey.value);
async function onTemplateChange(e){
  const key = e.target.value;
  await setSelectedTemplateKey(key);
}

onMounted(async ()=>{ if (!templates.value.length) await refreshTemplates(); });
</script>
