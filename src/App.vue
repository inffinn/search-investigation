<template>
<button @click="count++">{{count}}</button>
</template>

<script lang="ts" setup>
import {ref} from "vue";

const count = ref(0)
</script>
<style>
button {
  width: 100px;
  height: 100px;
  background: red;
}
</style>