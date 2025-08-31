import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { FrequencySpectrumData } from '../utils/audioAnalysis';

interface FrequencySpectrumChartProps {
  data: FrequencySpectrumData | null;
  width?: number;
  height?: number;
}

const FrequencySpectrumChart: React.FC<FrequencySpectrumChartProps> = ({
  data,
  width = 800,
  height = 400
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 20, right: 40, bottom: 60, left: 80 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // 周波数範囲を80Hz-8000Hzに制限
    const minFrequency = 80;
    const maxFrequency = 8000;
    const maxMagnitude = Math.max(...data.magnitudes);

    // 表示用にデータをフィルタリング
    const filteredData = data.frequencies.map((freq, i) => ({
      frequency: freq,
      magnitude: data.magnitudes[i]
    })).filter(d => d.frequency >= minFrequency && d.frequency <= maxFrequency);

    const xScale = d3.scaleLog()
      .domain([minFrequency, maxFrequency])
      .range([0, innerWidth]);

    const yScale = d3.scaleLinear()
      .domain([0, maxMagnitude])
      .range([innerHeight, 0]);

    // ライン生成器
    const line = d3.line<{ frequency: number; magnitude: number }>()
      .x(d => xScale(d.frequency))
      .y(d => yScale(d.magnitude))
      .curve(d3.curveMonotoneX);

    // エリア生成器（グラフの下部を塗りつぶし）
    const area = d3.area<{ frequency: number; magnitude: number }>()
      .x(d => xScale(d.frequency))
      .y0(innerHeight)
      .y1(d => yScale(d.magnitude))
      .curve(d3.curveMonotoneX);

    // グラデーション定義
    const gradient = svg.append("defs")
      .append("linearGradient")
      .attr("id", "spectrum-gradient")
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", 0).attr("y1", innerHeight + margin.top)
      .attr("x2", 0).attr("y2", margin.top);

    gradient.append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#4c83ff")
      .attr("stop-opacity", 0.1);

    gradient.append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#4c83ff")
      .attr("stop-opacity", 0.8);

    // エリアグラフを描画
    g.append("path")
      .datum(filteredData)
      .attr("fill", "url(#spectrum-gradient)")
      .attr("d", area);

    // ラインを描画
    g.append("path")
      .datum(filteredData)
      .attr("fill", "none")
      .attr("stroke", "#2563eb")
      .attr("stroke-width", 2)
      .attr("d", line);

    // X軸（対数スケール）
    const xAxis = d3.axisBottom(xScale)
      .ticks(10, "")
      .tickFormat(d => {
        const freq = Number(d);
        if (freq >= 1000) {
          return `${(freq / 1000).toFixed(1)}k`;
        }
        return freq.toString();
      })
      .tickSizeInner(-innerHeight)
      .tickSizeOuter(0);
    
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xAxis)
      .selectAll(".tick line")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-dasharray", "2,2");

    // Y軸
    const yAxis = d3.axisLeft(yScale)
      .ticks(8)
      .tickFormat(d3.format(".2f"))
      .tickSizeInner(-innerWidth)
      .tickSizeOuter(0);
    
    g.append("g")
      .call(yAxis)
      .selectAll(".tick line")
      .attr("stroke", "#e5e7eb")
      .attr("stroke-dasharray", "2,2");

    // 軸ラベル
    g.append("text")
      .attr("transform", `translate(${innerWidth / 2}, ${innerHeight + 40})`)
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .text("周波数 (Hz)");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -50)
      .attr("x", -innerHeight / 2)
      .style("text-anchor", "middle")
      .style("font-size", "12px")
      .style("font-weight", "500")
      .text("強度");

    // グリッドスタイル調整
    g.selectAll(".domain").remove();
    g.selectAll(".tick text")
      .style("font-size", "11px")
      .style("fill", "#6b7280");

  }, [data, width, height]);

  return (
    <div className="frequency-spectrum-chart">
      <h3 style={{ 
        margin: '0 0 16px 0', 
        fontSize: '16px', 
        fontWeight: '600',
        color: '#374151'
      }}>
        周波数スペクトラム
      </h3>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ 
          border: '1px solid #e5e7eb', 
          borderRadius: '6px',
          backgroundColor: '#ffffff'
        }}
      />
    </div>
  );
};

export default FrequencySpectrumChart;