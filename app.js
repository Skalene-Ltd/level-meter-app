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

app.component('serial-port-item', {
  props: ['port'],
  template: `<li>a port</li>`
});

const vm = app.mount('#app');
