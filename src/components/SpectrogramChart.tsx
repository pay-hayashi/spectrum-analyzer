import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { SpectrogramData } from '../utils/audioAnalysis';

interface SpectrogramChartProps {
  data: SpectrogramData;
  width?: number;
  height?: number;
}

export const SpectrogramChart: React.FC<SpectrogramChartProps> = ({
  data,
  width = 800,
  height = 400
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

    const maxFrequency = Math.min(2000, Math.max(...data.frequencies));
    const maxTime = Math.max(...data.times);

    const xScale = d3.scaleLinear()
      .domain([0, maxTime])
      .range([0, innerWidth]);

    const minFrequency = 80; // 最小周波数を80Hzに設定
    const yScale = d3.scaleLog()
      .domain([minFrequency, maxFrequency])
      .range([innerHeight, 0]);

    // 大量のデータでスタックオーバーフローを防ぐため、サンプリングして最大値を取得
    let maxMagnitude = 0;
    for (const frame of data.magnitudes) {
      for (const magnitude of frame) {
        if (magnitude > maxMagnitude) {
          maxMagnitude = magnitude;
        }
      }
    }
    
    // より鮮やかで見やすいカスタムカラースケールを使用
    const colorScale = d3.scaleLinear()
      .domain([0, maxMagnitude * 0.3, maxMagnitude * 0.7, maxMagnitude])
      .range(["#000033", "#0066cc", "#ffaa00", "#ff3300"]) // 濃い青→青→オレンジ→赤
      .interpolate(d3.interpolateRgb);

    const timeStep = innerWidth / data.times.length;
    const frequencyStep = innerHeight / data.frequencies.length;

    data.times.forEach((time, timeIndex) => {
      const magnitudeFrame = data.magnitudes[timeIndex];
      
      magnitudeFrame.forEach((magnitude, freqIndex) => {
        const currentFreq = data.frequencies[freqIndex];
        const nextFreq = data.frequencies[freqIndex + 1];
        
        // 最小周波数以下または最大周波数以上は除外
        if (currentFreq < minFrequency || currentFreq > maxFrequency) return;
        
        const x = xScale(time);
        const y1 = yScale(currentFreq);
        const y2 = nextFreq && nextFreq >= minFrequency ? yScale(nextFreq) : y1;
        const rectHeight = Math.abs(y2 - y1) || 1;
        
        g.append("rect")
          .attr("x", x)
          .attr("y", Math.min(y1, y2))
          .attr("width", timeStep)
          .attr("height", rectHeight)
          .attr("fill", colorScale(magnitude))
          .attr("opacity", 0.9);  // 不透明度を上げてより鮮明に
      });
    });

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

    const colorLegend = svg.append("g")
      .attr("transform", `translate(${width - 50}, ${margin.top})`);

    const legendHeight = innerHeight;
    const legendWidth = 20;

    const legendScale = d3.scaleLinear()
      .domain(colorScale.domain())
      .range([legendHeight, 0]);

    const legendData = d3.range(0, 1.01, 0.01);
    
    colorLegend.selectAll("rect")
      .data(legendData)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", d => legendScale(d * maxMagnitude))
      .attr("width", legendWidth)
      .attr("height", legendHeight / legendData.length)
      .attr("fill", d => colorScale(d * maxMagnitude));

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5)
      .tickFormat(d3.format(".2f"));

    colorLegend.append("g")
      .attr("transform", `translate(${legendWidth}, 0)`)
      .call(legendAxis);

  }, [data, width, height]);

  return (
    <div className="spectrogram-chart">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ border: '1px solid #ddd', borderRadius: '4px' }}
      />
    </div>
  );
};