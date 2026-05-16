<script setup lang="ts">
import { ref, onMounted } from "vue";

type Item = { id: number; name: string };

const items = ref<Item[]>([]);
const newName = ref("");

async function fetchItems() {
  const res = await fetch("/api/items");
  items.value = await res.json();
}

async function addItem() {
  const name = newName.value.trim();
  if (!name) return;
  await fetch("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  newName.value = "";
  await fetchItems();
}

onMounted(fetchItems);
</script>

<template>
  <main style="padding: 2rem; font-family: sans-serif">
    <h1>{{PROJECT_NAME}}</h1>
    <form @submit.prevent="addItem">
      <input v-model="newName" placeholder="Item name" />
      <button type="submit">Add</button>
    </form>
    <ul>
      <li v-for="item in items" :key="item.id">{{ item.name }}</li>
    </ul>
  </main>
</template>
