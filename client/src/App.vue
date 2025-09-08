<template>
  <div class="min-h-screen flex flex-col">
    <header class="bg-white shadow p-4 flex items-center gap-4">
      <h1 class="text-xl font-semibold">Template Builder</h1>
      <nav class="flex gap-3 text-sm">
        <RouterLink to="/" class="hover:underline" :class="linkClass('/')">Template</RouterLink>
        <RouterLink to="/dealers" class="hover:underline" :class="linkClass('/dealers')">Dealers</RouterLink>
        <RouterLink to="/render" class="hover:underline" :class="linkClass('/render')">Render</RouterLink>
      </nav>
    </header>
    <main class="flex-1 p-4 max-w-6xl w-full mx-auto">
      <RouterView />
    </main>
<!--    <footer class="p-4 text-xs text-center text-gray-500">&copy; 2025 | Lauwrens Reyneke | CTO</footer>-->
  </div>
</template>
<script setup>
import { useRoute } from 'vue-router';
const route = useRoute();
const linkClass = (path) => route.path === path ? 'font-bold text-blue-600' : 'text-gray-600';
</script>

