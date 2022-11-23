<template>
  <DepsGraph />
</template>

<script setup lang="ts">
import { ref } from "vue";
import DepsGraph from "./DepsGraph.vue";

const msg = ref<string>("World");
</script>
