const app = Vue.createApp({
  data() { return {
    isSerialSupported: 'serial' in navigator,
    availablePorts: []
  } },
  methods: {
    inform() { alert('hello'); }
  }
});
const vm = app.mount('#app');
console.log(vm.isSerialSupported);
