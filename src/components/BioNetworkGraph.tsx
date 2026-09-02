import React, { useState, useRef, useEffect } from 'react';
import { BiologicalEntity } from '../types';
import { Network, ZoomIn, ZoomOut, RotateCcw, Sparkles, Filter, Search, Info, Layers, Dna } from 'lucide-react';

export interface BioNetworkGraphProps {
  proteins: BiologicalEntity[];
  onSelectProtein: (protein: BiologicalEntity) => void;
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
  domain: string;
  protein: BiologicalEntity;
}

interface Link {
  source: string;
  target: string;
  interactionType: string;
}

export const BioNetworkGraph: React.FC<BioNetworkGraphProps> = ({
  proteins,
  onSelectProtein,
  onLaunchCoScientistForComplex
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);

  const nodesRef = useRef<Node[]>([]);
  const linksRef = useRef<Link[]>([]);

  useEffect(() => {
    const width = 800;
    const height = 500;
    const initialNodes: Node[] = proteins.map((p, idx) => {
      let cx = width / 2;
      let cy = height / 2;
      let color = '#10b981';

      const dom = (p.biologicalDomain || 'general').toLowerCase();
      if (dom.includes('oncol') || dom.includes('cancer')) {
        cx = width * 0.25; cy = height * 0.3; color = '#f43f5e';
      } else if (dom.includes('immun')) {
        cx = width * 0.75; cy = height * 0.3; color = '#6366f1';
      } else if (dom.includes('metabol') || dom.includes('diabet')) {
        cx = width * 0.25; cy = height * 0.7; color = '#06b6d4';
      } else if (dom.includes('cardio') || dom.includes('heart')) {
        cx = width * 0.75; cy = height * 0.7; color = '#ec4899';
      } else if (dom.includes('neuro') || dom.includes('synap')) {
        cx = width * 0.5; cy = height * 0.2; color = '#f59e0b';
      } else {
        cx = width * 0.5; cy = height * 0.5; color = '#10b981';
      }

      const angle = (idx / proteins.length) * 2 * Math.PI;
      const radius = 60 + Math.random() * 80;
      return {
        id: p.geneSymbol,
        geneSymbol: p.geneSymbol,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        radius: p.druggability?.isDruggable ? 18 : 14,
        color,
        compartment: p.compartment,
        domain: p.biologicalDomain || 'General Biology',
        protein: p
      };
    });

    const initialLinks: Link[] = [];
    proteins.forEach(p => {
      if (p.keyInteractors && Array.isArray(p.keyInteractors)) {
        p.keyInteractors.forEach(targetSym => {
          if (proteins.some(tp => tp.geneSymbol === targetSym)) {
            initialLinks.push({
              source: p.geneSymbol,
              target: targetSym,
              interactionType: 'Direct Protein-Protein Binding'
            });
          }
        });
      }
    });

    nodesRef.current = initialNodes;
    linksRef.current = initialLinks;
  }, [proteins]);

  // Simulation step & canvas rendering
  useEffect(() => {
    let animationFrameId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(canvas.width / 2 + panOffset.x, canvas.height / 2 + panOffset.y);
      ctx.scale(zoomLevel, zoomLevel);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);

      // Draw links
      ctx.lineWidth = 1.2;
      linksRef.current.forEach(link => {
        const sourceNode = nodesRef.current.find(n => n.id === link.source);
        const targetNode = nodesRef.current.find(n => n.id === link.target);
        if (sourceNode && targetNode) {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
          ctx.beginPath();
          ctx.moveTo(sourceNode.x, sourceNode.y);
          ctx.lineTo(targetNode.x, targetNode.y);
          ctx.stroke();
        }
      });

      // Draw nodes
      nodesRef.current.forEach(node => {
        if (selectedDomain !== 'all' && !node.domain.toLowerCase().includes(selectedDomain.toLowerCase())) {
          return;
        }

        const isMatch = !searchFilter || node.geneSymbol.toLowerCase().includes(searchFilter.toLowerCase());
        ctx.fillStyle = isMatch ? node.color : 'rgba(100, 116, 139, 0.3)';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, 2 * Math.PI);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.geneSymbol, node.x, node.y);
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [panOffset, zoomLevel, selectedDomain, searchFilter]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setPanOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left - canvas.width / 2 - panOffset.x) / zoomLevel + canvas.width / 2;
    const clickY = (e.clientY - rect.top - canvas.height / 2 - panOffset.y) / zoomLevel + canvas.height / 2;

    const clicked = nodesRef.current.find(n => {
      const dist = Math.hypot(n.x - clickX, n.y - clickY);
      return dist <= n.radius;
    });

    if (clicked) {
      onSelectProtein(clicked.protein);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Universal Multi-Omics Interactome Graph
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Interactive topological clustering across Oncology, Immunology, Metabolism, and Neuroscience networks.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
          >
            <option value="all">All Biological Domains</option>
            <option value="oncology">Oncology &amp; Somatic Drivers</option>
            <option value="immunology">Immunology &amp; Inflammation</option>
            <option value="metabolism">Metabolism &amp; Endocrinology</option>
            <option value="cardiovascular">Cardiovascular Channelopathies</option>
            <option value="neuroscience">Synaptic &amp; Neurobiology</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter node..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button onClick={() => setZoomLevel(z => Math.min(2.5, z + 0.2))} className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
              <ZoomIn className="w-4 h-4" />
            </button>
            <button onClick={() => setZoomLevel(z => Math.max(0.4, z - 0.2))} className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
              <ZoomOut className="w-4 h-4" />
            </button>
            <button onClick={() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }); }} className="p-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 h-[500px]">
        <canvas
          ref={canvasRef}
          width={900}
          height={500}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onClick={handleClick}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* Floating Domain Legend */}
        <div className="absolute bottom-3 left-3 p-3 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 text-[11px] text-slate-300 space-y-1.5 pointer-events-none">
          <div className="font-bold text-white mb-1">Domain Clustering</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Oncology &amp; Somatic Hotspots</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Immunology &amp; Cytokines</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span> Metabolic &amp; Endocrine Loci</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Synaptic &amp; Neuro Scaffolds</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Core Structural / Epigenetic</div>
        </div>
      </div>
    </div>
  );
};

export const SynapticNetworkGraph = BioNetworkGraph;
