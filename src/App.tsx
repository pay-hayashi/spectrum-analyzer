import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useAudioProcessor } from './hooks/useAudioProcessor';
import { AudioAnalyzer } from './utils/audioAnalysis';
import type { SpectrogramData, FundamentalFrequencyData, MultipleNotesData } from './utils/audioAnalysis';
import { SpectrogramChart } from './components/SpectrogramChart';
import { FundamentalFrequencyChart } from './components/FundamentalFrequencyChart';
import { MultipleNotesChart } from './components/MultipleNotesChart';
import type { Note } from './utils/musicTheory';
import './App.css';

type AnalysisMode = 'single' | 'multiple';

function App() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [spectrogramData, setSpectrogramData] = useState<SpectrogramData | null>(null);
  const [fundamentalData, setFundamentalData] = useState<FundamentalFrequencyData | null>(null);
  const [multipleNotesData, setMultipleNotesData] = useState<MultipleNotesData | null>(null);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('single');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [hoveredNote, setHoveredNote] = useState<Note | null>(null);
  const [hoveredNotes, setHoveredNotes] = useState<Note[]>([]);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [hoveredConfidence, setHoveredConfidence] = useState<number | null>(null);
  const [hoveredConfidences, setHoveredConfidences] = useState<number[]>([]);
  const [chartWidth, setChartWidth] = useState(800);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { audioData, isLoading, error, processAudioFile, clearAudioData } = useAudioProcessor();

  // ウィンドウリサイズ時にチャートの幅を更新
  useEffect(() => {
    const updateChartWidth = () => {
      // chart-containerの幅を直接使用
      if (chartContainerRef.current) {
        const availableWidth = chartContainerRef.current.clientWidth;
        const newWidth = Math.max(400, availableWidth - 20); // マージンを少し残す
        setChartWidth(newWidth);
      } else if (containerRef.current) {
        // フォールバック：app全体の幅から推測
        const containerWidth = containerRef.current.clientWidth;
        const estimatedWidth = containerWidth - 112; // 推定パディング
        const newWidth = Math.max(400, estimatedWidth);
        setChartWidth(newWidth);
      }
    };

    // 少し遅延させてレンダリング後に実行
    const timer = setTimeout(updateChartWidth, 200);
    window.addEventListener('resize', updateChartWidth);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateChartWidth);
    };
  }, [spectrogramData]); // spectrogramDataが設定された時も再計算

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      console.log('ドロップされたファイル:', {
        name: file.name,
        type: file.type,
        size: file.size
      });
      
      // ファイル名の拡張子とMIMEタイプの両方をチェック
      const isSupportedAudio = file.name.toLowerCase().endsWith('.m4a') || 
                               file.name.toLowerCase().endsWith('.mp3') ||
                               file.type === 'audio/mp4' || 
                               file.type === 'audio/x-m4a' || 
                               file.type === 'audio/aac' ||
                               file.type === 'audio/mpeg' ||
                               file.type === 'audio/mp3' ||
                               file.type === '';  // 一部のシステムでMIMEタイプが空の場合がある
      
      if (isSupportedAudio) {
        setAudioFile(file);
        clearAudioData();
        setSpectrogramData(null);
        setFundamentalData(null);
        setMultipleNotesData(null);
        processAudioFile(file);
      } else {
        alert(`サポートされていないファイル形式です。\nファイル名: ${file.name}\nMIMEタイプ: ${file.type || '不明'}\nm4aまたはmp3ファイルを選択してください。`);
      }
    }
  }, [processAudioFile, clearAudioData]);

  useEffect(() => {
    if (audioData && !spectrogramData && !fundamentalData && !multipleNotesData && !isAnalyzing) {
      setIsAnalyzing(true);
      
      setTimeout(() => {
        try {
          console.log('スペクトル解析開始');
          const analyzer = new AudioAnalyzer(2048, 512);
          
          console.log('スペクトログラム計算中...');
          const spectrogram = analyzer.analyzeSpectrum(audioData.audioBuffer);
          console.log('スペクトログラム完了:', {
            timeFrames: spectrogram.times.length,
            frequencyBins: spectrogram.frequencies.length
          });
          
          if (analysisMode === 'single') {
            console.log('基本周波数抽出中...');
            const fundamental = analyzer.extractFundamentalFrequency(spectrogram);
            console.log('基本周波数抽出完了:', {
              dataPoints: fundamental.frequencies.length
            });
            setFundamentalData(fundamental);
          } else {
            console.log('複数音程検出中...');
            const multipleNotes = analyzer.extractMultipleNotes(spectrogram, 5);
            console.log('複数音程検出完了:', {
              dataPoints: multipleNotes.noteFrames.length
            });
            setMultipleNotesData(multipleNotes);
          }
          
          setSpectrogramData(spectrogram);
          console.log('解析完了');
        } catch (err) {
          console.error('解析エラー:', err);
          if (err instanceof Error) {
            alert(`スペクトル解析でエラーが発生しました: ${err.message}`);
          } else {
            alert('スペクトル解析でエラーが発生しました');
          }
        } finally {
          setIsAnalyzing(false);
        }
      }, 100);
    }
  }, [audioData, spectrogramData, fundamentalData, multipleNotesData, isAnalyzing, analysisMode]);

  const handleNoteHover = useCallback((note: Note | null, time: number | null, confidence?: number) => {
    // 同じ値の場合は更新をスキップ
    if (note?.frequency === hoveredNote?.frequency && time === hoveredTime) {
      return;
    }
    setHoveredNote(note);
    setHoveredTime(time);
    setHoveredConfidence(confidence ?? null);
  }, [hoveredNote?.frequency, hoveredTime]);

  const handleMultipleNotesHover = useCallback((notes: Note[], time: number | null, confidences?: number[]) => {
    setHoveredNotes(notes);
    setHoveredTime(time);
    setHoveredConfidences(confidences ?? []);
  }, []);

  const handleModeChange = useCallback((mode: AnalysisMode) => {
    if (mode !== analysisMode) {
      setAnalysisMode(mode);
      // モード変更時は解析結果をクリア
      setFundamentalData(null);
      setMultipleNotesData(null);
      setHoveredNote(null);
      setHoveredNotes([]);
      setHoveredTime(null);
      setHoveredConfidence(null);
      setHoveredConfidences([]);
    }
  }, [analysisMode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/mp4': ['.m4a'],
      'audio/x-m4a': ['.m4a'], 
      'audio/aac': ['.m4a'],
      'audio/mpeg': ['.mp3'],
      'audio/mp3': ['.mp3']
    },
    multiple: false
  });

  return (
    <div className="app" ref={containerRef}>
      <h1>スペクトル解析器</h1>
      
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>音声ファイルをドロップしてください...</p>
        ) : (
          <p>m4aまたはmp3ファイルをドラッグ&ドロップするか、クリックして選択してください</p>
        )}
      </div>

      <div className="analysis-mode-selector">
        <h3>解析モード</h3>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              name="analysisMode"
              value="single"
              checked={analysisMode === 'single'}
              onChange={() => handleModeChange('single')}
            />
            単音解析（基本周波数）
          </label>
          <label>
            <input
              type="radio"
              name="analysisMode"
              value="multiple"
              checked={analysisMode === 'multiple'}
              onChange={() => handleModeChange('multiple')}
            />
            複数音程解析（アルペジオ対応）
          </label>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {audioFile && (
        <div className="file-info">
          <h3>選択されたファイル:</h3>
          <p>ファイル名: {audioFile.name}</p>
          <p>サイズ: {(audioFile.size / 1024 / 1024).toFixed(2)} MB</p>
          {audioData && (
            <>
              <p>長さ: {audioData.duration.toFixed(2)} 秒</p>
              <p>サンプリングレート: {audioData.sampleRate} Hz</p>
              <p>チャンネル数: {audioData.channels}</p>
            </>
          )}
        </div>
      )}

      {(isLoading || isAnalyzing) && (
        <div className="loading">
          <p>{isLoading ? 'ファイルを読み込み中...' : 'スペクトル解析中...'}</p>
        </div>
      )}

      {spectrogramData && ((analysisMode === 'single' && fundamentalData) || (analysisMode === 'multiple' && multipleNotesData)) && (
        <div className="analysis-container">
          <div className="spectrum-display">
            <h3>スペクトログラム + {analysisMode === 'single' ? '基本周波数推移' : '複数音程解析'}</h3>
            <div className="chart-container" ref={chartContainerRef}>
              <SpectrogramChart 
                data={spectrogramData} 
                width={chartWidth} 
                height={400} 
              />
              <div className="overlay-chart">
                {analysisMode === 'single' && fundamentalData && (
                  <FundamentalFrequencyChart
                    data={fundamentalData}
                    width={chartWidth}
                    height={400}
                    onHover={handleNoteHover}
                    hideAxes={true}
                  />
                )}
                {analysisMode === 'multiple' && multipleNotesData && (
                  <MultipleNotesChart
                    data={multipleNotesData}
                    width={chartWidth}
                    height={400}
                    onHover={handleMultipleNotesHover}
                    hideAxes={true}
                  />
                )}
              </div>
            </div>
            <div className="current-note-info">
              {analysisMode === 'single' ? (
                <>
                  <p><strong>現在の音階:</strong> {hoveredNote ? `${hoveredNote.name}${hoveredNote.octave}` : '-'}</p>
                  <p><strong>時間:</strong> {hoveredTime !== null ? `${hoveredTime.toFixed(2)}秒` : '-'}</p>
                  <p><strong>周波数:</strong> {hoveredNote ? `${hoveredNote.frequency.toFixed(2)}Hz` : '-'}</p>
                  {hoveredNote && Math.abs(hoveredNote.cents) > 5 && (
                    <p><strong>音程のずれ:</strong> {hoveredNote.cents > 0 ? '+' : ''}{hoveredNote.cents}セント</p>
                  )}
                  {(!hoveredNote || Math.abs(hoveredNote?.cents || 0) <= 5) && (
                    <p><strong>音程のずれ:</strong> -</p>
                  )}
                  <p><strong>信頼度:</strong> {hoveredConfidence !== null ? `${(hoveredConfidence * 100).toFixed(1)}%` : '-'}</p>
                </>
              ) : (
                <>
                  <p><strong>検出された音階:</strong> {hoveredNotes.length > 0 ? hoveredNotes.map(note => `${note.name}${note.octave}`).join(', ') : '-'}</p>
                  <p><strong>時間:</strong> {hoveredTime !== null ? `${hoveredTime.toFixed(2)}秒` : '-'}</p>
                  <p><strong>周波数:</strong> {hoveredNotes.length > 0 ? hoveredNotes.map(note => `${note.frequency.toFixed(2)}Hz`).join(', ') : '-'}</p>
                  <p><strong>音程数:</strong> {hoveredNotes.length > 0 ? `${hoveredNotes.length}個` : '-'}</p>
                  <p><strong>平均信頼度:</strong> {hoveredConfidences.length > 0 ? `${(hoveredConfidences.reduce((sum, conf) => sum + conf, 0) / hoveredConfidences.length * 100).toFixed(1)}%` : '-'}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;