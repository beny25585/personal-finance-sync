<script setup lang="ts"></script>

<template>
  <main>
    <h1>Personal Finance Sync</h1>
    <p>Android app setup is ready.</p>
  </main>
</template>

<style>
:root {
  font-family: system-ui, sans-serif;
  color: #18181b;
  background: #fafafa;
}

body {
  margin: 0;
}

main {
  box-sizing: border-box;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: max(24px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right))
    max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left));
}

h1 {
  margin: 0;
  font-size: 24px;
  color: #4f46e5;
}

p {
  margin: 12px 0 0;
  color: #52525b;
}
</style>
