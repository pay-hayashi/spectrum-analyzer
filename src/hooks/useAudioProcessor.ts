import { useState, useCallback } from 'react';

export interface AudioData {
  audioBuffer: AudioBuffer;
  sampleRate: number;
  duration: number;
  channels: number;
}

export const useAudioProcessor = () => {
  const [audioData, setAudioData] = useState<AudioData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processAudioFile = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('オーディオ処理開始:', file.name);
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('AudioContext作成完了');
      
      const arrayBuffer = await file.arrayBuffer();
      console.log('ArrayBuffer読み込み完了:', arrayBuffer.byteLength, 'bytes');
      
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      console.log('オーディオデコード完了:', {
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        channels: audioBuffer.numberOfChannels,
        length: audioBuffer.length
      });

      const processedData: AudioData = {
        audioBuffer,
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        channels: audioBuffer.numberOfChannels
      };

      setAudioData(processedData);
      
      await audioContext.close();
      console.log('オーディオ処理完了');
      
    } catch (err) {
      console.error('オーディオファイル処理エラー:', err);
      if (err instanceof Error) {
        if (err.name === 'EncodingError' || err.message.includes('decode')) {
          setError('オーディオファイルのデコードに失敗しました。ファイルが破損している可能性があります。');
        } else if (err.name === 'NotSupportedError') {
          setError('このオーディオ形式はサポートされていません。');
        } else {
          setError(`オーディオファイルの処理に失敗しました: ${err.message}`);
        }
      } else {
        setError('オーディオファイルの処理に失敗しました。ファイル形式を確認してください。');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearAudioData = useCallback(() => {
    setAudioData(null);
    setError(null);
  }, []);

  return {
    audioData,
    isLoading,
    error,
    processAudioFile,
    clearAudioData
  };
};