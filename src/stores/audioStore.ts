import { atom } from 'nanostores';

export const isAudioContextReady = atom(false);

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null; // Main (Mono mix) analyser
let analyserL: AnalyserNode | null = null; // Left Channel
let analyserR: AnalyserNode | null = null; // Right Channel
let splitter: ChannelSplitterNode | null = null;

let dataArray: Uint8Array<ArrayBuffer> | null = null;
let dataArrayL: Uint8Array<ArrayBuffer> | null = null;
let dataArrayR: Uint8Array<ArrayBuffer> | null = null;

// To avoid re-connecting the same element multiple times
const connectedElements = new WeakSet<HTMLMediaElement>();

export function initAudioContext() {
  if (typeof window === 'undefined') return null;
  
  if (!audioContext) {
    const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtor) {
        console.error("Web Audio API is not supported in this browser");
        return null;
    }
    audioContext = new AudioCtor();
    
    // Main Analyser (Mono/Mix)
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    // Stereo Analysers
    analyserL = audioContext.createAnalyser();
    analyserL.fftSize = 512;
    analyserL.smoothingTimeConstant = 0.8;
    dataArrayL = new Uint8Array(analyserL.frequencyBinCount);

    analyserR = audioContext.createAnalyser();
    analyserR.fftSize = 512;
    analyserR.smoothingTimeConstant = 0.8;
    dataArrayR = new Uint8Array(analyserR.frequencyBinCount);

    // Splitter
    splitter = audioContext.createChannelSplitter(2);
    splitter.connect(analyserL, 0); // Connect Output 0 (Left) to analyserL
    splitter.connect(analyserR, 1); // Connect Output 1 (Right) to analyserR

    isAudioContextReady.set(true);
    console.log("AudioContext initialized (Stereo Mode)");
  }
  return audioContext;
}

export function connectAudioElement(element: HTMLMediaElement) {
  const ctx = initAudioContext();
  if (!ctx || !analyser || !splitter) return;

  if (connectedElements.has(element)) {
      return;
  }

  try {
      if (!element.crossOrigin) {
         element.crossOrigin = "anonymous";
      }

      const source = ctx.createMediaElementSource(element);
      
      // 1. Connect to Main Analyser (for general visualizer)
      source.connect(analyser);
      
      // 2. Connect to Splitter (for Stereo analysis)
      source.connect(splitter);

      // 3. Connect to Output (Speakers)
      analyser.connect(ctx.destination);
      
      connectedElements.add(element);
      console.log(`✅ Audio element connected (Stereo): ${element.id}`);
      
      element.onplay = () => {
          console.log(`▶️ Audio element playing: ${element.id}`);
          resumeAudioContext();
      };
      
  } catch (e) {
      console.warn("❌ Error connecting audio element:", e);
  }
}

export function getAudioData(): Uint8Array<ArrayBuffer> {
    if (!analyser || !dataArray) return new Uint8Array(0);
    analyser.getByteFrequencyData(dataArray);
    return dataArray;
}

export function getStereoData() {
    if (!analyserL || !analyserR || !dataArrayL || !dataArrayR) {
        return { left: 0, right: 0 };
    }
    
    analyserL.getByteFrequencyData(dataArrayL);
    analyserR.getByteFrequencyData(dataArrayR);

    const sumL = dataArrayL.reduce((a, b) => a + b, 0);
    const sumR = dataArrayR.reduce((a, b) => a + b, 0);
    
    const avgL = sumL / dataArrayL.length;
    const avgR = sumR / dataArrayR.length;

    return { left: avgL, right: avgR };
}

export function getAverageVolume(): number {
    const data = getAudioData();
    if (data.length === 0) return 0;
    
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i];
    }
    return sum / data.length;
}

export function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}