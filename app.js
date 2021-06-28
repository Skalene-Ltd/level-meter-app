const app = Vue.createApp({
  data() { return {
    isSerialSupported: 'serial' in navigator,
    serialPort: null
  } },
  methods: {
    async connect() {
      const Serial = navigator.serial;
      this.serialPort = await Serial.requestPort();
    }
  }
});

app.component('serial-port-details', {
  props: ['port'],
  data() { return {
    usbVendorId: undefined,
    usbProductId: undefined
  } },
  template: `<div class="app-serial-port-item">
    <h3>Vendor</h3>
    <p>{{ usbVendorId || 'unknown vendor' }}</p>
    <h3>Product ID</h3>
    <p>{{ usbProductId || 'unknown product' }}</p>
  </div>`,
  methods: {
    async getInfo() {
      const { usbVendorId, usbProductId } = await this.port.getInfo();
      this.usbVendorId = usbVendorId;
      this.usbProductId = usbProductId;
    }
  },
  created() { this.getInfo(); },
  beforeUpdate() { this.getInfo(); }
});

const vm = app.mount('#app');
