<script setup lang="ts">
import { RouterView } from "vue-router";
</script>

<template>
  <header class="app-header">
    <div class="wrapper">Video Game Grid</div>
  </header>
  <RouterView />
</template>

<style scoped lang="scss">
.app-header {
  height: 60px;
  background: linear-gradient(90deg, #232526 0%, #414345 100%);
  /* dark gray to black gradient */
  display: flex;
  align-items: center;
  justify-content: flex-start;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.wrapper {
  width: 100%;
  text-align: center;
  color: #fff;
  font-size: 1.7rem;
  letter-spacing: 1px;
  font-weight: 600;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
}

@media (min-width: 1024px) {
  .app-header {
    height: 70px;
  }
}
</style>

<style lang="scss">
body {
  margin: 0;
  padding: 0;
  overflow-x: hidden;
}
</style>
