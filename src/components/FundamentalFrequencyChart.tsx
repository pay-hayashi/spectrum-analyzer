import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import type { FundamentalFrequencyData } from '../utils/audioAnalysis';
import { MusicTheoryUtils } from '../utils/musicTheory';
import type { Note } from '../utils/musicTheory';

interface FundamentalFrequencyChartProps {
  data: FundamentalFrequencyData;
  width?: number;
  height?: number;
  onHover?: (note: Note | null, time: number | null) => void;
  hideAxes?: boolean; // 軸とラベルを非表示にするオプション
}

export const FundamentalFrequencyChart: React.FC<FundamentalFrequencyChartProps> = ({
  data,
  width = 800,
  height = 300,
  onHover,
  hideAxes = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredNote, setHoveredNote] = useState<Note | null>(null);
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);

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

    const validFrequencies = data.frequencies.filter(f => f > 0 && MusicTheoryUtils.isValidMusicalFrequency(f));
    if (validFrequencies.length === 0) return;

    const maxTime = Math.max(...data.times);
    const minFreq = 80;
    const maxFreq = 2000;

    const xScale = d3.scaleLinear()
      .domain([0, maxTime])
      .range([0, innerWidth]);

    const yScale = d3.scaleLog()
      .domain([minFreq, maxFreq])
      .range([innerHeight, 0]);

    const line = d3.line<{ time: number; frequency: number }>()
      .x(d => xScale(d.time))
      .y(d => yScale(d.frequency))
      .defined(d => d.frequency > 0 && MusicTheoryUtils.isValidMusicalFrequency(d.frequency))
      .curve(d3.curveMonotoneX);

    const lineData = data.times.map((time, index) => ({
      time,
      frequency: data.frequencies[index]
    }));

    g.append("path")
      .datum(lineData)
      .attr("fill", "none")
      .attr("stroke", "#ff6b35")  // 明るいオレンジ色
      .attr("stroke-width", 1)    // さらに細く、スペクトログラムの詳細を最大限に活かす
      .attr("d", line);

    const circles = g.selectAll("circle")
      .data(lineData.filter(d => d.frequency > 0 && MusicTheoryUtils.isValidMusicalFrequency(d.frequency)))
      .enter()
      .append("circle")
      .attr("cx", d => xScale(d.time))
      .attr("cy", d => yScale(d.frequency))
      .attr("r", 3)  // 少し小さくしてスペクトログラムを見やすく
      .attr("fill", "#ff6b35")  // 明るいオレンジ色
      .style("cursor", "pointer");

    let currentTooltip: any = null;

    circles
      .on("mouseover", (event, d) => {
        // 既存のツールチップを削除
        g.selectAll(".tooltip").remove();
        
        const note = MusicTheoryUtils.frequencyToNote(d.frequency);
        
        // Reactの状態更新は控えめに
        if (!hoveredNote || hoveredNote.frequency !== note.frequency || hoveredTime !== d.time) {
          setHoveredNote(note);
          setHoveredTime(d.time);
          onHover?.(note, d.time);
        }

        d3.select(event.currentTarget)
          .attr("r", 5)  // ホバー時も少し小さめに
          .attr("fill", MusicTheoryUtils.getNoteColor(note.name));

        currentTooltip = g.append("g")
          .attr("class", "tooltip")
          .attr("transform", `translate(${xScale(d.time)}, ${yScale(d.frequency)})`);

        currentTooltip.append("rect")
          .attr("x", -40)
          .attr("y", -35)
          .attr("width", 80)
          .attr("height", 25)
          .attr("fill", "black")
          .attr("opacity", 0.8)
          .attr("rx", 4);

        currentTooltip.append("text")
          .attr("text-anchor", "middle")
          .attr("y", -15)
          .attr("fill", "white")
          .attr("font-size", "12px")
          .text(MusicTheoryUtils.formatNote(note));
      })
      .on("mouseout", (event) => {
        // 状態のクリアは少し遅延させる
        setTimeout(() => {
          setHoveredNote(null);
          setHoveredTime(null);
          onHover?.(null, null);
        }, 50);

        d3.select(event.currentTarget)
          .attr("r", 3)  // 通常時のサイズに戻す
          .attr("fill", "#ff6b35");

        if (currentTooltip) {
          currentTooltip.remove();
          currentTooltip = null;
        }
        g.selectAll(".tooltip").remove();
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
        .text("基本周波数 (Hz)");
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
    <div className="fundamental-frequency-chart">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ border: '1px solid #ddd', borderRadius: '4px' }}
      />
    </div>
  );
};