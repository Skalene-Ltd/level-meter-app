const UNLOCK_COMMAND = 0xA0;
const DATA_COMMAND = 0xA1;
const VERIFY_COMMAND = 0xA2;
const SWAP_COMMAND = 0xA4;
const ERASE_SIZE = 16384;
const ADDRESS = 0x9D100000;
const OKAY_RESPONSE = 0x50;
const CRC_OKAY = 0x53;

const SK_GET_RESULTS = 9;
const SK_GET_LIVE_DATA = 17;
const SK_DEBUG = 20;

// custom 'SkFatalError' type handles fatal errors
class SkFatalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SkFatalError';
  }
}

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

const crc16ccittTable = new Int32Array([
  0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7,
  0x8108, 0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad, 0xe1ce, 0xf1ef,
  0x1231, 0x0210, 0x3273, 0x2252, 0x52b5, 0x4294, 0x72f7, 0x62d6,
  0x9339, 0x8318, 0xb37b, 0xa35a, 0xd3bd, 0xc39c, 0xf3ff, 0xe3de,
  0x2462, 0x3443, 0x0420, 0x1401, 0x64e6, 0x74c7, 0x44a4, 0x5485,
  0xa56a, 0xb54b, 0x8528, 0x9509, 0xe5ee, 0xf5cf, 0xc5ac, 0xd58d,
  0x3653, 0x2672, 0x1611, 0x0630, 0x76d7, 0x66f6, 0x5695, 0x46b4,
  0xb75b, 0xa77a, 0x9719, 0x8738, 0xf7df, 0xe7fe, 0xd79d, 0xc7bc,
  0x48c4, 0x58e5, 0x6886, 0x78a7, 0x0840, 0x1861, 0x2802, 0x3823,
  0xc9cc, 0xd9ed, 0xe98e, 0xf9af, 0x8948, 0x9969, 0xa90a, 0xb92b,
  0x5af5, 0x4ad4, 0x7ab7, 0x6a96, 0x1a71, 0x0a50, 0x3a33, 0x2a12,
  0xdbfd, 0xcbdc, 0xfbbf, 0xeb9e, 0x9b79, 0x8b58, 0xbb3b, 0xab1a,
  0x6ca6, 0x7c87, 0x4ce4, 0x5cc5, 0x2c22, 0x3c03, 0x0c60, 0x1c41,
  0xedae, 0xfd8f, 0xcdec, 0xddcd, 0xad2a, 0xbd0b, 0x8d68, 0x9d49,
  0x7e97, 0x6eb6, 0x5ed5, 0x4ef4, 0x3e13, 0x2e32, 0x1e51, 0x0e70,
  0xff9f, 0xefbe, 0xdfdd, 0xcffc, 0xbf1b, 0xaf3a, 0x9f59, 0x8f78,
  0x9188, 0x81a9, 0xb1ca, 0xa1eb, 0xd10c, 0xc12d, 0xf14e, 0xe16f,
  0x1080, 0x00a1, 0x30c2, 0x20e3, 0x5004, 0x4025, 0x7046, 0x6067,
  0x83b9, 0x9398, 0xa3fb, 0xb3da, 0xc33d, 0xd31c, 0xe37f, 0xf35e,
  0x02b1, 0x1290, 0x22f3, 0x32d2, 0x4235, 0x5214, 0x6277, 0x7256,
  0xb5ea, 0xa5cb, 0x95a8, 0x8589, 0xf56e, 0xe54f, 0xd52c, 0xc50d,
  0x34e2, 0x24c3, 0x14a0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405,
  0xa7db, 0xb7fa, 0x8799, 0x97b8, 0xe75f, 0xf77e, 0xc71d, 0xd73c,
  0x26d3, 0x36f2, 0x0691, 0x16b0, 0x6657, 0x7676, 0x4615, 0x5634,
  0xd94c, 0xc96d, 0xf90e, 0xe92f, 0x99c8, 0x89e9, 0xb98a, 0xa9ab,
  0x5844, 0x4865, 0x7806, 0x6827, 0x18c0, 0x08e1, 0x3882, 0x28a3,
  0xcb7d, 0xdb5c, 0xeb3f, 0xfb1e, 0x8bf9, 0x9bd8, 0xabbb, 0xbb9a,
  0x4a75, 0x5a54, 0x6a37, 0x7a16, 0x0af1, 0x1ad0, 0x2ab3, 0x3a92,
  0xfd2e, 0xed0f, 0xdd6c, 0xcd4d, 0xbdaa, 0xad8b, 0x9de8, 0x8dc9,
  0x7c26, 0x6c07, 0x5c64, 0x4c45, 0x3ca2, 0x2c83, 0x1ce0, 0x0cc1,
  0xef1f, 0xff3e, 0xcf5d, 0xdf7c, 0xaf9b, 0xbfba, 0x8fd9, 0x9ff8,
  0x6e17, 0x7e36, 0x4e55, 0x5e74, 0x2e93, 0x3eb2, 0x0ed1, 0x1ef0
]);

const crc16ccitt = buffer => new Uint8Array(buffer).reduce(
  (accumulator, current) => (crc16ccittTable[((accumulator >> 8) ^ current) & 0xff] ^ (accumulator << 8)) & 0xffff,
  0xffff
);

const intToBuffer = i => Uint8Array.from([
  (i >>> 0) & 0xff,
  (i >>> 8) & 0xff,
  (i >>> 16) & 0xff,
  (i >>> 24) & 0xff
]).buffer;

const sendSkaleneCommand = async (writable, bodyText) => {
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const bodyArray = encoder.encode(bodyText);
  const colonArray = encoder.encode(':');

  const payloadArray = new Uint8Array(bodyArray.length + colonArray.length);
  payloadArray.set(bodyArray, 0);
  payloadArray.set(colonArray, bodyArray.length);

  const crc = crc16ccitt(payloadArray.buffer);
  const crcBuffer = encoder.encode(crc.toString(10)).buffer;

  const crlfBuffer = encoder.encode('\r\n').buffer;

  try {
    await writer.write(payloadArray.buffer);
    await writer.write(crcBuffer);
    await writer.write(crlfBuffer);
  } finally {
    writer.releaseLock();
  }
};

const sendBootloaderCommand = async (writable, command, bodyBuffers) => {
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
    try {
      reader.releaseLock();
    } catch (e) {
      console.error(e);
      const fatal = new SkFatalError('No response from device');
      fatal.details = `The app can't use the serial port because it couldn't receive a response from the device.
      Refresh the page to try again.`;
      throw fatal;
    }
  });
};

const parseSkaleneMessage = payload => {
  const parts = payload.split(':');

  if (parts.length !== 2) {
    throw new Error('malformed payload');
  }

  const [message, crcText] = parts;
  const crcValue = parseInt(crcText);
  const messageBuffer = new TextEncoder().encode(message + ':').buffer;
  const expectedCrc = crc16ccitt(messageBuffer);

  if (crcValue !== expectedCrc) {
    throw new Error(`invalid crc. got ${crcValue}. expected ${expectedCrc}. payload: ${payload}`);
  }

  const errorCode = message.split(' ').pop();
  if (parseInt(errorCode) !== 0) {
    throw new Error(`got error code ${errorCode}. payload: ${payload}`);
  }

  return message;
};

const querySkalene = (bodyText, readable, writable) => {
  var sendInterval;
  var rejectTimeout;

  var reader = readable.getReader();

  return new Promise(async (resolve, reject) => {
    // hard limit of 10 seconds to give up whatever happens
    rejectTimeout = setTimeout(
      () => { reject(new Error('query time-out')); },
      10_000
    );

    for (var i = 0; i < 10; i++) {
      sendSkaleneCommand(writable, bodyText);

      sendInterval = setInterval(() => {
        sendSkaleneCommand(writable, bodyText);
      }, 1_000);

      const { value, done } = await reader.read();

      if (done) { throw new Error('stream cancelled'); }

      try {
        const response = parseSkaleneMessage(value);
        return resolve(response);
      } catch (e) {
        return reject(e);
      }
    }
  }).finally(() => {
    clearInterval(sendInterval);
    clearTimeout(rejectTimeout);
    reader.releaseLock();
  });
};

const textDecoder = new TextDecoder();

const textDecoderTransformStream = new TransformStream({
  transform(chunk, controller) {
    controller.enqueue(textDecoder.decode(chunk));
  }
});

class DelimiterTransformer {
  constructor(delimiter) {
    this.delimiter = delimiter;
    this.bufferString = ""
  }
  transform(chunk, controller) {
    this.bufferString += chunk;
    let position;
    while ((position = this.bufferString.indexOf(this.delimiter)) !== -1) {
      controller.enqueue(this.bufferString.slice(0, position));
      this.bufferString = this.bufferString.slice(position + this.delimiter.length);
    }
  }
};

const readLineTransformStream = new TransformStream(
  new DelimiterTransformer('\r\n')
);

const debugMessageFilterTransformStream = new TransformStream({
  transform(chunk, controller) {
    if (chunk.startsWith(`${SK_DEBUG} `)) {
      controller.enqueue(chunk);
    }
  }
});

const notDebugMessageFilterTransformStream = new TransformStream({
  transform(chunk, controller) {
    if (!chunk.startsWith(`${SK_DEBUG} `)) {
      controller.enqueue(chunk);
    }
  }
});

const app = Vue.createApp({
  data() { return {
    isSerialSupported: 'serial' in navigator,
    serialPort: null,
    rawSerialReadable: null,
    debugMessageReadable: null,
    responseMessageReadable: null,
    bootloaderFile: null,
    serialStatus: null,
    bootloaderStatus: null,
    fatalError: null
  } },
  methods: {
    async connect() {
      try {
        if (this.serialPort) {
          throw new Error('already connected to a serial port');
        }
        const Serial = navigator.serial;
        this.serialPort = await Serial.requestPort();
        try {
          await this.serialPort.open({ baudRate: 115200, bufferSize: 65536 });
          const teed = this.serialPort.readable.tee();
          this.rawSerialReadable = teed[0];
          const linesReadableTeed = teed[1]
            .pipeThrough(textDecoderTransformStream)
            .pipeThrough(readLineTransformStream)
            .tee();
          this.debugMessageReadable = linesReadableTeed[0]
            .pipeThrough(debugMessageFilterTransformStream);
          this.responseMessageReadable = linesReadableTeed[1]
            .pipeThrough(notDebugMessageFilterTransformStream);
          this.serialStatus = null;
        } catch (e) {
          this.serialPort =
            this.rawSerialReadable =
            this.debugMessageReadable =
            this.responseMessageReadable =
            null;
          throw e;
        }
      } catch (e) {
        this.serialStatus = {
          kind: 'problem',
          details: e.message
        };
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
      const readable = this.rawSerialReadable;

      try {
        this.bootloaderStatus = {
          kind: 'info',
          details: 'unlocking...'
        };
        await sendBootloaderCommand(writable, UNLOCK_COMMAND, [
          intToBuffer(ADDRESS),
          intToBuffer(bootloaderPayloadBuffer.byteLength)
        ]);
        const unlockResponse = await readUnwrapOrTimeout(readable, 10000);
        if (unlockResponse !== OKAY_RESPONSE) {
          throw new Error(`unlock: invalid response code: ${unlockResponse}`);
        }

        this.bootloaderStatus.details = 'programming...';
        const numberOfBlocks = Math.ceil(bootloaderPayloadBuffer.byteLength / ERASE_SIZE);
        const indices = [...Array(numberOfBlocks).keys()].map(i => i * ERASE_SIZE);
        for (const index of indices) {
          const block = bootloaderPayloadBuffer.slice(index, index + ERASE_SIZE);
          await sendBootloaderCommand(writable, DATA_COMMAND, [
            intToBuffer(ADDRESS + index),
            block
          ]);
          const blockResponse = await readUnwrapOrTimeout(readable, 10000);
          if (blockResponse !== OKAY_RESPONSE) {
            throw new Error(`block write: invalid response code: ${blockResponse}`);
          }
        }

        this.bootloaderStatus.details = 'verifying...'
        const crc = crc32(bootloaderPayloadArray, crc32Tab);
        await sendBootloaderCommand(writable, VERIFY_COMMAND, [intToBuffer(crc)]);
        const verificationResponse = await readUnwrapOrTimeout(readable, 10000);
        if (verificationResponse !== CRC_OKAY) {
          throw new Error(`verification failed: response code ${verificationResponse}`);
        }

        this.bootloaderStatus.details = 'swapping bank and rebooting...';
        await sendBootloaderCommand(writable, SWAP_COMMAND, [new ArrayBuffer(16)]);
        const swapResponse = await readUnwrapOrTimeout(readable, 10000);
        if (swapResponse !== OKAY_RESPONSE) {
          throw new Error(`swap and reboot failed: response code ${swapResponse}`);
        }
        this.bootloaderStatus = {
          kind: 'success',
          details: 'programming complete'
        };
      } catch (e) {
        if (e instanceof SkFatalError) {
          this.fatalError = e;
        }
        this.bootloaderStatus = {
          kind: 'problem',
          details: e.message
        };
        console.error(e);
      }
    }
  }
});

app.component('fatal-error-message', {
  props: ['error'],
  template: `<section class="sk-notice sk-notice--problem sk--sticky">
    <h2 class="sk-notice__headline">Fatal error: {{ error.message }}</h2>
    <p v-if="error.details" class="sk-notice__details">{{ error.details }}</p>
    <a v-if="error.helpURL" v-bind:href="error.helpURL" target="_blank">Help</a>
  </section>`
});

app.component('inline-status', {
  props: ['kind', 'details'],
  template: `<div class="sk--flex-greedy sk--flex">
    <div class="sk-notice--inline" v-bind:class="'sk--' + kind">{{ details }}</div>
  </div>`
});

app.component('serial-port-details', {
  props: ['port'],
  data() { return {
    usbVendorId: undefined,
    usbProductId: undefined
  } },
  template: `<div class="sk--flex sk--flex-gap sk--flex-wrap sk--flex-vertical-centre-items">
    <div aria-hidden="true" style="font-size:3rem">✅</div>
    <div class="sk--flex-auto">
      <h3 style="font-size:1rem;margin:0 0 0.5rem 0;font-weight:500">connected</h3>
      <p style="margin:0">
        vendor ID: <span class="sk--code">{{ usbVendorId || 'unknown' }}</span>
        product ID: <span class="sk--code">{{ usbProductId || 'unknown' }}</span>
      </p>
    </div>
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

app.component('results-panel', {
  props: ['port', 'readable'],
  data() { return {
    results: null
  } },
  computed: {
    ready() { return Boolean(this.port && this.readable) }
  },
  methods: {
    async getResults() {
      try {
        if (!this.port) {
          throw new Error('no serial port connected');
        }
        const response = await querySkalene(SK_GET_RESULTS + '', this.readable, this.port.writable);
        this.results = response
          .split(' ')
          .slice(1, 8)
          .map(parseInt);
      } catch (e) {
        alert(e);
      }
    }
  },
  template: `<section class="sk-panel">
    <div class="sk-panel__header">
      <h2 class="sk-panel__title">Results</h2>
      <div>
        <button
          class="sk-button sk-button--primary"
          v-on:click.prevent="getResults"
          v-bind:disabled="!ready"
        >get results</button>
      </div>
    </div>
    <div class="sk-panel__body">
      <div v-if="results">{{ results }}</div>
      <div v-else class="sk-panel__empty">no results</div>
    </div>
  </section>`
});

app.component('raw-data-panel', {
  props: ['port', 'readable'],
  data() { return {
    rawData: [],
    progress: null,
    errorText: null,
    fileContent: null
  } },
  template: `<section class="sk-panel">
    <div class="sk-panel__header">
      <h2 class="sk-panel__title">Raw data</h2>

      <inline-status v-if="errorText" v-bind:kind="'problem'" v-bind:details="errorText"></inline-status>
      <div v-else-if="progress !== null" class="sk--flex-greedy">
        <progress v-bind:value="progress" max="128"></progress>
      </div>

      <div>
        <button class="sk-button sk-button--primary" v-on:click.prevent="getRaw" v-bind:disabled="!port || (progress !== null)">retrieve raw data</button>
      </div>
    </div>
    <div class="sk-panel__body">
      <div v-if="!fileContent || progress !== null" class="sk-panel__empty">no data</div>
      <div v-if="fileContent && progress === null" class="sk--flex sk--flex-gap sk--flex-wrap sk--flex-vertical-centre-items">
        <div aria-hidden="true" style="font-size:3rem">📄</div>
        <div class="sk--flex-auto">
          skalene-raw-data.csv
          <button v-on:click.prevent="downloadRaw" class="sk-button sk-button--primary">⭳ download</button>
        </div>
      </div>
    </div>
  </section>`,
  methods: {
    downloadRaw() {
      const el = document.createElement('a');
      el.setAttribute(
        'href',
        'data:text/csv;charset=utf-8,' + encodeURIComponent(this.fileContent)
      );
      el.setAttribute('download', 'skalene-raw-data.csv');
      el.style.display = 'none';
      document.body.appendChild(el);
      el.click();
      document.body.removeChild(el);
    },
    async getRaw() {
      try {
        if (!this.port) {
          throw new Error('no serial port connected');
        }
        const readable = this.readable;
        const writable = this.port.writable;
        for (const i of [...Array(128).keys()]) {
          this.progress = i;
          const result = await querySkalene(`11 ${i}`, readable, writable);
          this.rawData = this.rawData.concat(result
            .split(' ')
            .slice(2, -1)
          );
        }
        this.progress = 128;
        this.errorText = null;
        this.fileContent = 'q, w, e, r, t, y, u, i\r\n';
        for (let i = 0; i < Math.ceil(this.rawData.length / 8); i++) {
          this.fileContent += this.rawData
            .slice(i * 8, i * 8 + 8)
            .join(', ')
            + '\r\n';
        }
        this.progress = null;
      } catch (e) {
        this.progress = null;
        this.fileContent = '';
        console.error(e);
        this.errorText = e.message;
      }
    }
  }
});

app.component('debug-panel', {
  props: ['readable'],
  data() { return {
    text: ''
  } },
  template: `<section class="sk-panel">
    <div class="sk-panel__header">
      <h2 class="sk-panel__title">Debug</h2>
    </div>
    <div class="sk-panel__body">
      <pre class="sk--code sk--margin-0 sk--height-20rem sk--vertical-overflow-scrollable">{{ text }}</pre>
    </div>
  </section>`,
  beforeUpdate() {
    if (this.readable && !this.readable.locked) {
      const output = new WritableStream({
        write: chunk => {
          this.text = this.text
            .split('\n')
            .concat(chunk)
            .slice(-30)
            .join('\n');
        }
      });
      this.readable.pipeTo(output);
    }
  }
});

app.component('peak-meter', {
  props: ['value', 'isActive'],
  data() { return {
    max: null
  } },
  computed: {
    currentTransform() {
      return isNaN(this.value) ?
        'none'
        : `translateY(${100 - this.value / 41}%)`;
    },
    maxTransform() {
      return isNaN(this.max) ?
        'none'
        : `translateY(${100 - this.max / 41}%)`;
    }
  },
  template: `<div v-on:click.prevent="clear" class="app-peak-meter" v-bind:class="{ 'app-peak-meter--active': isActive }">
    <div class="app-peak-meter__body">
      <div class="app-peak-meter__current-container">
        <div class="app-peak-meter__current" v-bind:style="{ transform: currentTransform }"></div>
      </div>
      <div class="app-peak-meter__peak-container" v-if="max !== null" v-bind:style="{ transform: maxTransform }">
        <div class="app-peak-meter__peak"></div>
      </div>
    </div>
    <div class="app-peak-meter__max">{{ max }}</div>
    <div class="app-peak-meter__value">{{ value }}</div>
  </div>`,
  methods: {
    clear() { this.max = null; }
  },
  beforeUpdate() { this.max = Math.max(this.value, this.max); }
});

app.component('live-view-panel', {
  props: ['port', 'readable'],
  data() { return {
    polling: false,
    values: []
  } },
  template: `<section class="sk-panel">
    <div class="sk-panel__header">
      <h2 class="sk-panel__title">Live data</h2>
      <div>
        <input type="checkbox" id="live_view_is_polling" v-model="polling" v-bind:disabled="!port" class="sk-checkbox" />
        <label for="live_view_is_polling">update</label>
      </div>
    </div>
    <div class="sk-panel__body">
      <div class="app-live-grid">
        <div v-for="value in values" class="app-peak-meter__wrapper">
          <peak-meter v-bind:isActive="polling" v-bind:value="value"></peak-meter>
        </div>
      </div>
    </div>
  </section>`,
  methods: {
    async poll() {
      try {
        if (!this.port) {
          throw new Error('no port connected');
        }
        const writable = this.port.writable;
        const response = await querySkalene(SK_GET_LIVE_DATA + '', this.readable, writable);
        this.values = response.split(' ').slice(1, 9);
      } catch (e) {
        console.error(e);
      }
    }
  },
  created() {
    setInterval((() => {
      if (this.polling) {
        this.poll();
      }
    }).bind(this), 200);
  }
});

const vm = app.mount('#app');
