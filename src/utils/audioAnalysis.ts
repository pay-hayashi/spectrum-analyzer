import FFT from 'fft.js';

export interface SpectrogramData {
  frequencies: number[];
  times: number[];
  magnitudes: number[][];
}

export interface FrequencySpectrumData {
  frequencies: number[];
  magnitudes: number[];
}

export interface FundamentalFrequencyData {
  times: number[];
  frequencies: number[];
  confidences: number[];
}

export interface MultipleNotesData {
  times: number[];
  noteFrames: NoteFrame[];
}

export interface NoteFrame {
  time: number;
  notes: DetectedNote[];
}

export interface DetectedNote {
  frequency: number;
  confidence: number;
  magnitude: number;
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

  public extractMultipleNotes(spectrogramData: SpectrogramData, maxNotes: number = 5): MultipleNotesData {
    const noteFrames: NoteFrame[] = [];
    
    for (let i = 0; i < spectrogramData.magnitudes.length; i++) {
      const magnitudeFrame = spectrogramData.magnitudes[i];
      const time = spectrogramData.times[i];
      
      const detectedNotes = this.detectMultipleNotesInFrame(
        spectrogramData.frequencies,
        magnitudeFrame,
        maxNotes
      );
      
      noteFrames.push({
        time,
        notes: detectedNotes
      });
    }

    return {
      times: spectrogramData.times,
      noteFrames
    };
  }

  public calculateOverallFrequencySpectrum(spectrogramData: SpectrogramData): FrequencySpectrumData {
    const frequencies = spectrogramData.frequencies;
    const overallMagnitudes = new Array(frequencies.length).fill(0);
    
    // 全時間フレームにわたって各周波数の強度を積算
    for (const magnitudeFrame of spectrogramData.magnitudes) {
      for (let i = 0; i < magnitudeFrame.length && i < overallMagnitudes.length; i++) {
        overallMagnitudes[i] += magnitudeFrame[i];
      }
    }
    
    // 平均化（時間フレーム数で割る）
    const frameCount = spectrogramData.magnitudes.length;
    if (frameCount > 0) {
      for (let i = 0; i < overallMagnitudes.length; i++) {
        overallMagnitudes[i] /= frameCount;
      }
    }
    
    return {
      frequencies,
      magnitudes: overallMagnitudes
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
    _frequencies: number[],
    magnitudes: number[],
    previousFreq: number,
    _allMagnitudes: number[][],
    _frameIndex: number
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

  private detectMultipleNotesInFrame(
    frequencies: number[],
    magnitudes: number[],
    maxNotes: number
  ): DetectedNote[] {
    const minFreq = 80;
    const maxFreq = 2000;
    const minMagnitude = 0.05;
    
    const startIdx = frequencies.findIndex(f => f >= minFreq);
    const endIdx = frequencies.findIndex(f => f >= maxFreq);
    
    if (startIdx === -1 || endIdx === -1) return [];

    const peaks = this.findPeaks(magnitudes, startIdx, endIdx, minMagnitude);
    
    const candidateNotes: DetectedNote[] = [];
    
    for (const peak of peaks) {
      const frequency = frequencies[peak.index];
      const magnitude = peak.magnitude;
      
      const harmonicStrength = this.calculateHarmonicStrength(
        frequency, frequencies, magnitudes
      );
      
      const confidence = this.calculateMultiNoteConfidence(
        frequency, magnitude, harmonicStrength, frequencies, magnitudes
      );
      
      if (confidence > 0.1) {
        candidateNotes.push({
          frequency,
          confidence,
          magnitude: magnitude * harmonicStrength
        });
      }
    }

    candidateNotes.sort((a, b) => b.magnitude - a.magnitude);
    
    const filteredNotes = this.filterOverlappingNotes(candidateNotes);
    
    return filteredNotes.slice(0, maxNotes);
  }

  private findPeaks(
    magnitudes: number[],
    startIdx: number,
    endIdx: number,
    minMagnitude: number
  ): Array<{ index: number; magnitude: number }> {
    const peaks: Array<{ index: number; magnitude: number }> = [];
    
    for (let i = startIdx + 1; i < endIdx - 1; i++) {
      const current = magnitudes[i];
      const prev = magnitudes[i - 1];
      const next = magnitudes[i + 1];
      
      if (current > prev && current > next && current > minMagnitude) {
        const leftNeighbor = magnitudes[i - 2] || 0;
        const rightNeighbor = magnitudes[i + 2] || 0;
        
        if (current > leftNeighbor && current > rightNeighbor) {
          peaks.push({ index: i, magnitude: current });
        }
      }
    }
    
    return peaks;
  }

  private calculateMultiNoteConfidence(
    _frequency: number,
    magnitude: number,
    harmonicStrength: number,
    _frequencies: number[],
    magnitudes: number[]
  ): number {
    const energyRatio = magnitude / (magnitudes.reduce((sum, mag) => sum + mag, 0) + 1e-10);
    const energyConfidence = Math.min(energyRatio * 10, 0.4);
    
    const harmonicConfidence = Math.min((harmonicStrength - 1) / 3, 0.3);
    
    const sortedMagnitudes = [...magnitudes].sort((a, b) => b - a);
    const noiseLevel = sortedMagnitudes.slice(Math.floor(sortedMagnitudes.length * 0.9))
      .reduce((sum, mag) => sum + mag, 0) / (sortedMagnitudes.length * 0.1);
    const snr = magnitude / (noiseLevel + 1e-10);
    const snrConfidence = Math.min(Math.log10(snr + 1) / 3, 0.3);
    
    return Math.max(0, Math.min(1, energyConfidence + harmonicConfidence + snrConfidence));
  }

  private filterOverlappingNotes(notes: DetectedNote[]): DetectedNote[] {
    if (notes.length <= 1) return notes;
    
    const filtered: DetectedNote[] = [];
    const used = new Set<number>();
    
    for (let i = 0; i < notes.length; i++) {
      if (used.has(i)) continue;
      
      const currentNote = notes[i];
      let bestNote = currentNote;
      let bestIndex = i;
      
      for (let j = i + 1; j < notes.length; j++) {
        if (used.has(j)) continue;
        
        const otherNote = notes[j];
        const frequencyRatio = Math.max(currentNote.frequency, otherNote.frequency) / 
                              Math.min(currentNote.frequency, otherNote.frequency);
        
        if (frequencyRatio < 1.1) {
          if (otherNote.magnitude > bestNote.magnitude) {
            bestNote = otherNote;
            bestIndex = j;
          }
          used.add(j);
        }
      }
      
      filtered.push(bestNote);
      used.add(bestIndex);
    }
    
    return filtered;
  }
}