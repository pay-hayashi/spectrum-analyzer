import React, { useRef, useEffect, useState } from 'react';
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
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    frequency: number;
    magnitude: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    frequency: 0,
    magnitude: 0
  });

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

    // 十字線の要素を追加（初期状態では非表示）
    const crosshair = g.append("g")
      .attr("class", "crosshair")
      .style("display", "none");

    // 縦線
    const verticalLine = crosshair.append("line")
      .attr("class", "vertical-line")
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", "#666666")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // 横線
    const horizontalLine = crosshair.append("line")
      .attr("class", "horizontal-line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("stroke", "#666666")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3");

    // インタラクション用の透明な矩形
    const overlay = g.append("rect")
      .attr("class", "overlay")
      .attr("width", innerWidth)
      .attr("height", innerHeight)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("mouseover", () => {
        crosshair.style("display", null);
      })
      .on("mouseout", () => {
        crosshair.style("display", "none");
        setTooltip(prev => ({ ...prev, visible: false }));
      })
      .on("mousemove", (event) => {
        const [mouseX, mouseY] = d3.pointer(event);
        
        // マウス位置から周波数と強度を逆算
        const frequency = xScale.invert(mouseX);
        const magnitude = yScale.invert(mouseY);
        
        // 最も近いデータポイントを見つける
        const bisector = d3.bisector((d: { frequency: number; magnitude: number }) => d.frequency).left;
        const index = bisector(filteredData, frequency);
        const d0 = filteredData[index - 1];
        const d1 = filteredData[index];
        
        let closestData;
        if (!d0) {
          closestData = d1;
        } else if (!d1) {
          closestData = d0;
        } else {
          closestData = frequency - d0.frequency > d1.frequency - frequency ? d1 : d0;
        }
        
        if (closestData) {
          const x = xScale(closestData.frequency);
          const y = yScale(closestData.magnitude);
          
          // 十字線の位置を更新
          verticalLine.attr("x1", x).attr("x2", x);
          horizontalLine.attr("y1", y).attr("y2", y);
          
          // ツールチップの位置と内容を更新
          const svgRect = svgRef.current!.getBoundingClientRect();
          setTooltip({
            visible: true,
            x: svgRect.left + margin.left + x + 10,
            y: svgRect.top + margin.top + y - 10,
            frequency: closestData.frequency,
            magnitude: closestData.magnitude
          });
        }
      });

  }, [data, width, height]);

  return (
    <div className="frequency-spectrum-chart" style={{ position: 'relative' }}>
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
      {/* ツールチップ */}
      {tooltip.visible && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '500',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap'
          }}
        >
          <div>周波数: {tooltip.frequency >= 1000 ? 
            `${(tooltip.frequency / 1000).toFixed(2)}kHz` : 
            `${tooltip.frequency.toFixed(0)}Hz`}
          </div>
          <div>強度: {tooltip.magnitude.toFixed(3)}</div>
        </div>
      )}
    </div>
  );
};

export default FrequencySpectrumChart;