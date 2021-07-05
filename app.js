const UNLOCK_COMMAND = 0xA0;
const DATA_COMMAND = 0xA1;
const VERIFY_COMMAND = 0xA2;
const ERASE_SIZE = 16384;
const ADDRESS = 0x9D000000;

const f = i => i & 1 ? (i >>> 1) ^ 0xedb88320 : i >>> 1;
const crc32Tab = Uint32Array.from([...Array(256).keys()])
  .map(f)
  .map(f)
  .map(f)
  .map(f)
  .map(f)
  .map(f)
  .map(f)
  .map(f);

const crc32 = (data, tab) => {
  var crc = 0xffffffff;
  for (d of data) {
    crc = tab[(crc ^ d) & 0xff] ^ (crc >>> 8);
  }
  return crc;
};

const intToBuffer = i => Uint8Array.from([
  (i >>> 0) & 0xff,
  (i >>> 8) & 0xff,
  (i >>> 16) & 0xff,
  (i >>> 24) & 0xff
]).buffer;

const sendCommand = async (writer, command, bodyBuffers) => {
  const guardBuffer = intToBuffer(0x5048434D);

  const bodyLength = bodyBuffers
    .map(buf => buf.byteLength)
    .reduce((accumulator, length) => accumulator + length);
  const lengthBuffer = intToBuffer(bodyLength);

  const commandBuffer = intToBuffer(command);

  await writer.write(guardBuffer);

  await writer.write(lengthBuffer);

  await writer.write(commandBuffer);

  for (const buf of bodyBuffers) {
    await writer.write(buf);
  }
};

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
      try {
        await this.serialPort.open({ baudRate: 115200, bufferSize: 65536 });
      } catch (e) {
        this.serialPort = null;
        console.error(e);
      }
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
    },
    async program() {
      const bootloaderFileBuffer = await this.bootloaderFile.arrayBuffer();
      console.log("got file of length: " + bootloaderFileBuffer.byteLength);

      const writer = this.serialPort.writable.getWriter();
      console.log("unlocking...");

      await sendCommand(writer, UNLOCK_COMMAND, [
        intToBuffer(ADDRESS),
        intToBuffer(16384)
      ]);

      writer.releaseLock();
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
