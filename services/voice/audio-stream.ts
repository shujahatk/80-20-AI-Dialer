/**
 * Audio Conversion and Media Streaming Utilities for PSTN / Twilio Media Streams
 */

// μ-law compression lookup tables
const BIAS = 0x84; // 132
const CLIP = 32635;

/**
 * Converts 16-bit linear PCM sample (-32768 to 32767) to 8-bit μ-law sample (0 to 255)
 */
export function linearToUlawSample(sample: number): number {
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > CLIP) sample = CLIP;
  sample += BIAS;

  let exponent = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) {
    exponent--;
  }

  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  const ulawByte = ~(sign | (exponent << 4) | mantissa) & 0xff;
  return ulawByte;
}

/**
 * Converts 8-bit μ-law sample (0 to 255) to 16-bit linear PCM sample (-32768 to 32767)
 */
export function ulawToLinearSample(ulawByte: number): number {
  const byte = ~ulawByte & 0xff;
  const sign = byte & 0x80;
  const exponent = (byte >> 4) & 0x07;
  const mantissa = byte & 0x0f;

  let sample = ((mantissa << 3) + BIAS) << exponent;
  sample -= BIAS;
  return sign !== 0 ? -sample : sample;
}

/**
 * Converts Int16Array PCM buffer to Uint8Array μ-law buffer
 */
export function pcmToUlaw(pcmData: Int16Array): Uint8Array {
  const ulaw = new Uint8Array(pcmData.length);
  for (let i = 0; i < pcmData.length; i++) {
    ulaw[i] = linearToUlawSample(pcmData[i]);
  }
  return ulaw;
}

/**
 * Converts Uint8Array μ-law buffer to Int16Array PCM buffer
 */
export function ulawToPcm(ulawData: Uint8Array): Int16Array {
  const pcm = new Int16Array(ulawData.length);
  for (let i = 0; i < ulawData.length; i++) {
    pcm[i] = ulawToLinearSample(ulawData[i]);
  }
  return pcm;
}

/**
 * Downsamples PCM data from sourceSampleRate (e.g. 16000 or 24000) to 8000Hz (telephony rate)
 */
export function downsampleTo8kHz(
  inputPcm: Int16Array,
  sourceSampleRate: number
): Int16Array {
  if (sourceSampleRate === 8000) return inputPcm;

  const ratio = sourceSampleRate / 8000;
  const outputLength = Math.round(inputPcm.length / ratio);
  const output = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    output[i] = inputPcm[srcIndex] || 0;
  }

  return output;
}

/**
 * Encodes μ-law audio bytes into Twilio Media Stream base64 payload
 */
export function encodeTwilioMediaFrame(
  streamSid: string,
  ulawBytes: Uint8Array,
  sequence?: number
): string {
  let binary = '';
  for (let i = 0; i < ulawBytes.byteLength; i++) {
    binary += String.fromCharCode(ulawBytes[i]);
  }
  const base64 = typeof Buffer !== 'undefined'
    ? Buffer.from(ulawBytes).toString('base64')
    : btoa(binary);

  return JSON.stringify({
    event: 'media',
    streamSid,
    sequenceNumber: sequence?.toString(),
    media: {
      payload: base64,
    },
  });
}

/**
 * Decodes Twilio Media Stream base64 payload into raw μ-law bytes
 */
export function decodeTwilioMediaPayload(base64Payload: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64Payload, 'base64'));
  }
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Calculates Root Mean Square (RMS) energy level from PCM audio samples (normalized 0.0 to 1.0)
 */
export function calculateRmsEnergy(pcmSamples: Int16Array): number {
  if (pcmSamples.length === 0) return 0;
  let sumSquares = 0;
  for (let i = 0; i < pcmSamples.length; i++) {
    const normalized = pcmSamples[i] / 32768;
    sumSquares += normalized * normalized;
  }
  return Math.min(1.0, Math.sqrt(sumSquares / pcmSamples.length) * 3);
}
