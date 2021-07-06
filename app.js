const UNLOCK_COMMAND = 0xA0;
const DATA_COMMAND = 0xA1;
const VERIFY_COMMAND = 0xA2;
const SWAP_COMMAND = 0xA4;
const ERASE_SIZE = 16384;
const ADDRESS = 0x9D000000;
const OKAY_RESPONSE = 0x50;
const CRC_OKAY = 0x53;

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

const sendCommand = async (writable, command, bodyBuffers) => {
  const writer = writable.getWriter();

  const guardBuffer = intToBuffer(0x5048434D);

  const bodyLength = bodyBuffers
    .map(buf => buf.byteLength)
    .reduce((accumulator, length) => accumulator + length);
  const lengthBuffer = intToBuffer(bodyLength);

  const commandBuffer = Uint8Array.from([command]);

  try {
    await writer.write(guardBuffer);
  
    await writer.write(lengthBuffer);
  
    await writer.write(commandBuffer);
  
    for (const buf of bodyBuffers) {
      await writer.write(buf);
    }
  } finally {
    writer.releaseLock();
  }
};

const readUnwrapOrTimeout = (readable, timeout) => {
  const reader = readable.getReader();
  return Promise.race([
    reader.read().then(result => {
      if (result.done) {
        throw new Error('stream closed');
      }
      
      if (result.value.byteLength !== 1) {
        console.warn(`response of unexpected length. response: ${result.value}`);
      }

      return result.value[0];
    }),
    new Promise((_, reject) => {
      setTimeout(() => reject("read timeout"), timeout)
    })
  ]).finally(() => {
    reader.releaseLock();
  });
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
      const fileLength = bootloaderFileBuffer.byteLength;
      const bootloaderFileArray = new Uint8Array(bootloaderFileBuffer);

      const bootloaderPayloadArray = new Uint8Array(
        Math.ceil(fileLength / ERASE_SIZE) * ERASE_SIZE
      ).fill(0xff);
      bootloaderPayloadArray.set(bootloaderFileArray, 0);
      const bootloaderPayloadBuffer = bootloaderPayloadArray.buffer;

      const writable = this.serialPort.writable;
      const readable = this.serialPort.readable;

      console.log('unlocking');
      await sendCommand(writable, UNLOCK_COMMAND, [
        intToBuffer(ADDRESS),
        intToBuffer(16384)
      ]);
      const unlockResponse = await readUnwrapOrTimeout(readable, 10000);
      if (unlockResponse !== OKAY_RESPONSE) {
        throw new Error(`unlock: invalid response code: ${unlockResponse[0]}`);
      }
      console.log('unlocking ✅');

      console.log('programming');
      const numberOfBlocks = Math.ceil(bootloaderPayloadBuffer.byteLength / ERASE_SIZE);
      const indices = [...Array(numberOfBlocks).keys()].map(i => i * ERASE_SIZE);
      for (const index of indices) {
        const block = bootloaderPayloadBuffer.slice(index, index + ERASE_SIZE);
        await sendCommand(writable, DATA_COMMAND, [
          intToBuffer(ADDRESS + index),
          block
        ]);
        const blockResponse = await readUnwrapOrTimeout(readable, 10000);
        if (blockResponse !== OKAY_RESPONSE) {
          throw new Error(`block write: invalid response code: ${blockResponse}`);
        }
      }
      console.log('programming ✅');

      console.log('verifying');
      const crc = crc32(bootloaderPayloadArray, crc32Tab);
      await sendCommand(writable, VERIFY_COMMAND, [intToBuffer(crc)]);
      const verificationResponse = await readUnwrapOrTimeout(readable, 10000);
      if (verificationResponse !== CRC_OKAY) {
        throw new Error(`verification failed: response code ${verificationResponse}`);
      }
      console.log('verified ✅');

      console.log('swapping bank and rebooting');
      await sendCommand(writable, SWAP_COMMAND, [new ArrayBuffer(16)]);
      const swapResponse = await readUnwrapOrTimeout(readable, 10000);
      if (swapResponse !== OKAY_RESPONSE) {
        throw new Error(`swap and reboot failed: response code ${swapResponse}`);
      }
      console.log('swap and reboot ✅');
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
