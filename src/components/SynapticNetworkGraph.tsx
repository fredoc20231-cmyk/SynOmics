import React, { useState, useRef, useEffect } from 'react';
import { SynapticProtein } from '../types';
import { Network, ZoomIn, ZoomOut, RotateCcw, Sparkles, Filter, Search, Info } from 'lucide-react';

interface SynapticNetworkGraphProps {
  proteins: SynapticProtein[];
  onSelectProtein: (protein: SynapticProtein) => void;
  onLaunchCoScientistForComplex: (complex: string) => void;
}

interface Node {
  id: string;
  geneSymbol: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  compartment: string;
  protein: SynapticProtein;
}

interface Link {
  source: string;
  target: string;
  interactionType: string;
}

export const SynapticNetworkGraph: React.FC<SynapticNetworkGraphProps> = ({
  proteins,
  onSelectProtein,
  onLaunchCoScientistForComplex
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedSubcomplex, setSelectedSubcomplex] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);

  // Derive nodes and links
  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<Link[]>([]);

  // Initialize node positions
  useEffect(() => {
    const width = 800;
    const height = 500;
    const initialNodes: Node[] = proteins.map((p, idx) => {
      // Cluster by compartment
      let cx = width / 2;
      let cy = height / 2;
      let color = '#818cf8';

      if (p.compartment === 'nucleus' || (p as any).subcellularLocation?.toLowerCase().includes('nucleus')) {
        cx = width * 0.25; cy = height * 0.25; color = '#f59e0b';
      } else if (p.compartment === 'plasma_membrane' || (p as any).subcellularLocation?.toLowerCase().includes('membrane')) {
        cx = width * 0.2; cy = height * 0.65; color = '#06b6d4';
      } else if (p.compartment === 'cytoplasm' || (p as any).subcellularLocation?.toLowerCase().includes('cytoplasm')) {
        cx = width * 0.5; cy = height * 0.45; color = '#8b5cf6';
      } else if (p.compartment === 'mitochondria' || (p as any).subcellularLocation?.toLowerCase().includes('mitochondria')) {
        cx = width * 0.75; cy = height * 0.6; color = '#6366f1';
      } else if (p.compartment === 'secreted' || (p as any).subcellularLocation?.toLowerCase().includes('extracellular')) {
        cx = width * 0.8; cy = height * 0.2; color = '#10b981';
      }

      // Add angular offset
      const angle = (idx / proteins.length) * 2 * Math.PI;
      const radius = Math.min(Math.max(Math.sqrt(p.estimatedCopyNumberPerSynapse || 300) * 0.7, 14), 30);

      return {
        id: p.geneSymbol,
        geneSymbol: p.geneSymbol,
        x: cx + Math.cos(angle) * 70 + (((idx * 53) % 40) - 20),
        y: cy + Math.sin(angle) * 70 + (((idx * 89) % 40) - 20),
        vx: 0,
        vy: 0,
        radius,
        color,
        compartment: p.compartment,
        protein: p
      };
    });

    const initialLinks: Link[] = [];
    proteins.forEach(p => {
      p.keyInteractors.forEach(partner => {
        if (proteins.some(o => o.geneSymbol === partner)) {
          // Avoid duplicate bidirectional links
          if (!initialLinks.some(l => (l.source === partner && l.target === p.geneSymbol) || (l.source === p.geneSymbol && l.target === partner))) {
            initialLinks.push({
              source: p.geneSymbol,
              target: partner,
              interactionType: 'Direct Binding'
            });
          }
        }
      });
    });

    nodesRef.current = initialNodes;
    linksRef.current = initialLinks;
  }, [proteins]);

  // Simulation step & canvas rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(panOffset.x, panOffset.y);
      ctx.scale(zoomLevel, zoomLevel);

      const nodes = nodesRef.current;
      const links = linksRef.current;

      // Draw links
      ctx.lineWidth = 1.5;
      links.forEach(l => {
        const src = nodes.find(n => n.id === l.source);
        const tgt = nodes.find(n => n.id === l.target);
        if (src && tgt) {
          const isHighlighted = (hoveredNode && (hoveredNode.id === src.id || hoveredNode.id === tgt.id));
          ctx.strokeStyle = isHighlighted ? 'rgba(165, 180, 252, 0.8)' : 'rgba(75, 85, 99, 0.3)';
          ctx.beginPath();
          ctx.moveTo(src.x, src.y);
          ctx.lineTo(tgt.x, tgt.y);
          ctx.stroke();
        }
      });

      // Draw nodes
      nodes.forEach(n => {
        const matchesSubcomplex = selectedSubcomplex === 'all' || n.protein.complex.toLowerCase().includes(selectedSubcomplex.toLowerCase());
        const matchesSearch = !searchFilter || n.geneSymbol.toLowerCase().includes(searchFilter.toLowerCase());
        const isHovered = hoveredNode?.id === n.id;

        const alpha = (matchesSubcomplex && matchesSearch) ? 1 : 0.2;

        ctx.globalAlpha = alpha;

        // Outer glow on hover
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 6, 0, 2 * Math.PI);
          ctx.fillStyle = `${n.color}40`;
          ctx.fill();
        }

        // Main node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
        ctx.fillStyle = n.color;
        ctx.fill();
        ctx.strokeStyle = isHovered ? '#ffffff' : '#0f172a';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Gene label
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(n.radius * 0.55, 9)}px 'JetBrains Mono', monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.geneSymbol, n.x, n.y);

        ctx.globalAlpha = 1;
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [zoomLevel, panOffset, selectedSubcomplex, searchFilter, hoveredNode]);

  // Handle canvas mouse move (hover detection)
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - panOffset.x) / zoomLevel;
    const mouseY = (e.clientY - rect.top - panOffset.y) / zoomLevel;

    if (isDragging) {
      setPanOffset({
        x: panOffset.x + (e.clientX - dragStart.x),
        y: panOffset.y + (e.clientY - dragStart.y)
      });
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }

    const hovered = nodesRef.current.find(n => {
      const dist = Math.hypot(n.x - mouseX, n.y - mouseY);
      return dist <= n.radius;
    });

    setHoveredNode(hovered || null);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredNode) {
      onSelectProtein(hoveredNode.protein);
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Network className="w-5 h-5 text-purple-400" /> Multi-Omics Interactome &amp; Protein-Protein Complex Graph
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Physical PPI topologies, multi-protein complexes, and subcellular signaling networks.
          </p>
        </div>

        {/* Filters & Canvas Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Filter node..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none"
            />
          </div>

          <select
            value={selectedSubcomplex}
            onChange={(e) => setSelectedSubcomplex(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none"
          >
            <option value="all">All Complexes</option>
            <option value="p53">p53 / Cell Cycle Complexes</option>
            <option value="KRAS">KRAS / MAPK Cascade</option>
            <option value="m6A">m6A Methyltransferase Complex</option>
            <option value="Immune">Immune Checkpoint / TCR</option>
          </select>

          {/* Zoom controls */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 2.5))}
              className="p-1 rounded text-slate-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.5))}
              className="p-1 rounded text-slate-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }}
              className="p-1 rounded text-slate-400 hover:text-white"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="relative rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl">
        <canvas
          ref={canvasRef}
          width={900}
          height={520}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          className="w-full h-[520px] cursor-grab active:cursor-grabbing block"
        />

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-sm text-xs font-mono space-y-1.5 pointer-events-none">
          <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">Subcellular Localization</span>
          <div className="flex items-center gap-2 text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Nucleus / Chromatin
          </div>
          <div className="flex items-center gap-2 text-cyan-300">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" /> Plasma Membrane
          </div>
          <div className="flex items-center gap-2 text-violet-300">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400" /> Cytoplasm / Cytosol
          </div>
          <div className="flex items-center gap-2 text-indigo-300">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /> Mitochondria / Organelles
          </div>
          <div className="flex items-center gap-2 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Extracellular / Secreted
          </div>
        </div>

        {/* Tooltip on Hover */}
        {hoveredNode && (
          <div className="absolute top-4 right-4 p-4 rounded-xl bg-slate-900/95 border border-indigo-500/50 backdrop-blur-md text-xs space-y-2 shadow-2xl max-w-xs pointer-events-none animate-in fade-in duration-100">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-sm text-white">{hoveredNode.geneSymbol}</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                {hoveredNode.protein.compartment.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-slate-300">{hoveredNode.protein.name}</p>
            <p className="text-[11px] font-mono text-slate-400">
              Copies/Spine: ~{hoveredNode.protein.estimatedCopyNumberPerSynapse} • MW: {hoveredNode.protein.molecularWeightKDa} kDa
            </p>
            <div className="text-[10px] font-mono text-indigo-400 pt-1 border-t border-slate-800">
              Click node to inspect full multi-omics profile
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
