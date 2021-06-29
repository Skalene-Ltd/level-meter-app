const app = Vue.createApp({
  data() { return {
    isSerialSupported: 'serial' in navigator,
    serialPort: null,
    bootloaderFile: null
  } },
  methods: {
    async connect() {
      const Serial = navigator.serial;
      this.serialPort = await Serial.requestPort();
    },
    handleDrop(e) {
      const items = e.dataTransfer.items;

      if (items.length !== 1) {
        alert('Drop one file into the drop zone.');
        throw new Error('incorrect number of files');
      }

      const droppedItem = items[0];

      if (droppedItem.kind !== 'file') {
        alert('Drop a file into the drop zone.');
        throw new Error('incorrect item type');
      }

      this.bootloaderFile = droppedItem.getAsFile();
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

app.component('file-details', {
  props: ['file'],
  template: `<div class="sk--flex sk--flex-gap sk--flex-wrap sk--flex-vertical-centre-items">
    <div aria-hidden="true" style="font-size:3rem">📄</div>
    <div class="sk--flex-auto">{{ file.name }}</div>
  </div>`
});

const vm = app.mount('#app');
