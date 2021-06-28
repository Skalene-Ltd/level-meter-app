const app = Vue.createApp({
  data() { return {
    isSerialSupported: 'serial' in navigator,
    availablePorts: []
  } }
});
const vm = app.mount('#app');
console.log(vm.isSerialSupported);
