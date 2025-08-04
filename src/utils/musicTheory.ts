export interface Note {
  name: string;
  octave: number;
  frequency: number;
  cents: number;
}

export class MusicTheoryUtils {
  private static readonly NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  private static readonly A4_FREQUENCY = 440;
  private static readonly A4_MIDI_NUMBER = 69;

  public static frequencyToNote(frequency: number): Note {
    if (frequency <= 0) {
      return {
        name: '-',
        octave: 0,
        frequency: 0,
        cents: 0
      };
    }

    const midiNumber = this.frequencyToMidiNumber(frequency);
    const roundedMidiNumber = Math.round(midiNumber);
    
    const noteIndex = (roundedMidiNumber - 12) % 12;
    const octave = Math.floor((roundedMidiNumber - 12) / 12);
    
    const exactFrequency = this.midiNumberToFrequency(roundedMidiNumber);
    const cents = Math.round(1200 * Math.log2(frequency / exactFrequency));
    
    return {
      name: this.NOTE_NAMES[noteIndex],
      octave: octave,
      frequency: exactFrequency,
      cents: cents
    };
  }

  public static formatNote(note: Note): string {
    if (note.name === '-') return '-';
    
    let formatted = `${note.name}${note.octave}`;
    
    if (Math.abs(note.cents) > 5) {
      const centsStr = note.cents > 0 ? `+${note.cents}` : `${note.cents}`;
      formatted += ` (${centsStr}¢)`;
    }
    
    return formatted;
  }

  public static getNoteColor(noteName: string): string {
    const colors: { [key: string]: string } = {
      'C': '#ff4444',
      'C#': '#ff8844',
      'D': '#ffbb44',
      'D#': '#ffff44',
      'E': '#bbff44',
      'F': '#44ff44',
      'F#': '#44ffbb',
      'G': '#44bbff',
      'G#': '#4488ff',
      'A': '#4444ff',
      'A#': '#8844ff',
      'B': '#bb44ff'
    };
    
    return colors[noteName] || '#888888';
  }

  private static frequencyToMidiNumber(frequency: number): number {
    return this.A4_MIDI_NUMBER + 12 * Math.log2(frequency / this.A4_FREQUENCY);
  }

  private static midiNumberToFrequency(midiNumber: number): number {
    return this.A4_FREQUENCY * Math.pow(2, (midiNumber - this.A4_MIDI_NUMBER) / 12);
  }

  public static isValidMusicalFrequency(frequency: number): boolean {
    return frequency >= 16.35 && frequency <= 7902.13;
  }

  public static frequenciesToNotes(frequencies: number[]): Note[] {
    return frequencies.map(freq => this.frequencyToNote(freq));
  }

  public static formatNotes(notes: Note[]): string {
    return notes.map(note => this.formatNote(note)).join(', ');
  }

  public static getNotesColors(notes: Note[]): string[] {
    return notes.map(note => this.getNoteColor(note.name));
  }
}