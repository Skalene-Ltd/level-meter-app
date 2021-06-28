const app = Vue.createApp({
  data() { return {
    isSerialSupported: 'serial' in navigator,
    availablePorts: [],
    selectedPort: null
  } },
  methods: {
    async connect() {
      const Serial = navigator.serial;
      const port = await Serial.requestPort();
      this.availablePorts.push(port);
      this.selectedPort = port;
    }
  }
});
const vm = app.mount('#app');
