// @ts-nocheck
"use client";
import React, { useRef, useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { forceCollide } from 'd3-force';

export default function ForceGraph({ nodes, edges, onNodeClick, width, height }) {
  const fgRef = useRef();

  const graphData = useMemo(() => {
    const dataNodes = [];
    const dataLinks = [];

    // Map of group name to group node ID
    const groups = new Map();
    const groupCounts = new Map();

    nodes.forEach(n => {
      const groupName = (n.tags && n.tags.length > 0) ? n.tags[0] : 'Uncategorized';
      groupCounts.set(groupName, (groupCounts.get(groupName) || 0) + 1);
    });

    const COLORS = ['#6366F1','#8B5CF6','#06B6D4','#10B981','#F59E0B','#EC4899', '#F43F5E', '#8B5CF6'];

    nodes.forEach((n, i) => {
      const groupName = (n.tags && n.tags.length > 0) ? n.tags[0] : 'Uncategorized';
      const color = COLORS[Array.from(groups.keys()).indexOf(groupName) % COLORS.length] || COLORS[0];
      
      let groupId;
      if (!groups.has(groupName)) {
        groupId = `group_${groupName}`;
        groups.set(groupName, groupId);
        
        // Add a Group Node (invisible center for the cluster)
        dataNodes.push({
          id: groupId,
          isGroup: true,
          name: groupName,
          val: Math.max(50, (groupCounts.get(groupName) || 1) * 22), // Dynamic radius
          color: color
        });
      } else {
        groupId = groups.get(groupName);
      }

      dataNodes.push({
        id: n.id,
        isGroup: false,
        name: n.title,
        groupId: groupId,
        val: 5 + Math.min(n.degree * 2, 12),
        color: color,
        summary: n.summary,
        tags: n.tags
      });

      // Strongly link note to its group center
      dataLinks.push({
        source: n.id,
        target: groupId,
        isGroupLink: true,
        similarity: 1
      });
    });

    // Add standard edges
    edges.forEach(e => {
      dataLinks.push({
        source: e.from_note_id,
        target: e.to_note_id,
        isGroupLink: false,
        similarity: e.similarity_score
      });
    });

    return { nodes: dataNodes, links: dataLinks };
  }, [nodes, edges]);

  useEffect(() => {
    const fg = fgRef.current;
    if (fg) {
      // Configure d3 forces for extreme isolation
      fg.d3Force('charge').strength(node => node.isGroup ? -4000 : -100); 
      fg.d3Force('link').distance(link => link.isGroupLink ? 10 : 200);
      fg.d3Force('collide', forceCollide(node => node.isGroup ? node.val + 30 : node.val + 5));
    }
  }, [graphData]);

  return (
    <ForceGraph2D
      ref={fgRef}
      width={width}
      height={height}
      graphData={graphData}
      nodeLabel={node => {
        if (node.isGroup) return `<div style="background: rgba(15,23,42,0.9); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); color: #fff; font-family: sans-serif; font-size: 13px;"><strong>Category:</strong> ${node.name}</div>`;
        const tagsHtml = (node.tags || []).map((t: string) => `<span style="color:#A5B4FC; margin-right: 4px;">#${t}</span>`).join('');
        return `
          <div style="background: rgba(15,23,42,0.95); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); max-width: 250px; font-family: sans-serif;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #f8fafc;">${node.name}</div>
            ${tagsHtml ? `<div style="font-size: 11px; margin-bottom: 8px;">${tagsHtml}</div>` : ''}
            ${node.summary ? `<div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">${node.summary}</div>` : ''}
          </div>
        `;
      }}
      nodeRelSize={1}
      linkWidth={link => link.isGroupLink ? 0 : Math.max(0.5, link.similarity * 2)}
      linkColor={link => link.isGroupLink ? 'transparent' : `rgba(156, 163, 175, ${link.similarity * 0.3})`}
      onNodeClick={node => {
        if (!node.isGroup && onNodeClick) {
          onNodeClick(node.id);
        }
      }}
      d3VelocityDecay={0.3}
      cooldownTicks={100}
      onEngineStop={() => fgRef.current?.zoomToFit(400, 50)}
      nodeCanvasObject={(node, ctx, globalScale) => {
        if (node.isGroup) {
          // Draw group container
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
          ctx.globalAlpha = 0.08;
          ctx.fillStyle = node.color;
          ctx.fill();
          ctx.globalAlpha = 0.3;
          ctx.lineWidth = 1;
          ctx.strokeStyle = node.color;
          ctx.stroke();
          ctx.globalAlpha = 1.0;

          // Draw Group Title (scales naturally with zoom)
          // node.val is the radius, we can make font proportional to radius but not massive
          const fontSize = Math.max(12, node.val * 0.25);
          ctx.font = `bold ${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = node.color;
          ctx.fillText(node.name.toUpperCase(), node.x, node.y - node.val - (fontSize * 0.5));
          return;
        }

        // Draw note node
        const label = node.name;
        
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Only draw text if zoomed in enough to prevent clutter, or if nodes are large
        if (globalScale > 0.8) {
          const fontSize = 10; // fixed size in graph coordinates
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.shadowColor = 'rgba(0,0,0,0.8)';
          ctx.shadowBlur = 4;
          ctx.fillText(label, node.x, node.y + node.val + (fontSize));
          ctx.shadowBlur = 0; // reset
        }
      }}
      nodeCanvasObjectMode={() => 'after'}
    />
  );
}
