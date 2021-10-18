const UNLOCK_COMMAND = 0xA0;
const DATA_COMMAND = 0xA1;
const VERIFY_COMMAND = 0xA2;
const SWAP_COMMAND = 0xA4;
const ERASE_SIZE = 16384;
const ADDRESS = 0x9D100000;
const OKAY_RESPONSE = 0x50;
const CRC_OKAY = 0x53;

const SK_SET_CONFIG = 1;
const SK_GET_CONFIG = 3;
const SK_START = 5;
const SK_STOP = 7;
const SK_GET_RESULTS = 9;
const SK_BOOTLOADER_MODE = 13;
const SK_DEBUG = 16;
const SK_GET_LIVE_DATA = 17;
const SK_SET_INTEGRATION = 21;

// custom 'SkFatalError' type handles fatal errors
class SkFatalError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SkFatalError';
  }
}

/* stream handler processes streams. allows accessing the
** next chunk, and setting a callback for every chunk */
class StreamHandler {
  constructor() {
    // called for every incoming chunk
    this.everyChunkCallback = null;

    /* a queue of callbacks executed on a first-come-first-
    ** served basis. when the next chunk comes in, the
    ** oldest callback in the queue will be removed and
    ** called with the chunk as the only parameter. */
    this.nextCallbackQueue = [];

    const self = this;
    this.writable = new WritableStream({
      write(chunk) {
        /* check that everyChunkCallback is set before
        ** calling it */
        if (self.everyChunkCallback instanceof Function) {
          self.everyChunkCallback(chunk);
        }

        /* also pass the chunk to the next callback waiting
        ** in the nextCallbackQueue. if there aren't any
        ** callbacks waiting, do nothing */
        if (!self.nextCallbackQueue.length) {
          return;
        }

        // take the oldest callback out of the queue
        const nextCallback = self.nextCallbackQueue.shift();

        /* this check shouldn't really be necessary but if
        ** we've accidentally added a non-function to the
        ** queue we don't want it to cause a problem */
        if (nextCallback instanceof Function) {
          nextCallback(chunk);
        } else {
          console.error(new TypeError("next callback wasn't a function"));
        }
      }
    });
  }

  every(cb) {
    /* warn the programmer if there's already an
    ** everyChunkCallback set because we're going to
    ** overwrite it */
    if (this.everyChunkCallback instanceof Function) {
      console.warn('overwriting already set everyChunkCallback');
    }
    /* check that the callback we're about to set is
    ** actually a function */
    if (cb instanceof Function) {
      this.everyChunkCallback = cb;
    } else {
      throw new TypeError('callback is not a function');
    }
  }

  /* returns a promise that resolves with the next chunk or
  ** times out after `timeout` milliseconds */
  next(timeout) {
    const self = this;
    return new Promise((resolve, reject) => {
      /* assigning `resolve` to a constant allows us to
      ** remove it from the queue in the event of a timeout */
      const callback = resolve;

      /* add the callback to the nextCallbackQueue, so that
      ** the next incoming chunk resolves this promise */
      self.nextCallbackQueue.push(callback);

      // timeout after `timeout` milliseconds
      setTimeout(
        () => {
          /* delete the callback from the queue (after
          ** checking that it's still in there) */
          const index = self.nextCallbackQueue.indexOf(callback);
          if (index > -1) {
            self.nextCallbackQueue.splice(index, 1);
          }
          const err = new Error('timeout');
          err.helpURL = "/documentation/errors/timeout/#'timeout'-error";
          reject(err);
        },
        timeout
      );
    });
  }
}

class WritableHandler {
  constructor() {
    const self = this;
    this.ready = true;
    this.queue = [];
    this.readable = new ReadableStream({
      start(controller) {
        self.dispatch = chunk => controller.enqueue(chunk);
      },
      cancel(reason) {
        console.error('stream cancelled: ' + reason);
        self.dispatch = () => {};
      }
    });
  }

  askToSend(message) {
    let payload;
    if (message instanceof ArrayBuffer) {
      payload = message;
    } else if (typeof(message) === 'string') {
      payload = Uint8Array.from(message).buffer;
    } else {
      throw new TypeError('invalid message type');
    }

    if (this.ready) {
      this.ready = false;
      this.dispatch(payload);
      return Promise.resolve();
    }

    const self = this;
    return new Promise((resolve, _) => {
      self.queue.push({ payload, resolve });
    });
  }

  done() {
    if (this.queue.length === 0) { return this.ready = true; }

    const next = this.queue.shift();

    this.dispatch(next.payload);
    next.resolve();
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

/* take any object that we hope is a valid config, and
** either return a valid config, or an error. */
const parseConfig = candidate => {
  // parsed config to return
  const config = {};
  // error object to return if anything is wrong
  const errors = {};

  // window size
  const parsedWindowSize = parseInt(candidate.windowSize);
  if (0 <= parsedWindowSize && parsedWindowSize <= 3000) {
    config.windowSize = parsedWindowSize;
  } else {
    errors.windowSize = new RangeError(
      `invalid value ${candidate.windowSize}. must be between 0 and 3000`
    );
  }

  // discharge time
  const parsedDischargeTime = parseInt(candidate.dischargeTime);
  if (50 <= parsedDischargeTime && parsedDischargeTime <= 1000) {
    config.dischargeTime = parsedDischargeTime;
  } else {
    errors.dischargeTime = new RangeError(
      `invalid value ${candidate.dischargeTime}. must be between 50 and 1000`
    );
  }

  // integration time
  const parsedIntegrationTime = parseInt(candidate.integrationTime);
  if (50 <= parsedIntegrationTime && parsedIntegrationTime <= 5000) {
    config.integrationTime = parsedIntegrationTime;
  } else {
    errors.integrationTime = new RangeError(
      `invalid value ${candidate.integrationTime}. must be between 50 and 5000`
    );
  }

  // start trigger
  const parsedStartTrigger = parseInt(candidate.startTrigger);
  if ([0, 1, 2].includes(parsedStartTrigger)) {
    config.startTrigger = parsedStartTrigger;
  } else {
    errors.startTrigger = new RangeError(
      `invalid value ${candidate.startTrigger}. must be 0, 1, or 2`
    );
  }

  // stop trigger
  const parsedStopTrigger = parseInt(candidate.stopTrigger);
  if ([0, 1].includes(parsedStopTrigger)) {
    config.stopTrigger = parsedStopTrigger;
  } else {
    errors.stopTrigger = new RangeError(
      `invalid value ${candidate.stopTrigger}. must be 0 or 1`
    );
  }

  // led powers
  const candidateLeds = candidate.leds;
  if (!(candidateLeds instanceof Array && candidateLeds.length === 8)) {
    errors.leds = new TypeError(
      `must be Array of length 8`
    );
  } else {
    const check = candidateLed => {
      const parsedLed = parseInt(candidateLed);
      if (0 <= parsedLed && parsedLed <= 100) {
        return parsedLed;
      } else {
        return new RangeError(
          `invalid value ${candidateLed}. must be between 1 and 100`
        );
      }
    };
    const parsedLeds = candidateLeds.map(check);
    // if there are no errors:
    if (parsedLeds.every(x => !(x instanceof Error))) {
      config.leds = parsedLeds;
    } else {
      errors.leds = parsedLeds.map(x => x instanceof Error ? x : undefined);
    }
  }

  if (Object.keys(errors).length) {
    return { config: null, errors: errors };
  } else {
    return { config: config, errors: null };
  }
};

const sendSkaleneCommand = (writableHandler, bodyText) => {
  const encoder = new TextEncoder();

  const bodyArray = encoder.encode(bodyText);
  const colonArray = encoder.encode(':');

  const contentArray = new Uint8Array(bodyArray.length + colonArray.length);
  contentArray.set(bodyArray, 0);
  contentArray.set(colonArray, bodyArray.length);

  const crc = crc16ccitt(contentArray.buffer);
  const crcArray = encoder.encode(crc.toString(10));

  const crlfArray = encoder.encode('\r\n');

  const payloadArray = new Uint8Array(
    contentArray.length
    + crcArray.length
    + crlfArray.length
  );
  payloadArray.set(contentArray, 0);
  payloadArray.set(crcArray, contentArray.length);
  payloadArray.set(crlfArray, contentArray.length + crcArray.length);

  return writableHandler.askToSend(payloadArray.buffer);
};

const sendBootloaderCommand = async (writableHandler, command, bodyBuffers) => {
  const guardArray = Array.from(new Uint8Array(intToBuffer(0x5048434D)));

  const bodyLength = bodyBuffers
    .map(buf => buf.byteLength)
    .reduce((accumulator, length) => accumulator + length);
  const lengthArray = Array.from(new Uint8Array(intToBuffer(bodyLength)));

  const commandArray = [command];

  const bodyArray = bodyBuffers.flatMap(buf => Array.from(new Uint8Array(buf)));

  const payload = Uint8Array.from(Array.prototype.concat(
    guardArray,
    lengthArray,
    commandArray,
    bodyArray
  )).buffer;

  await writableHandler.askToSend(payload);
};

const queryBootloader = async (command, bodyBuffers, readableHandler, writableHandler, expectedResponse) => {
  await sendBootloaderCommand(writableHandler, command, bodyBuffers);

  const response = await readableHandler.next(10_000).finally(writableHandler.done());

  if (response.byteLength !== 1) {
    console.warn(`response of unexpected length. response: ${response}`);
  }
  if (response[0] !== expectedResponse) {
    throw new Error(`unexpected response code (${response[0]})`);
  }

  return response;
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

const querySkalene = async (bodyText, readableHandler, writableHandler) => {
  await sendSkaleneCommand(writableHandler, bodyText);
  const response = await readableHandler.next(10_000).finally(() => writableHandler.done());
  return parseSkaleneMessage(response);
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
    rawHandler: new StreamHandler(),
    debugMessageHandler: new StreamHandler(),
    responseMessageHandler: new StreamHandler(),
    writableHandler: null,
    bootloaderFile: null,
    serialStatus: null,
    bootloaderStatus: null,
    configStatus: null,
    configEnabled: false,
    fatalError: null,
    config: { leds: [] }
  } },
  computed: {
    isConfigValid() { return !parseConfig(this.config).errors; }
  },
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
          /* we want to take the incoming stream of bytes
          ** and split it ultimately into three streams:
          **
          ** [serialPort readable] raw bytes come in here
          **           |
          **         <tee>--------------------------------->[rawHandler]
          **           |
          **   |decode into text|
          **           |
          **   |split into lines|
          **           |
          **         <tee>-->|filter only debug messages|-->[debugMessageHandler]
          **           |
          ** |filter out debug messages|------------------->[responseMessageHandler]
          */

          // first tee
          const teed = this.serialPort.readable.tee();

          // pipe one branch of this tee to `rawHandler`
          teed[0].pipeTo(this.rawHandler.writable);

          /* pipe the other branch to the text decoder and
          ** readLine transformer, then make second tee */
          const linesReadableTeed = teed[1]
            .pipeThrough(textDecoderTransformStream)
            .pipeThrough(readLineTransformStream)
            .tee();

          /* filter one branch of this tee for only debug
          ** messages and pipe it to `debugMessageHandler` */
          linesReadableTeed[0]
            .pipeThrough(debugMessageFilterTransformStream)
            .pipeTo(this.debugMessageHandler.writable);

          /* filter the other branch for everything else
          ** and pipe it to `responseMessageHandler` */
          linesReadableTeed[1]
            .pipeThrough(notDebugMessageFilterTransformStream)
            .pipeTo(this.responseMessageHandler.writable);
          this.responseMessageHandler.every(console.log);

          // connect a new WritableHandler to the port
          this.writableHandler = new WritableHandler();
          this.writableHandler.readable.pipeTo(this.serialPort.writable);

          /* clear any errors from previous attempts to
          ** connect */
          this.serialStatus = null;
        } catch (e) {
          /* reset everything if there was an error */
          this.serialPort = null;
          this.rawHandler = new StreamHandler();
          this.debugMessageReadable = new StreamHandler();
          this.responseMessageReadable = new StreamHandler();
          this.writableHandler = null;
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
    async program(event) {
      const bootloaderFileBuffer = await this.bootloaderFile.arrayBuffer();
      const fileLength = bootloaderFileBuffer.byteLength;
      const bootloaderFileArray = new Uint8Array(bootloaderFileBuffer);

      const bootloaderPayloadArray = new Uint8Array(
        Math.ceil(fileLength / ERASE_SIZE) * ERASE_SIZE
      ).fill(0xff);
      bootloaderPayloadArray.set(bootloaderFileArray, 0);
      const bootloaderPayloadBuffer = bootloaderPayloadArray.buffer;

      try {
        if (!event.shiftKey) {
          this.bootloaderStatus = {
            kind: 'info',
            details: 'setting bootloader mode...'
          };
          await querySkalene(
            SK_BOOTLOADER_MODE + '',
            this.responseMessageHandler,
            this.writableHandler
          );
        }

        this.bootloaderStatus = {
          kind: 'info',
          details: 'unlocking...'
        };
        await queryBootloader(
          UNLOCK_COMMAND,
          [
            intToBuffer(ADDRESS),
            intToBuffer(bootloaderPayloadBuffer.byteLength)
          ],
          this.rawHandler,
          this.writableHandler,
          OKAY_RESPONSE
        ).catch(e => { throw new Error('unlock: ' + e.message) });

        this.bootloaderStatus.details = 'programming...';
        const numberOfBlocks = Math.ceil(bootloaderPayloadBuffer.byteLength / ERASE_SIZE);
        const indices = [...Array(numberOfBlocks).keys()].map(i => i * ERASE_SIZE);
        for (const index of indices) {
          const block = bootloaderPayloadBuffer.slice(index, index + ERASE_SIZE);
          await queryBootloader(
            DATA_COMMAND,
            [
              intToBuffer(ADDRESS + index),
              block
            ],
            this.rawHandler,
            this.writableHandler,
            OKAY_RESPONSE
          );
        }

        this.bootloaderStatus.details = 'verifying...'
        const crc = crc32(bootloaderPayloadArray, crc32Tab);
        await queryBootloader(VERIFY_COMMAND, [intToBuffer(crc)], this.rawHandler, this.writableHandler, CRC_OKAY);

        this.bootloaderStatus.details = 'swapping bank and rebooting...';
        await queryBootloader(SWAP_COMMAND, [new ArrayBuffer(16)], this.rawHandler, this.writableHandler, OKAY_RESPONSE);

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
    },
    async handleConfigDrop(event) {
      try {
        const items = event.dataTransfer.items;
        if (items.length !== 1) {
          throw new Error('incorrect number of files');
        }
        const droppedItem = items[0];
        if (droppedItem.kind !== 'file') {
          throw new Error('dropped item is not a file');
        }
        const configFile = droppedItem.getAsFile();
        const configText = await configFile.text();
        let configCandidate;
        try {
          configCandidate = JSON.parse(configText);
        } catch (err) { throw new Error('invalid file format'); }
        const { config, errors } = parseConfig(configCandidate);
        if (errors) {
          console.error(errors);
          throw new Error('file contained invalid config.')
        }
        console.log('done');
        this.config = config;
        this.configStatus = { kind: 'success', details: 'config loaded from file' }
      } catch (err) {
        this.configStatus = { kind: 'problem', details: err };
      }
    },
    saveConfigFile() {
      try {
        const { config, errors } = parseConfig(this.config);
        if (errors) {
          console.error(errors);
          throw new Error('invalid config');
        }
        const configText = JSON.stringify(config);
        const el = document.createElement('a');
        el.setAttribute(
          'href',
          'data:text/json;charset=utf-8,' + encodeURIComponent(configText)
        );
        el.setAttribute('download', 'config_' +
          new Date()
            .toLocaleString()
            .replaceAll(' ', '_')
            .replaceAll('/', '_')
            .replaceAll(',', '') +
          '.json'
        );
        el.style.display = 'none';
        document.body.appendChild(el);
        el.click();
        document.body.removeChild(el);
      } catch (err) {
        this.configStatus = { kind: 'problem', details: err };
      }
    },
    async getConfig() {
      this.configStatus = null;
      try {
        if (!this.serialPort) {
          throw new Error('no serial port connected')
        }

        const response = await querySkalene(
          SK_GET_CONFIG + '',
          this.responseMessageHandler,
          this.writableHandler
        );

        const parts = response.split(' ');

        if (parts.length !== 15) {
          throw new Error('invalid response from device');
        }

        const { config, errors } = parseConfig({
          windowSize: parts[1],
          dischargeTime: parts[2],
          integrationTime: parts[3],
          startTrigger: parts[4],
          stopTrigger: parts[5],
          leds: parts.slice(6, 14)
        });

        if (errors) {
          console.warn(errors);
          throw new Error('invalid config from device');
        }

        this.config = config;
      } catch (e) {
        console.error(e);
        this.configStatus = {
          kind: 'problem',
          details: e.message
        };
      }
    },
    async setConfig() {
      this.configStatus = null;
      try {
        if (!this.serialPort) {
          throw new Error('no serial port connected');
        }

        const { config, errors } = parseConfig(this.config);

        if (errors) {
          console.warn(errors);
          throw new Error('invalid config');
        }

        await querySkalene([
          SK_SET_CONFIG,
          config.windowSize,
          config.dischargeTime,
          config.integrationTime,
          config.startTrigger,
          config.stopTrigger,
          ...config.leds
        ].join(' '), this.responseMessageHandler, this.writableHandler);

        this.configStatus = {
          kind: 'success',
          details: 'set config'
        };
      } catch (e) {
        this.configStatus = {
          kind: 'problem',
          details: e.message
        };
      }
    },
    async setIntegration(integration) {
      this.configStatus = null;
      try {
        if (!this.serialPort) {
          throw new Error('no serial port connected');
        }

        const parsedIntegration = parseInt(integration);
        if (!(50 <= parsedIntegration && parsedIntegration <= 5000)) {
          console.error(`invalid integration time ${integration}`);
          throw new Error('invalid integration time');
        }

        await querySkalene(
          SK_SET_INTEGRATION + ' ' + parsedIntegration,
          this.responseMessageHandler,
          this.writableHandler
        );

        this.config.integrationTime = parsedIntegration;
      } catch (e) {
        this.configStatus = {
          kind: 'problem',
          details: e.message
        };
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
  computed: {
    className() { return 'sk-notice--inline--' + this.kind },
    detailsText() { return this.details instanceof Error ? this.details.message : this.details }
  },
  template: `<div>
    <div class="sk-notice--inline" v-bind:class="[className]">
      {{ detailsText }}
      <a v-if="details.helpURL" v-bind:href="details.helpURL" target="_blank" class="sk-notice--inline__help-link">Help</a>
    </div>
  </div>`
});

app.component('file-details', {
  props: ['file'],
  template: `<div class="sk--flex sk--flex-gap sk--flex-wrap sk--flex-vertical-centre-items">
    <div aria-hidden="true" style="font-size:3rem">📄</div>
    <div class="sk--flex-auto">{{ file.name }}</div>
  </div>`
});

app.component('results-section', {
  props: ['readableHandler', 'writableHandler'],
  data() { return {
    results: null,
    status: null
  } },
  computed: {
    ready() { return Boolean(this.readableHandler && this.writableHandler) }
  },
  methods: {
    async getResults() {
      try {
        if (!this.writableHandler) {
          throw new Error('no serial port connected');
        }
        this.status = {
          kind: 'info',
          details: 'getting results...'
        };
        const response = await querySkalene(
          SK_GET_RESULTS + '',
          this.readableHandler,
          this.writableHandler
        );
        this.results = response
          .split(' ')
          .slice(1, 9)
          .map(parseFloat);
        this.status = null;
      } catch (e) {
        console.error(e);
        this.status = {
          kind: 'problem',
          details: e
        };
      }
    }
  },
  template: `<section class="sk-sidebar__section">
    <h3 class="sk-sidebar__heading sk--float-left">Results</h3>
    <button
      class="sk-button sk-button--primary sk--float-right"
      v-on:click.prevent="getResults"
      v-bind:disabled="!ready"
    >get results</button>
    <div class="sk-sidebar__body">
      <inline-status
        v-if="status"
        v-bind:kind="status.kind"
        v-bind:details="status.details"
      ></inline-status>
      <div v-if="results" class="app-results-grid">
        <span v-for="result in results" class="sk--code">{{ result }}</span>
      </div>
      <div v-else class="sk-panel__empty">no results</div>
    </div>
  </section>`
});

app.component('raw-data-panel', {
  props: ['readableHandler', 'writableHandler'],
  data() { return {
    progress: null,
    error: null,
    fileName: null,
    rawData: null,
    analysis: null
  } },
  computed: { ready() { return Boolean(this.writableHandler && (this.progress === null)) } },
  template: `<section class="sk-panel">
    <div class="sk-panel__header">
      <h2 class="sk-panel__title">Raw data</h2>

      <inline-status v-if="error" v-bind:kind="'problem'" v-bind:details="error"></inline-status>
      <div v-else-if="progress !== null">
        <progress v-bind:value="progress" max="256"></progress>
      </div>

      <div>
        <button class="sk-button sk-button--secondary" v-on:click.prevent="getRaw" v-bind:disabled="!ready">retrieve raw data</button>
      </div>

      <div>
        <button class="sk-button sk-button--primary" v-on:click.prevent="analyse" v-bind:disabled="!(ready && rawData)">analyse</button>
      </div>
    </div>
    <div class="sk-panel__body">
      <div v-if="ready && rawData" class="sk--flex sk--flex-gap sk--flex-wrap sk--flex-vertical-centre-items">
        <div aria-hidden="true" style="font-size:3rem">📗</div>
        <div class="sk--flex-auto">
          {{ fileName }}
          <button v-on:click.prevent="downloadRaw" class="sk-button sk-button--primary">⭳ download</button>
        </div>
      </div>
      <div v-else class="sk-panel__empty">no data</div>
    </div>
    <div class="sk-panel__body">
      <div v-if="ready && analysis" class="app-results-grid" style="height:12rem">
        <div v-for="result in analysis">
          <div v-if="result" style="text-align:center">
            <span class="sk--code">{{ result.tPeak }} ms</span>
            <div style='height:1rem' style="font-size:0.8rem">{{result.derivativeCoefficients[0]}}𝑡²+{{result.derivativeCoefficients[1]}}𝑡+{{result.derivativeCoefficients[2]}}</div>
          </div>
          <span v-else>inconclusive</span>
        </div>
      </div>
      <div v-else class="sk-panel__empty" style="height:12rem;line-height:10rem">no analysis</div>
    </div>
  </section>`,
  methods: {
    downloadRaw() {
      let fileContent = [1, 2, 3, 4, 5, 6, 7, 8]
        .map(i => 'Channel ' + i)
        .join(', ')
        + '\r\n';
      for (let i = 0; i < Math.ceil(this.rawData.length / 8); i++) {
        fileContent += this.rawData
          .slice(i * 8, i * 8 + 8)
          .join(', ')
          + '\r\n';
      }
      const el = document.createElement('a');
      el.setAttribute(
        'href',
        'data:text/csv;charset=utf-8,' + encodeURIComponent(fileContent)
      );
      el.setAttribute('download', this.fileName);
      el.style.display = 'none';
      document.body.appendChild(el);
      el.click();
      document.body.removeChild(el);
    },
    async analyse() {
      this.analysis = await fetch('/.netlify/functions/get_peak_locations_from_raw_intensity_readings', {
        method: 'POST',
        body: JSON.stringify(this.rawData)
      })
        .then(res => res.json())
        .catch(error => {
          console.error(error);
          const userFriendlyError = new Error('analysis failed');
          // TODO: help link
          console.error(userFriendlyError);
          this.error = userFriendlyError;
        })
    },
    async getRaw() {
      try {
        this.error = null;
        if (!this.writableHandler) {
          throw new Error('no serial port connected');
        }
        this.rawData = [];
        for (const i of [...Array(256).keys()]) {
          this.progress = i;
          const result = await querySkalene(`11 ${i}`, this.readableHandler, this.writableHandler);
          this.rawData = this.rawData.concat(result.split(' ').slice(2, -1));
        }
        this.progress = 256;
        this.fileName = 'raw_' +
          new Date()
            .toLocaleString()
            .replaceAll(' ', '_')
            .replaceAll('/', '_')
            .replaceAll(',', '') +
          '.csv';
        this.progress = null;
        this.analysis = null;
      } catch (e) {
        this.progress = null;
        this.analysis = null;
        console.error(e);
        this.error = e;
      }
    }
  }
});

app.component('commands-section', {
  props: ['readableHandler', 'writableHandler'],
  data() { return {
    status: null
  } },
  computed: { ready() {
    return Boolean(this.readableHandler && this.writableHandler);
  } },
  methods: {
    async start() { try {
      this.status = null;
      await querySkalene(SK_START + '', this.readableHandler, this.writableHandler);
      this.status = { kind: 'success', details: 'sent START command' };
    } catch (e) {
      this.status = { kind: 'problem', details: e };
    } },
    async stop() { try {
      this.status = null;
      await querySkalene(SK_STOP + '', this.readableHandler, this.writableHandler);
      this.status = { kind: 'success', details: 'sent STOP command' };
    } catch (e) {
      this.status = { kind: 'problem', details: e };
    } }
  },
  template: `
    <div class="sk-button-group">
      <button class="sk-button sk-button--secondary" v-on:click.prevent="start" v-bind:disabled="!ready">start</button>
      <button class="sk-button sk-button--secondary" v-on:click.prevent="stop" v-bind:disabled="!ready">stop</button>
    </div>
    <inline-status
      style="padding:1ex 0"
      v-if="status"
      v-bind:kind="status.kind"
      v-bind:details="status.details"
    ></inline-status>
  `
});

app.component('debug-panel', {
  props: ['debugReadableHandler'],
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
  methods: { appendLine(line) {
    this.text = this.text
      .split('\n')
      .concat(line)
      .slice(-30)
      .join('\n');
  } },
  created() {
    this.debugReadableHandler.every(this.appendLine);
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
  props: ['readableHandler', 'writableHandler'],
  data() { return {
    polling: false,
    values: [],
    error: null
  } },
  template: `<section class="sk-panel">
    <div class="sk-panel__header">
      <h2 class="sk-panel__title">Live data</h2>
      <inline-status v-if="error" v-bind:kind="'problem'" v-bind:details="error"></inline-status>
      <div>
        <input type="checkbox" id="live_view_is_polling" v-model="polling" v-bind:disabled="!writableHandler" class="sk-checkbox" />
        <label for="live_view_is_polling">update</label>
      </div>
    </div>
    <div class="sk-panel__body">
      <div class="app-live-grid">
        <div v-for="(value, index) in values" class="app-peak-meter__wrapper">
          <h3 class="app-peak-meter__label">{{ index + 1 }}</h3>
          <peak-meter v-bind:isActive="polling" v-bind:value="value"></peak-meter>
        </div>
      </div>
    </div>
  </section>`,
  methods: {
    async poll() {
      try {
        if (!this.writableHandler) {
          throw new Error('no port connected');
        }
        const response = await querySkalene(SK_GET_LIVE_DATA + '', this.readableHandler, this.writableHandler);
        this.values = response.split(' ').slice(1, 9);
        this.error = null;
      } catch (e) {
        console.error(e);
        this.error = e;
        this.polling = false;
      }
    }
  },
  async created() { while (true) {
    if (this.polling) {
      await this.poll();
    }
    await new Promise((resolve, _) => {
      setTimeout(resolve, 200);
    });
  }}
});

const vm = app.mount('#app');
