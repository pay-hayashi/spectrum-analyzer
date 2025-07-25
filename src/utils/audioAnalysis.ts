import FFT from 'fft.js';

export interface SpectrogramData {
  frequencies: number[];
  times: number[];
  magnitudes: number[][];
}

export interface FundamentalFrequencyData {
  times: number[];
  frequencies: number[];
}

export class AudioAnalyzer {
  private fftSize: number;
  private hopSize: number;
  private sampleRate: number;

  constructor(fftSize: number = 2048, hopSize?: number) {
    this.fftSize = fftSize;
    this.hopSize = hopSize || Math.floor(fftSize / 4);
    this.sampleRate = 0;
  }

  public analyzeSpectrum(audioBuffer: AudioBuffer): SpectrogramData {
    this.sampleRate = audioBuffer.sampleRate;
    
    const channelData = audioBuffer.getChannelData(0);
    const fft = new FFT(this.fftSize);
    
    const frequencies = this.generateFrequencyBins();
    const times: number[] = [];
    const magnitudes: number[][] = [];

    const windowFunction = this.generateHammingWindow(this.fftSize);

    for (let i = 0; i + this.fftSize <= channelData.length; i += this.hopSize) {
      const segment = new Array(this.fftSize);
      
      for (let j = 0; j < this.fftSize; j++) {
        segment[j] = channelData[i + j] * windowFunction[j];
      }

      const spectrum = fft.createComplexArray();
      fft.realTransform(spectrum, segment);
      
      const magnitude = this.calculateMagnitude(spectrum);
      
      times.push(i / this.sampleRate);
      magnitudes.push(magnitude);
    }

    return {
      frequencies,
      times,
      magnitudes
    };
  }

  public extractFundamentalFrequency(spectrogramData: SpectrogramData): FundamentalFrequencyData {
    const fundamentalFrequencies: number[] = [];
    
    for (const magnitudeFrame of spectrogramData.magnitudes) {
      const fundamental = this.estimateFundamentalFrequency(
        spectrogramData.frequencies,
        magnitudeFrame
      );
      fundamentalFrequencies.push(fundamental);
    }

    return {
      times: spectrogramData.times,
      frequencies: fundamentalFrequencies
    };
  }

  private generateFrequencyBins(): number[] {
    const frequencies: number[] = [];
    const binSize = this.sampleRate / this.fftSize;
    
    for (let i = 0; i < this.fftSize / 2; i++) {
      frequencies.push(i * binSize);
    }
    
    return frequencies;
  }

  private generateHammingWindow(size: number): number[] {
    const window: number[] = [];
    for (let i = 0; i < size; i++) {
      window[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (size - 1));
    }
    return window;
  }

  private calculateMagnitude(complexSpectrum: number[]): number[] {
    const magnitude: number[] = [];
    
    for (let i = 0; i < complexSpectrum.length; i += 2) {
      const real = complexSpectrum[i];
      const imag = complexSpectrum[i + 1];
      magnitude.push(Math.sqrt(real * real + imag * imag));
    }
    
    return magnitude.slice(0, this.fftSize / 2);
  }

  private estimateFundamentalFrequency(frequencies: number[], magnitudes: number[]): number {
    if (magnitudes.length === 0) return 0;

    const minFreq = 80;
    const maxFreq = 2000;
    
    const startIdx = frequencies.findIndex(f => f >= minFreq);
    const endIdx = frequencies.findIndex(f => f >= maxFreq);
    
    if (startIdx === -1 || endIdx === -1) return 0;

    const candidateFrequencies: { freq: number; strength: number }[] = [];
    
    for (let i = startIdx; i < endIdx; i++) {
      const freq = frequencies[i];
      const magnitude = magnitudes[i];
      
      if (magnitude > 0.1) {
        const harmonicStrength = this.calculateHarmonicStrength(
          freq, frequencies, magnitudes
        );
        
        candidateFrequencies.push({
          freq,
          strength: magnitude * harmonicStrength
        });
      }
    }

    if (candidateFrequencies.length === 0) return 0;

    candidateFrequencies.sort((a, b) => b.strength - a.strength);
    
    return candidateFrequencies[0].freq;
  }

  private calculateHarmonicStrength(
    fundamentalFreq: number,
    frequencies: number[],
    magnitudes: number[]
  ): number {
    const harmonics = [2, 3, 4, 5];
    let totalStrength = 1;
    
    for (const harmonic of harmonics) {
      const harmonicFreq = fundamentalFreq * harmonic;
      const closestIdx = this.findClosestFrequencyIndex(harmonicFreq, frequencies);
      
      if (closestIdx !== -1 && Math.abs(frequencies[closestIdx] - harmonicFreq) < 20) {
        totalStrength += magnitudes[closestIdx] * (1 / harmonic);
      }
    }
    
    return totalStrength;
  }

  private findClosestFrequencyIndex(targetFreq: number, frequencies: number[]): number {
    let closestIdx = -1;
    let minDiff = Infinity;
    
    for (let i = 0; i < frequencies.length; i++) {
      const diff = Math.abs(frequencies[i] - targetFreq);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }
    
    return closestIdx;
  }
}