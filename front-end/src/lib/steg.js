export async function embedInImage(imageFile, dataBytes) {
  const img = await createImageBitmap(imageFile);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = pixelData.data;

  // Prepend 4-byte big-endian length header
  const len = dataBytes.length;
  const payload = new Uint8Array(4 + len);
  payload[0] = (len >>> 24) & 0xff;
  payload[1] = (len >>> 16) & 0xff;
  payload[2] = (len >>> 8) & 0xff;
  payload[3] = len & 0xff;
  payload.set(dataBytes, 4);

  const bitsNeeded = payload.length * 8;
  // Each pixel has R, G, B channels available (skip alpha at index 3)
  const channelsAvailable = Math.floor(pixels.length / 4) * 3;
  if (bitsNeeded > channelsAvailable) throw new Error("Image too small to hold the message");

  let bitIdx = 0;
  outer: for (let i = 0; i < pixels.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      if (bitIdx >= bitsNeeded) break outer;
      const bytePos = Math.floor(bitIdx / 8);
      const bitPos = 7 - (bitIdx % 8);
      const bit = (payload[bytePos] >>> bitPos) & 1;
      pixels[i + ch] = (pixels[i + ch] & 0xfe) | bit;
      bitIdx++;
    }
  }

  ctx.putImageData(pixelData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}

export async function extractFromImage(imageBlob) {
  const img = await createImageBitmap(imageBlob);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  function readBits(startBit, count) {
    const result = new Uint8Array(Math.ceil(count / 8));
    for (let i = 0; i < count; i++) {
      const globalBit = startBit + i;
      const pixelIdx = Math.floor(globalBit / 3);
      const ch = globalBit % 3;
      const pxOffset = pixelIdx * 4 + ch;
      const bit = pixels[pxOffset] & 1;
      const bytePos = Math.floor(i / 8);
      const bitPos = 7 - (i % 8);
      result[bytePos] |= bit << bitPos;
    }
    return result;
  }

  // Read the 4-byte length header (32 bits)
  const header = readBits(0, 32);
  const len = (header[0] << 24) | (header[1] << 16) | (header[2] << 8) | header[3];

  return readBits(32, len * 8);
}
