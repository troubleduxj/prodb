import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/contexts/ThemeContext';
import { Database, Zap, AlertTriangle, Trash2, AlertCircle, Info, Filter } from 'lucide-react';

// --- Types ---
interface StreamNode {
  id: string;
  type: 'TABLE' | 'STREAM';
  name: string;
  db?: string;
  layer: number; // 0: Raw, 1: Process 1, 2: Agg 1, 3: Process 2, 4: Agg 2
  status?: 'RUNNING' | 'PAUSED' | 'FAILED';
}

interface StreamEdge {
  from: string;
  to: string;
}

interface ConnectionPath {
    id: string;
    d: string;
    status: 'default' | 'highlight' | 'impact' | 'upstream';
}

// --- Mock Data ---
const INITIAL_NODES: StreamNode[] = [
  // Chain 1: Power Meters
  { id: 'n1', type: 'TABLE', name: 'meters (Raw)', db: 'power_db', layer: 0 },
  { id: 'n2', type: 'STREAM', name: 'stream_1m_avg', status: 'RUNNING', layer: 1 },
  { id: 'n3', type: 'TABLE', name: 'meters_1m', db: 'power_db', layer: 2 },
  { id: 'n4', type: 'STREAM', name: 'stream_1h_avg', status: 'RUNNING', layer: 3 },
  { id: 'n5', type: 'TABLE', name: 'meters_1h', db: 'power_db', layer: 4 },
  { id: 'n6', type: 'STREAM', name: 'stream_alert_vol', status: 'RUNNING', layer: 1 },
  { id: 'n7', type: 'TABLE', name: 'alerts', db: 'sys_db', layer: 2 },
  { id: 'n8', type: 'STREAM', name: 'stream_daily_rpt', status: 'PAUSED', layer: 3 },
  { id: 'n9', type: 'TABLE', name: 'daily_reports', db: 'power_db', layer: 4 },

  // Chain 2: Fleet Vehicles (Isolated Chain)
  { id: 'n10', type: 'TABLE', name: 'vehicles (Raw)', db: 'fleet_db', layer: 0 },
  { id: 'n11', type: 'STREAM', name: 'stream_speed_chk', status: 'RUNNING', layer: 1 },
  { id: 'n12', type: 'TABLE', name: 'speed_violations', db: 'fleet_db', layer: 2 },
];

const INITIAL_EDGES: StreamEdge[] = [
  // Chain 1
  { from: 'n1', to: 'n2' },
  { from: 'n2', to: 'n3' },
  { from: 'n3', to: 'n4' }, // meters_1m -> stream_1h
  { from: 'n4', to: 'n5' },
  { from: 'n1', to: 'n6' }, // meters (Raw) -> alert stream
  { from: 'n6', to: 'n7' },
  { from: 'n3', to: 'n8' }, // meters_1m -> daily report stream
  { from: 'n8', to: 'n9' },

  // Chain 2
  { from: 'n10', to: 'n11' },
  { from: 'n11', to: 'n12' },
];

export const ComputingTopology: React.FC = () => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  
  const [nodes, setNodes] = useState<StreamNode[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<StreamEdge[]>(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<StreamNode | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  
  // Refs for drawing lines
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [paths, setPaths] = useState<ConnectionPath[]>([]);

  // Helper: Find all downstream dependencies recursively
  const findDownstream = useCallback((nodeId: string, currentEdges: StreamEdge[]): string[] => {
    const direct = currentEdges.filter(e => e.from === nodeId).map(e => e.to);
    let all = [...direct];
    direct.forEach(childId => {
      all = [...all, ...findDownstream(childId, currentEdges)];
    });
    return [...new Set(all)];
  }, []);

  // Helper: Find upstream dependencies
  const findUpstream = useCallback((nodeId: string, currentEdges: StreamEdge[]): string[] => {
      const direct = currentEdges.filter(e => e.to === nodeId).map(e => e.from);
      let all = [...direct];
      direct.forEach(parentId => {
          all = [...all, ...findUpstream(parentId, currentEdges)];
      });
      return [...new Set(all)];
  }, []);

  // 1. Calculate Visible Nodes based on Source Filter
  const visibleNodes = useMemo(() => {
      if (sourceFilter === 'ALL') return nodes;
      
      // Get downstream nodes from the selected source
      const downstreamIds = findDownstream(sourceFilter, edges);
      const visibleIds = new Set([sourceFilter, ...downstreamIds]);
      
      return nodes.filter(n => visibleIds.has(n.id));
  }, [sourceFilter, nodes, edges, findDownstream]);

  // 2. Group visible nodes by layer for rendering columns
  const layers = useMemo(() => {
    const grouped: Record<number, StreamNode[]> = {};
    visibleNodes.forEach(n => {
      if (!grouped[n.layer]) grouped[n.layer] = [];
      grouped[n.layer].push(n);
    });
    return grouped;
  }, [visibleNodes]);

  // Get list of all L0 (Source) nodes for the dropdown
  const sourceOptions = useMemo(() => {
      return nodes.filter(n => n.layer === 0);
  }, [nodes]);

  const handleDeleteRequest = (node: StreamNode) => {
    setDeleteCandidate(node);
  };

  const confirmDelete = () => {
    if (deleteCandidate) {
        setNodes(prev => prev.filter(n => n.id !== deleteCandidate.id));
        setEdges(prev => prev.filter(e => e.from !== deleteCandidate.id && e.to !== deleteCandidate.id));
        setDeleteCandidate(null);
        setSelectedNode(null);
    }
  };

  // Calculate dependencies for the delete modal
  const downstreamImpact = useMemo(() => {
      if (!deleteCandidate) return [];
      const ids = findDownstream(deleteCandidate.id, edges);
      return nodes.filter(n => ids.includes(n.id));
  }, [deleteCandidate, nodes, edges, findDownstream]);

  // --- Draw Lines Logic ---
  const drawConnections = useCallback(() => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newPaths: ConnectionPath[] = [];
      const visibleNodeIds = new Set(visibleNodes.map(n => n.id));

      edges.forEach(edge => {
          // Only draw if both nodes are visible
          if (!visibleNodeIds.has(edge.from) || !visibleNodeIds.has(edge.to)) return;

          const fromEl = nodeRefs.current.get(edge.from);
          const toEl = nodeRefs.current.get(edge.to);

          if (fromEl && toEl) {
              const fromRect = fromEl.getBoundingClientRect();
              const toRect = toEl.getBoundingClientRect();

              // Calculate relative coordinates
              // Start: Right middle of 'from' node
              const x1 = fromRect.right - containerRect.left;
              const y1 = fromRect.top + fromRect.height / 2 - containerRect.top;
              
              // End: Left middle of 'to' node
              // Subtract a few pixels to prevent arrow overlapping the border too much
              const x2 = toRect.left - containerRect.left - 4; 
              const y2 = toRect.top + toRect.height / 2 - containerRect.top;

              // Control points for Bezier curve (horizontal s-curve)
              // We enforce a horizontal start and end by placing control points parallel to X axis
              const dist = Math.abs(x2 - x1);
              const cpx1 = x1 + dist * 0.5;
              const cpx2 = x2 - dist * 0.5;

              const d = `M ${x1} ${y1} C ${cpx1} ${y1}, ${cpx2} ${y2}, ${x2} ${y2}`;

              // Determine status
              let status: ConnectionPath['status'] = 'default';

              if (deleteCandidate) {
                  const impactIds = findDownstream(deleteCandidate.id, edges);
                  // Highlight edge if it connects two impacted nodes or starts from deletion candidate to an impacted node
                  if ((edge.from === deleteCandidate.id && impactIds.includes(edge.to)) || 
                      (impactIds.includes(edge.from) && impactIds.includes(edge.to))) {
                      status = 'impact';
                  }
              } else if (selectedNode) {
                  const downstreamIds = findDownstream(selectedNode, edges);
                  const upstreamIds = findUpstream(selectedNode, edges);
                  
                  if (edge.from === selectedNode && downstreamIds.includes(edge.to)) {
                      status = 'highlight'; // Direct downstream
                  } else if (downstreamIds.includes(edge.from) && downstreamIds.includes(edge.to)) {
                      status = 'highlight'; // Further downstream
                  } else if (edge.to === selectedNode && upstreamIds.includes(edge.from)) {
                      status = 'upstream'; // Direct upstream
                  } else if (upstreamIds.includes(edge.to) && upstreamIds.includes(edge.from)) {
                      status = 'upstream'; // Further upstream
                  }
              }

              newPaths.push({ id: `${edge.from}-${edge.to}`, d, status });
          }
      });

      setPaths(newPaths);
  }, [edges, visibleNodes, selectedNode, deleteCandidate, findDownstream, findUpstream]);

  // Recalculate paths on resize, scroll or data change
  useEffect(() => {
      const handleRepaint = () => requestAnimationFrame(drawConnections);
      
      // Use setTimeout to ensure DOM has rendered initial layout
      const timeout = setTimeout(drawConnections, 100);
      window.addEventListener('resize', handleRepaint);
      
      const scrollEl = scrollContainerRef.current;
      if (scrollEl) {
          scrollEl.addEventListener('scroll', handleRepaint);
      }
      
      return () => {
          clearTimeout(timeout);
          window.removeEventListener('resize', handleRepaint);
          if (scrollEl) {
              scrollEl.removeEventListener('scroll', handleRepaint);
          }
      };
  }, [drawConnections, visibleNodes]);

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col">
       <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className={`text-2xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('computing.topology.streamLineageTopology', 'Stream Lineage Topology')}</h1>
            <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{t('computing.topology.visualizeProcessingChains', 'Visualize processing chains and analyze impact of changes.')}</p>
          </div>
          
          <div className="flex items-center gap-6">
               {/* Source Selector */}
               <div className={`flex items-center p-1 rounded-lg ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 border'}`}>
                   <div className={`px-3 flex items-center gap-2 text-sm ${isDark ? 'text-gray-400 border-r border-gray-700' : 'text-gray-600 border-r border-gray-200'}`}>
                       <Filter className="w-4 h-4" />
                       {t('common.source', 'Source')}
                   </div>
                   <select 
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                        className={`text-sm py-1 px-3 outline-none cursor-pointer ${isDark ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-900'}`}
                   >
                       <option value="ALL">{t('common.allSources', 'All Sources')}</option>
                       {sourceOptions.map(src => (
                           <option key={src.id} value={src.id}>{src.name}</option>
                       ))}
                   </select>
               </div>

               {/* Legend */}
               <div className="flex items-center gap-4 text-sm">
                   <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-full bg-blue-500"></span> {t('computing.topology.raw', 'Raw')}
                   </div>
                   <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-full bg-purple-500"></span> {t('computing.topology.stream', 'Stream')}
                   </div>
                   <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-full bg-green-500"></span> {t('computing.topology.agg', 'Agg')}
                   </div>
               </div>
          </div>
       </div>

       {/* Canvas Area */}
       <div 
            className={`flex-1 rounded-xl relative overflow-hidden bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:20px_20px] flex flex-col ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200 border'}`}
            ref={containerRef}
        >
           {/* SVG Layer for Connections */}
           <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                <defs>
                    <marker id="arrowhead-default" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                        <path d="M2,2 L10,6 L2,10 L4,6 Z" fill={isDark ? "#4b5563" : "#9ca3af"} />
                    </marker>
                    <marker id="arrowhead-highlight" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                        <path d="M2,2 L10,6 L2,10 L4,6 Z" fill="#60a5fa" />
                    </marker>
                    <marker id="arrowhead-upstream" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                        <path d="M2,2 L10,6 L2,10 L4,6 Z" fill="#a78bfa" />
                    </marker>
                    <marker id="arrowhead-impact" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
                        <path d="M2,2 L10,6 L2,10 L4,6 Z" fill="#ef4444" />
                    </marker>
                </defs>
                {paths.map(path => {
                    let strokeColor = isDark ? '#4b5563' : '#9ca3af'; // gray-600 or gray-400
                    let strokeWidth = 2;
                    let markerEnd = 'url(#arrowhead-default)';
                    let opacity = 0.6;

                    if (path.status === 'highlight') {
                        strokeColor = '#60a5fa'; // blue-400
                        strokeWidth = 3;
                        markerEnd = 'url(#arrowhead-highlight)';
                        opacity = 1;
                    } else if (path.status === 'upstream') {
                        strokeColor = '#a78bfa'; // purple-400
                        strokeWidth = 3;
                        markerEnd = 'url(#arrowhead-upstream)';
                        opacity = 0.8;
                    } else if (path.status === 'impact') {
                        strokeColor = '#ef4444'; // red-500
                        strokeWidth = 3;
                        markerEnd = 'url(#arrowhead-impact)';
                        opacity = 1;
                    } else if (selectedNode || deleteCandidate) {
                        // Dim others if something is selected
                        opacity = 0.1; 
                    }

                    return (
                        <path 
                            key={path.id} 
                            d={path.d} 
                            stroke={strokeColor} 
                            strokeWidth={strokeWidth} 
                            fill="none"
                            strokeLinecap="round"
                            markerEnd={markerEnd}
                            style={{ opacity, transition: 'all 0.3s ease' }}
                        />
                    );
                })}
           </svg>

           {visibleNodes.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center z-10">
                   <Filter className={`w-12 h-12 mb-4 opacity-20 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                   <p className={isDark ? 'text-gray-500' : 'text-gray-600'}>{t('computing.topology.noLineageFound', 'No lineage found for the selected source.')}</p>
               </div>
           ) : (
               <div 
                  className="flex-1 overflow-auto p-8 flex gap-16 items-center justify-center min-w-max z-10"
                  ref={scrollContainerRef}
               >
                   {/* Render Columns */}
                   {[0, 1, 2, 3, 4].map(layerIndex => (
                       <div key={layerIndex} className="flex flex-col gap-8 relative">
                           {/* Layer Label */}
                           {layers[layerIndex]?.length > 0 && (
                               <div className={`absolute -top-12 left-1/2 -translate-x-1/2 text-xs font-bold uppercase tracking-wider whitespace-nowrap px-2 py-1 rounded shadow-sm border ${isDark ? 'bg-gray-900/80 text-gray-500 border-gray-700/50' : 'bg-white/80 text-gray-600 border-gray-200'}`}>
                                   {layerIndex === 0 ? t('computing.topology.sourceL0', 'Source (L0)') : layerIndex % 2 !== 0 ? t('computing.topology.processL', 'Process (L{{layer}})', { layer: layerIndex }) : t('computing.topology.storageL', 'Storage (L{{layer}})', { layer: layerIndex })}
                               </div>
                           )}

                           {layers[layerIndex]?.map(node => {
                               const isSelected = selectedNode === node.id;
                               const isDownstream = selectedNode && findDownstream(selectedNode, edges).includes(node.id);
                               const isUpstream = selectedNode && findUpstream(selectedNode, edges).includes(node.id);
                               const isImpact = deleteCandidate && (deleteCandidate.id === node.id || findDownstream(deleteCandidate.id, edges).includes(node.id));
                               
                               let containerClass = isDark ? 'border-gray-600 bg-gray-800 opacity-90' : 'border-gray-300 bg-white opacity-90';
                               if (isSelected) containerClass = isDark ? 'border-white bg-gray-700 ring-2 ring-blue-500 opacity-100 scale-105 shadow-xl shadow-blue-500/20' : 'border-blue-500 bg-white ring-2 ring-blue-500 opacity-100 scale-105 shadow-xl shadow-blue-500/20';
                               else if (isImpact) containerClass = 'border-red-500 bg-red-900/20 ring-1 ring-red-500 opacity-100 shadow-xl shadow-red-500/10';
                               else if (isDownstream) containerClass = 'border-blue-500/50 bg-blue-900/10 opacity-100 shadow-lg shadow-blue-500/5';
                               else if (isUpstream) containerClass = 'border-purple-500/50 bg-purple-900/10 opacity-100 shadow-lg shadow-purple-500/5';
                               else if (selectedNode || deleteCandidate) containerClass = isDark ? 'border-gray-700 bg-gray-800 opacity-30 blur-[1px]' : 'border-gray-200 bg-white opacity-30 blur-[1px]'; // Dim unrelated
                               
                               return (
                                   <div 
                                       key={node.id}
                                       ref={el => {
                                           if (el) nodeRefs.current.set(node.id, el);
                                           else nodeRefs.current.delete(node.id);
                                       }}
                                       onClick={() => setSelectedNode(node.id)}
                                       className={`
                                           w-48 p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer relative group flex flex-col items-center text-center z-20
                                           ${containerClass}
                                       `}
                                   >
                                       {/* Connector Points (Visual) */}
                                       {layerIndex > 0 && (
                                            <div className={`absolute top-1/2 -left-[6px] w-2.5 h-2.5 rounded-full border-2 z-30 transform -translate-y-1/2 ${isDark ? 'bg-gray-500 border-gray-900' : 'bg-gray-400 border-white'}`}></div>
                                       )}
                                       {layerIndex < 4 && (
                                            <div className={`absolute top-1/2 -right-[6px] w-2.5 h-2.5 rounded-full border-2 z-30 transform -translate-y-1/2 ${isDark ? 'bg-gray-500 border-gray-900' : 'bg-gray-400 border-white'}`}></div>
                                       )}

                                       {/* Node Icon */}
                                       <div className={`p-3 rounded-full mb-2 transition-colors duration-300 ${
                                           node.type === 'TABLE' && node.layer === 0 ? 'bg-blue-500/20 text-blue-400' :
                                           node.type === 'TABLE' ? 'bg-green-500/20 text-green-400' : 
                                           'bg-purple-500/20 text-purple-400'
                                       }`}>
                                           {node.type === 'TABLE' ? <Database className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                                       </div>
                                       
                                       <h4 className={`font-bold text-sm truncate w-full ${isDark ? 'text-gray-200' : 'text-gray-900'}`} title={node.name}>{node.name}</h4>
                                       
                                       {node.db && <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>{node.db}</p>}
                                       {node.status && (
                                           <span className={`mt-2 text-[10px] px-2 py-0.5 rounded font-bold ${
                                               node.status === 'RUNNING' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-500'
                                           }`}>
                                               {node.status}
                                           </span>
                                       )}

                                       {/* Hover Actions */}
                                       <div className="absolute -top-3 -right-3 hidden group-hover:flex z-30 scale-0 group-hover:scale-100 transition-transform">
                                           <button 
                                               onClick={(e) => { e.stopPropagation(); handleDeleteRequest(node); }}
                                               className={`p-1.5 rounded-full shadow-md border transition-colors ${isDark ? 'bg-gray-700 hover:bg-red-600 text-gray-400 hover:text-white border-gray-600' : 'bg-white hover:bg-red-600 text-gray-500 hover:text-white border-gray-300'}`}
                                               title={t('common.delete', 'Delete Node')}
                                           >
                                               <Trash2 className="w-3 h-3" />
                                           </button>
                                       </div>
                                   </div>
                               );
                           })}
                       </div>
                   ))}
               </div>
           )}

           {/* Legend / Help Box */}
           <div className={`absolute bottom-4 left-4 p-4 rounded-xl text-xs max-w-xs z-20 shadow-lg ${isDark ? 'bg-gray-800/90 backdrop-blur border-gray-700 text-gray-400' : 'bg-white/90 backdrop-blur border-gray-200 border text-gray-600'}`}>
               <div className="flex items-start gap-2">
                   <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                   <p>{t('computing.topology.clickNodeToTrace', 'Click a node to trace lineage. Blue lines indicate downstream flow, Purple lines indicate upstream sources.')}</p>
               </div>
           </div>
       </div>

       {/* Delete Warning Modal */}
       {deleteCandidate && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
               <div className={`rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 ${isDark ? 'bg-gray-800 border-red-500/30' : 'bg-white border-red-300 border'}`}>
                   <div className={`p-6 border-b flex items-start gap-4 ${isDark ? 'border-gray-700 bg-red-900/10' : 'border-red-200 bg-red-50'}`}>
                       <div className="p-3 bg-red-500/20 rounded-full text-red-500 shrink-0">
                           <AlertTriangle className="w-8 h-8" />
                       </div>
                       <div>
                           <h2 className={`text-xl font-bold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{t('computing.topology.dependencyWarning', 'Dependency Warning')}</h2>
                           <p className={`text-sm mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                               {t('computing.topology.aboutToDelete', 'You are about to delete')} <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{deleteCandidate.name}</span>.
                           </p>
                       </div>
                   </div>
                   
                   <div className="p-6">
                       {downstreamImpact.length > 0 ? (
                           <>
                               <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                   {t('computing.topology.actionWillBreak', 'This action will')} <span className="text-red-400 font-bold">{t('computing.topology.break', 'BREAK')}</span> {t('computing.topology.followingDownstreamComponents', 'the following downstream components')}:
                               </p>
                               <div className={`rounded-lg border overflow-hidden max-h-48 overflow-y-auto ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                   {downstreamImpact.map(node => (
                                       <div key={node.id} className={`p-3 border-b last:border-0 flex items-center gap-3 ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                                           {node.type === 'STREAM' ? <Zap className="w-4 h-4 text-purple-400"/> : <Database className="w-4 h-4 text-green-400"/>}
                                           <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-900'}`}>{node.name}</span>
                                       </div>
                                   ))}
                               </div>
                           </>
                       ) : (
                           <p className="text-sm text-green-400 flex items-center">
                               <AlertCircle className="w-4 h-4 mr-2" />
                               {t('computing.topology.safeToDelete', 'Safe to delete. No downstream dependencies found.')}
                           </p>
                       )}
                   </div>

                   <div className={`p-4 flex justify-end gap-3 border-t ${isDark ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                       <button 
                           onClick={() => setDeleteCandidate(null)} 
                           className={`px-4 py-2 text-sm ${isDark ? 'text-gray-300 hover:text-white' : 'text-gray-700 hover:text-gray-900'}`}
                       >
                           {t('common.cancel', 'Cancel')}
                       </button>
                       <button 
                           onClick={confirmDelete}
                           className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-red-900/20"
                       >
                           {t('computing.topology.yesDeleteNode', 'Yes, Delete Node')}
                       </button>
                   </div>
               </div>
           </div>
       )}
    </div>
  );
};
