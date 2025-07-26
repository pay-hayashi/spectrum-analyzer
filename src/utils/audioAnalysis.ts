import FFT from 'fft.js';

export interface SpectrogramData {
  frequencies: number[];
  times: number[];
  magnitudes: number[][];
}

export interface FundamentalFrequencyData {
  times: number[];
  frequencies: number[];
  confidences: number[];
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
    const confidences: number[] = [];
    
    for (let i = 0; i < spectrogramData.magnitudes.length; i++) {
      const magnitudeFrame = spectrogramData.magnitudes[i];
      const result = this.estimateFundamentalFrequencyWithConfidence(
        spectrogramData.frequencies,
        magnitudeFrame,
        i > 0 ? fundamentalFrequencies[i - 1] : 0,
        spectrogramData.magnitudes,
        i
      );
      fundamentalFrequencies.push(result.frequency);
      confidences.push(result.confidence);
    }

    return {
      times: spectrogramData.times,
      frequencies: fundamentalFrequencies,
      confidences
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
    const result = this.estimateFundamentalFrequencyWithConfidence(
      frequencies, magnitudes, 0, [], 0
    );
    return result.frequency;
  }

  private estimateFundamentalFrequencyWithConfidence(
    frequencies: number[], 
    magnitudes: number[], 
    previousFreq: number,
    allMagnitudes: number[][],
    frameIndex: number
  ): { frequency: number; confidence: number } {
    if (magnitudes.length === 0) return { frequency: 0, confidence: 0 };

    const minFreq = 80;
    const maxFreq = 2000;
    
    const startIdx = frequencies.findIndex(f => f >= minFreq);
    const endIdx = frequencies.findIndex(f => f >= maxFreq);
    
    if (startIdx === -1 || endIdx === -1) return { frequency: 0, confidence: 0 };

    const candidateFrequencies: { freq: number; strength: number; confidence: number }[] = [];
    
    for (let i = startIdx; i < endIdx; i++) {
      const freq = frequencies[i];
      const magnitude = magnitudes[i];
      
      if (magnitude > 0.1) {
        const harmonicStrength = this.calculateHarmonicStrength(
          freq, frequencies, magnitudes
        );
        
        const confidence = this.calculateConfidence(
          freq, magnitude, harmonicStrength, frequencies, magnitudes,
          previousFreq, allMagnitudes, frameIndex
        );
        
        candidateFrequencies.push({
          freq,
          strength: magnitude * harmonicStrength,
          confidence
        });
      }
    }

    if (candidateFrequencies.length === 0) return { frequency: 0, confidence: 0 };

    candidateFrequencies.sort((a, b) => b.strength - a.strength);
    
    return {
      frequency: candidateFrequencies[0].freq,
      confidence: candidateFrequencies[0].confidence
    };
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

  private calculateConfidence(
    frequency: number,
    magnitude: number,
    harmonicStrength: number,
    frequencies: number[],
    magnitudes: number[],
    previousFreq: number,
    allMagnitudes: number[][],
    frameIndex: number
  ): number {
    // 1. エネルギー比による信頼度（0-25%）
    const totalEnergy = magnitudes.reduce((sum, mag) => sum + mag * mag, 0);
    const signalEnergy = magnitude * magnitude;
    const energyRatio = Math.min(signalEnergy / totalEnergy, 0.25);
    const energyConfidence = energyRatio * 4; // 0-1に正規化

    // 2. 倍音構造による信頼度（0-25%）
    const harmonicConfidence = Math.min((harmonicStrength - 1) / 4, 0.25) * 4;

    // 3. 時間的連続性による信頼度（0-25%）
    let temporalConfidence = 0.25;
    if (previousFreq > 0 && frequency > 0) {
      const freqRatio = Math.min(frequency, previousFreq) / Math.max(frequency, previousFreq);
      temporalConfidence = Math.min(freqRatio, 0.25) * 4;
    }

    // 4. 信号対雑音比による信頼度（0-25%）
    const sortedMagnitudes = [...magnitudes].sort((a, b) => b - a);
    const noiseLevel = sortedMagnitudes.slice(Math.floor(sortedMagnitudes.length * 0.8))
      .reduce((sum, mag) => sum + mag, 0) / (sortedMagnitudes.length * 0.2);
    const snr = magnitude / (noiseLevel + 1e-10);
    const snrConfidence = Math.min(Math.log10(snr + 1) / 2, 0.25) * 4;

    // 総合信頼度を計算（0-1の範囲）
    const totalConfidence = (energyConfidence + harmonicConfidence + temporalConfidence + snrConfidence) / 4;
    
    return Math.max(0, Math.min(1, totalConfidence));
  }
}