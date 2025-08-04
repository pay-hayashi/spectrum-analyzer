import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { MultipleNotesData } from '../utils/audioAnalysis';
import { MusicTheoryUtils } from '../utils/musicTheory';
import type { Note } from '../utils/musicTheory';

interface MultipleNotesChartProps {
  data: MultipleNotesData;
  width?: number;
  height?: number;
  onHover?: (notes: Note[], time: number | null, confidences?: number[]) => void;
  hideAxes?: boolean;
}

export const MultipleNotesChart: React.FC<MultipleNotesChartProps> = ({
  data,
  width = 800,
  height = 300,
  onHover,
  hideAxes = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 60, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const maxTime = Math.max(...data.times);
    const minFreq = 80;
    const maxFreq = 2000;

    const xScale = d3.scaleLinear()
      .domain([0, maxTime])
      .range([0, innerWidth]);

    const yScale = d3.scaleLog()
      .domain([minFreq, maxFreq])
      .range([innerHeight, 0]);

    // 各時点の音程を描画
    data.noteFrames.forEach(frame => {
      frame.notes.forEach((note) => {
        if (note.frequency > 0 && MusicTheoryUtils.isValidMusicalFrequency(note.frequency)) {
          const musicNote = MusicTheoryUtils.frequencyToNote(note.frequency);
          
          const circle = g.append("circle")
            .attr("cx", xScale(frame.time))
            .attr("cy", yScale(note.frequency))
            .attr("r", Math.max(2, note.confidence * 8))  // 信頼度に応じてサイズ変更
            .attr("fill", MusicTheoryUtils.getNoteColor(musicNote.name))
            .attr("opacity", 0.7 + note.confidence * 0.3)  // 信頼度に応じて透明度変更
            .style("cursor", "pointer");

          circle
            .on("mouseover", () => {
              // 同じ時点のすべての音程を取得
              const frameNotes = frame.notes
                .filter(n => n.frequency > 0 && MusicTheoryUtils.isValidMusicalFrequency(n.frequency))
                .map(n => MusicTheoryUtils.frequencyToNote(n.frequency));
              
              const confidences = frame.notes
                .filter(n => n.frequency > 0 && MusicTheoryUtils.isValidMusicalFrequency(n.frequency))
                .map(n => n.confidence);

              onHover?.(frameNotes, frame.time, confidences);

              // ホバー時のスタイル変更
              circle
                .attr("r", Math.max(4, note.confidence * 10))
                .attr("stroke", "#000")
                .attr("stroke-width", 1);

              // ツールチップ表示
              g.append("g")
                .attr("class", "tooltip")
                .attr("transform", `translate(${xScale(frame.time)}, ${yScale(note.frequency)})`)
                .append("rect")
                .attr("x", -30)
                .attr("y", -25)
                .attr("width", 60)
                .attr("height", 20)
                .attr("fill", "black")
                .attr("opacity", 0.8)
                .attr("rx", 4);

              g.select(".tooltip")
                .append("text")
                .attr("text-anchor", "middle")
                .attr("y", -10)
                .attr("fill", "white")
                .attr("font-size", "10px")
                .text(MusicTheoryUtils.formatNote(musicNote));
            })
            .on("mouseout", () => {
              setTimeout(() => {
                onHover?.([], null, []);
              }, 50);

              circle
                .attr("r", Math.max(2, note.confidence * 8))
                .attr("stroke", null)
                .attr("stroke-width", 0);

              g.selectAll(".tooltip").remove();
            });
        }
      });
    });

    if (!hideAxes) {
      const xAxis = d3.axisBottom(xScale)
        .tickFormat(d => `${d}s`);
      
      g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(xAxis);

      const yAxis = d3.axisLeft(yScale)
        .ticks(10, "")
        .tickFormat(d => {
          const freq = Number(d);
          if (freq >= 1000) {
            return `${(freq / 1000).toFixed(1)}kHz`;
          }
          return `${freq}Hz`;
        });
      
      g.append("g")
        .call(yAxis);

      g.append("text")
        .attr("transform", `translate(${innerWidth / 2}, ${innerHeight + 40})`)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("時間 (秒)");

      g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -50)
        .attr("x", -innerHeight / 2)
        .style("text-anchor", "middle")
        .style("font-size", "12px")
        .text("周波数 (Hz)");
    }

    if (!hideAxes) {
      const noteLines = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const octaves = [2, 3, 4, 5, 6];
      
      octaves.forEach(octave => {
        noteLines.forEach(noteName => {
          const note = MusicTheoryUtils.frequencyToNote(440 * Math.pow(2, (12 * (octave - 4) + noteLines.indexOf(noteName) - 9) / 12));
          if (note.frequency >= minFreq && note.frequency <= maxFreq) {
            g.append("line")
              .attr("x1", 0)
              .attr("x2", innerWidth)
              .attr("y1", yScale(note.frequency))
              .attr("y2", yScale(note.frequency))
              .attr("stroke", MusicTheoryUtils.getNoteColor(noteName))
              .attr("stroke-width", 0.5)
              .attr("opacity", 0.3);

            g.append("text")
              .attr("x", innerWidth + 5)
              .attr("y", yScale(note.frequency) + 3)
              .attr("font-size", "10px")
              .attr("fill", MusicTheoryUtils.getNoteColor(noteName))
              .text(`${noteName}${octave}`);
          }
        });
      });
    }

  }, [data, width, height]);

  return (
    <div className="multiple-notes-chart">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ border: '1px solid #ddd', borderRadius: '4px' }}
      />
    </div>
  );
};