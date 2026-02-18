<script setup lang="ts">
import { RouterView } from "vue-router";
</script>

<template>
  <header class="app-header">
    <div class="wrapper">🕹️ Flawless Grid</div>
  </header>
  <RouterView />
</template>

<style scoped lang="scss">
.app-header {
  height: 60px;
  background: linear-gradient(90deg, #1a1a1a 0%, #2d2d2d 100%);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  z-index: 1000;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  border-bottom: 2px solid rgba(76, 175, 80, 0.4);
}

.wrapper {
  width: 100%;
  text-align: center;
  color: #fff;
  font-size: 1.6rem;
  letter-spacing: 2px;
  font-weight: 700;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.4);
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
  background: #141414;
  color: #e0e0e0;
}
</style>
