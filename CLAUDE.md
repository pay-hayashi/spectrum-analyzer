# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

音楽ファイル（m4a形式）のスペクトル解析を行うReact + TypeScriptアプリケーション。Web Audio APIとFFTを使用してリアルタイムでスペクトログラムと基本周波数を表示し、音楽理論に基づく音程解析を提供します。

## 開発コマンド

- `npm run dev` - 開発サーバーを起動（Vite）
- `npm run build` - プロダクションビルド（TypeScriptコンパイル + Vite）
- `npm run lint` - ESLintによるコード検査
- `npm run preview` - ビルド結果のプレビュー

## アーキテクチャ

### コアモジュール
- **`src/utils/audioAnalysis.ts`**: `AudioAnalyzer`クラス - FFTベースのスペクトル解析エンジン
- **`src/utils/musicTheory.ts`**: `MusicTheoryUtils`クラス - 周波数から音階・セント偏差を計算
- **`src/hooks/useAudioProcessor.ts`**: オーディオファイル処理とリアルタイム解析の統合フック

### コンポーネント設計
- **`SpectrogramChart.tsx`**: D3.jsによるスペクトログラム可視化（対数周波数スケール、カスタムカラーマップ）
- **`FundamentalFrequencyChart.tsx`**: 基本周波数の時系列表示と音楽理論的解析

### 技術仕様
- **サンプリング**: 512サンプルのハミング窓FFT
- **フレームレート**: 60fps相当の高速更新
- **周波数範囲**: 80Hz-8000Hz（音楽的に重要な帯域）
- **音程精度**: セント単位（1/100半音）の高精度測定

### データフロー
1. ファイルドロップ → Web Audio API → AudioBuffer
2. `useAudioProcessor` → リアルタイムフレーム抽出
3. `AudioAnalyzer` → FFTスペクトル計算
4. `MusicTheoryUtils` → 音楽理論解析
5. D3.js → インタラクティブ可視化

## 重要な実装パターン

### 音響処理
- FFTは常にハミング窓を適用してスペクトル漏れを防止
- 基本周波数検出にはスペクトル重心とピーク解析を組み合わせ
- オーディオバッファは32-bit floatで高精度処理

### パフォーマンス
- D3.jsの`scaleLog`で対数スケール変換を効率化
- React.memoとuseMemoで不要な再描画を防止
- Web Workerは使用せず、メインスレッドで60fps維持

### 型安全性
- すべてのオーディオデータにFloat32Array型を使用
- 音楽理論計算結果は厳密な型定義で管理
- コンポーネント間のデータ受け渡しはインターフェース経由

## UI用語・呼称

### 音階情報パネル
画面下部の青い背景エリアを「音階情報」と呼ぶ。以下4項目をリアルタイム表示：
- 現在の音階（例：E4）
- 時間（例：0.70秒）
- 周波数（例：329.63Hz）
- 音程のずれ（例：-8セント）

### テスト用データ
- `hadakanoyusha.m4a`：プロジェクトルートにある短時間テスト音源（1.49秒）

## 開発・テスト手順

### 実装後の動作確認
**重要**: すべての実装完了後は、必ずPlaywrightを使用してブラウザでの動作確認を行うこと。

1. `http://localhost:5173/`にアクセス
2. `hadakanoyusha.m4a`をアップロード
3. スペクトログラムと基本周波数が正常に表示されることを確認
4. ホバー操作で音階情報パネルが正しく更新されることを確認
5. 実装した機能が期待通りに動作することを視覚的に検証