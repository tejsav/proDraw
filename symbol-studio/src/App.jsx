import React, { useState, useRef, useEffect } from 'react';
import { 
  Trash2, 
  RotateCcw, 
  MousePointer2,
  PenTool,
  Download,
  Copy,
  Loader2,
  CheckCircle2,
  Type,
  MessageSquare,
  Minus,
  Square,
  Circle,
  Eye,
  EyeOff,
  Grid3X3,
  Ban,
  Maximize,
  Sparkles,
  Settings,
  Lock,
  Unlock,
  X,
  ChevronDown,
  ChevronRight,
  Undo,
  Redo,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

// --- Constants & Config ---

const CANVAS_MM = 210; 
const CANVAS_PX = 800; 
const MM_TO_PX = CANVAS_PX / CANVAS_MM; 
const PX_TO_MM = CANVAS_MM / CANVAS_PX; 

const UNITS = {
  inch: { label: 'inch', factor: 1/25.4, precision: 2, suffix: '"' },
  mm: { label: 'mm', factor: 1, precision: 0, suffix: ' mm' },
  cm: { label: 'cm', factor: 0.1, precision: 1, suffix: ' cm' },
};

const TEXT_SUGGESTIONS = [
  "Hot & Cold Water Inlet",
  "Floor Drain",
  "15-AMP Electric Socket",
  "On/Off should be in master board.",
  "Wall Mixture/Wall Taps"
];

// --- INITIAL CONFIGURATION (The "God Mode" Defaults) ---
const INITIAL_CONFIG = {
  global: {
    snapThreshold: 20,
    backgroundVisible: true,
    showGrid: true, 
    canvasColor: "#f1f5f9", 
  },
  measurements: {
    arrowSize: 6,
    arrowAspectRatio: 0.66, // Width vs Height of arrow
    strokeWidth: 1.5,
    extensionLength: 5,
    extensionOffset: 2,     // Gap between object and extension line
    fontSize: 20, 
    fontColor: "#000000",
    textBgOpacity: 1.0,
    colorDefault: "#3b82f6",
    colorSelected: "#22c55e",
  },
  annotations: {
    fontSize: 14,
    color: "#7f1d1d", // Used for line and text
    textBgOpacity: 1.0,
    strokeWidth: 1.5,
    arrowSize: 6,
  },
  simpleShapes: {
    strokeColor: "#000000",
    colorSelected: "#22c55e",
    strokeWidth: 2,
    solidFillColor: "#000000",
    fillOpacity: 1.0, 
    hatchColor: "#000000",
    hatchSpacing: 4,
    hatchAngle: 45,
    hatchStrokeWidth: 0.5,
  },
  handles: {
    size: 10, // px diameter
    color: "#22c55e",
    borderColor: "#ffffff",
    hoverScale: 1.3,
  },
  symbols: {
    snapOffsetFactor: 0.25, 
    selectionPadding: 4,
    baseScale: 1.0,
    color: "#0f172a", 
  },
  // Visual Transforms for the 3D room effect
  zones: {
    left:  { p: 200, rx: -18, ry: 45, rz: -9, sx: -3, sy: 2 },
    right: { p: 200, rx: -18, ry: -45, rz: 9, sx: 3, sy: -2 },
    front: { p: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0 },
    floor: { p: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0 },
    text:  { p: 0, rx: 0, ry: 0, rz: 0, sx: 0, sy: 0 },
  }
};

// --- Helper Functions ---

const generateTransformString = (config) => {
  const p = config.p > 0 ? `perspective(${config.p}px)` : '';
  return `${p} rotateX(${config.rx}deg) rotateY(${config.ry}deg) rotateZ(${config.rz}deg) skewX(${config.sx}deg) skewY(${config.sy}deg)`;
};

// Zone detection logic
const getZone = (mmX, mmY) => {
  if (mmX < 45) {
    const boundaryY = -1.555 * mmX + 210;
    return mmY < boundaryY ? 'left' : 'floor';
  }
  if (mmX > 165) {
    const boundaryY = 1.555 * (mmX - 165) + 140;
    return mmY < boundaryY ? 'right' : 'floor';
  }
  if (mmY < 140) return 'front';
  return 'floor';
};

const distToSegment = (px, py, x1, y1, x2, y2) => {
  const l2 = (x1 - x2) ** 2 + (y1 - y2) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * (x2 - x1);
  const projY = y1 + t * (y2 - y1);
  return { dist: Math.hypot(px - projX, py - projY), x: projX, y: projY };
};

const intersectVert = (V, x1, y1, x2, y2) => {
  const min = Math.min(x1, x2) - 0.1;
  const max = Math.max(x1, x2) + 0.1;
  if (V >= min && V <= max) {
    if (x2 === x1) return null;
    const t = (V - x1) / (x2 - x1);
    const y = y1 + t * (y2 - y1);
    return { x: V, y };
  }
  return null;
};

// --- Custom SVG Components (Icons) ---
const SymbolOne = ({ className, color }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1.98 2.22" className={className} style={{ shapeRendering: 'geometricPrecision', color: color }}>
    <rect x="0.03" y="0.03" width="1.92" height="2.17" fill="white" stroke="currentColor" strokeWidth="0.05" />
    <circle cx="0.99" cy="0.53" r="0.14" fill="currentColor" stroke="currentColor" strokeWidth="0.05" />
    <circle cx="1.43" cy="1.71" r="0.12" fill="currentColor" stroke="currentColor" strokeWidth="0.05" />
    <circle cx="0.55" cy="1.71" r="0.12" fill="currentColor" stroke="currentColor" strokeWidth="0.05" />
    <circle cx="1.43" cy="1.17" r="0.12" fill="currentColor" />
    <circle cx="0.55" cy="1.17" r="0.12" fill="currentColor" />
  </svg>
);
const SymbolTwo = ({ className, color }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7.73 4.41" className={className} style={{ shapeRendering: 'geometricPrecision', color: color }}>
    <rect x="3.87" y="0.05" width="3.81" height="4.3" fill="white" stroke="currentColor" strokeWidth="0.11" />
    <rect x="0.05" y="0.05" width="3.81" height="4.3" fill="white" stroke="currentColor" strokeWidth="0.11" />
    <circle cx="5.77" cy="1.04" r="0.28" fill="currentColor" stroke="currentColor" strokeWidth="0.11" />
    <circle cx="1.96" cy="1.04" r="0.28" fill="currentColor" stroke="currentColor" strokeWidth="0.11" />
    <circle cx="6.65" cy="3.39" r="0.25" fill="currentColor" stroke="currentColor" strokeWidth="0.11" />
    <circle cx="2.84" cy="3.39" r="0.25" fill="currentColor" stroke="currentColor" strokeWidth="0.11" />
    <circle cx="4.89" cy="3.39" r="0.25" fill="currentColor" stroke="currentColor" strokeWidth="0.11" />
    <circle cx="1.08" cy="3.39" r="0.25" fill="currentColor" stroke="currentColor" strokeWidth="0.11" />
    <circle cx="6.65" cy="2.31" r="0.25" fill="currentColor" />
    <circle cx="2.84" cy="2.31" r="0.25" fill="currentColor" />
    <circle cx="4.89" cy="2.31" r="0.25" fill="currentColor" />
    <circle cx="1.08" cy="2.31" r="0.25" fill="currentColor" />
  </svg>
);
const SymbolThree = ({ className, color }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 17.27 6.59" className={className} style={{ shapeRendering: 'geometricPrecision', color: color }}>
    <rect x="11.49" y="0.08" width="5.7" height="6.43" fill="white" stroke="currentColor" strokeWidth="0.16" />
    <rect x="5.78" y="0.08" width="5.7" height="6.43" fill="white" stroke="currentColor" strokeWidth="0.16" />
    <rect x="0.08" y="0.08" width="5.7" height="6.43" fill="white" stroke="currentColor" strokeWidth="0.16" />
    <circle cx="14.34" cy="1.56" r="0.41" fill="currentColor" stroke="currentColor" strokeWidth="0.16" />
    <circle cx="8.64" cy="1.56" r="0.41" fill="currentColor" stroke="currentColor" strokeWidth="0.16" />
    <circle cx="2.93" cy="1.56" r="0.41" fill="currentColor" stroke="currentColor" strokeWidth="0.16" />
    <circle cx="15.66" cy="5.07" r="0.37" fill="currentColor" stroke="currentColor" strokeWidth="0.16" />
    <circle cx="9.95" cy="5.07" r="0.37" fill="currentColor" stroke="currentColor" strokeWidth="0.16" />
    <circle cx="4.25" cy="5.07" r="0.37" fill="currentColor" stroke="currentColor" strokeWidth="0.16" />
    <circle cx="13.02" cy="5.07" r="0.37" fill="currentColor" stroke="currentColor" strokeWidth="0.16" />
    <circle cx="7.32" cy="5.07" r="0.37" fill="currentColor" stroke="currentColor" strokeWidth="0.16" />
    <circle cx="1.62" cy="5.07" r="0.37" fill="currentColor" stroke="currentColor" strokeWidth="0.16" />
    <circle cx="15.66" cy="3.46" r="0.37" fill="currentColor" />
    <circle cx="9.95" cy="3.46" r="0.37" fill="currentColor" />
    <circle cx="4.25" cy="3.46" r="0.37" fill="currentColor" />
    <circle cx="13.02" cy="3.46" r="0.37" fill="currentColor" />
    <circle cx="7.32" cy="3.46" r="0.37" fill="currentColor" />
    <circle cx="1.62" cy="3.46" r="0.37" fill="currentColor" />
  </svg>
);
const SymbolFour = ({ className, color }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3.12 1.08" className={className} style={{ shapeRendering: 'geometricPrecision', color: color }}>
    <circle cx="2.58" cy="0.54" r="0.54" fill="currentColor" />
    <circle cx="0.54" cy="0.54" r="0.54" fill="currentColor" />
  </svg>
);
const SymbolFive = ({ className, color }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3.41 1.45" className={className} style={{ shapeRendering: 'geometricPrecision', color: color }}>
    <ellipse cx="1.7" cy="0.72" rx="1.67" ry="0.69" fill="none" stroke="currentColor" strokeWidth="0.07" />
    <ellipse cx="1.7" cy="0.72" rx="1.49" ry="0.56" fill="currentColor" stroke="currentColor" strokeWidth="0.07" />
  </svg>
);

const SYMBOL_TYPES = [
  { id: 'sym1', icon: SymbolOne, label: 'Socket', aspectRatio: 1.98 / 2.22, baseHeightMm: 8 },
  { id: 'sym2', icon: SymbolTwo, label: '2-Sockets', aspectRatio: 7.73 / 4.41, baseHeightMm: 8 },
  { id: 'sym3', icon: SymbolThree, label: '3-Sockets', aspectRatio: 17.27 / 6.59, baseHeightMm: 8 },
  { id: 'sym4', icon: SymbolFour, label: 'Water Inlet', aspectRatio: 3.12 / 1.08, baseHeightMm: 5 },
  { id: 'sym5', icon: SymbolFive, label: 'Drain', aspectRatio: 3.41 / 1.45, baseHeightMm: 5 },
  { id: 'text_label', icon: Type, label: 'Text', aspectRatio: 1, baseHeightMm: 15 } 
];


// --- Components ---

const Handle = ({ x, y, cursor, config, onMouseDown, isActive }) => {
  const [hovered, setHovered] = useState(false);
  const size = config.handles.size;
  const scale = hovered || isActive ? config.handles.hoverScale : 1;
  const style = {
    left: x,
    top: y,
    width: size,
    height: size,
    marginLeft: -size / 2,
    marginTop: -size / 2,
    backgroundColor: isActive ? "#f97316" : config.handles.color, // Orange if active, else default green
    borderColor: isActive ? "#7c2d12" : config.handles.borderColor,
    borderWidth: isActive ? 2 : 1,
    cursor: cursor,
    transform: `scale(${scale})`,
    transition: 'transform 0.1s, background-color 0.1s'
  };
  return (
    <div 
      style={style} 
      onMouseDown={onMouseDown} 
      onMouseEnter={() => setHovered(true)} 
      onMouseLeave={() => setHovered(false)} 
      className="absolute rounded-full z-20" 
    />
  );
};

const TextSuggestions = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="absolute -right-6 top-0 z-50" style={{ pointerEvents: 'auto' }}>
      <button
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }}
        className="p-1 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded shadow-sm border border-blue-200 transition-colors"
        title="Suggestions"
      >
        <Sparkles size={12} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-slate-200 shadow-lg rounded-md overflow-hidden flex flex-col max-h-40 overflow-y-auto">
          {TEXT_SUGGESTIONS.map(text => (
            <button
              key={text}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(text); setIsOpen(false); }}
              className="px-2 py-1 text-xs text-left text-slate-700 hover:bg-blue-50 hover:text-blue-700 border-b border-slate-50 last:border-0"
            >
              {text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const DraggableSidebarItem = ({ type }) => {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/react-symbol-id', type.id);
    e.dataTransfer.effectAllowed = 'copy';
  };
  return (
    <div draggable onDragStart={handleDragStart} className="flex flex-col items-center justify-center p-2 bg-white rounded-lg shadow-sm border border-slate-200 cursor-grab hover:bg-blue-50 hover:border-blue-300 transition-colors active:cursor-grabbing h-20">
      <div className="flex-1 flex items-center justify-center w-full">
        <type.icon className="max-h-8 w-full text-slate-800" />
      </div>
      <span className="text-[10px] font-medium text-slate-500 mt-1">{type.label}</span>
    </div>
  );
};

// CanvasItem receiving config for perspective
const CanvasItem = ({ item, isSelected, onMouseDown, onTextChange, config }) => {
  const symbolDef = SYMBOL_TYPES.find(t => t.id === item.type);
  const SymbolIcon = symbolDef?.icon || SymbolOne;

  const zoneParams = config.zones[item.zone] || config.zones.floor;
  const warpStyle = generateTransformString(zoneParams);
   
  // Apply symbol scaling
  const scaleStyle = `scale(${config.symbols.baseScale})`;

  const [isEditing, setIsEditing] = useState(false);

  const handleDoubleClick = (e) => {
    if (item.type === 'text_label') {
      e.stopPropagation();
      setIsEditing(true);
    }
  };

  return (
    <div
      onMouseDown={(e) => { if (!isEditing) onMouseDown(e, item.id); }}
      onDoubleClick={handleDoubleClick}
      className={`absolute cursor-move flex items-center justify-center group`}
      style={{
        left: item.x,
        top: item.y,
        width: item.width * config.symbols.baseScale,
        height: item.height * config.symbols.baseScale,
        transform: `translate(-50%, -50%) ${warpStyle} ${scaleStyle}`, 
        transformOrigin: 'center bottom',
        zIndex: isSelected ? 50 : 10
      }}
    >
      <div className={`absolute inset-[${-config.symbols.selectionPadding}px] border border-blue-400 rounded transition-opacity pointer-events-none ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`} />

      {item.type === 'text_label' ? (
        <foreignObject width={item.width} height={item.height} style={{ overflow: 'visible' }}>
          <div className="w-full h-full flex items-center justify-center text-center relative">
            {isEditing ? (
               <div className="relative w-full h-full">
                 <textarea
                   autoFocus
                   className="w-full h-full bg-white/90 text-red-900 border border-blue-400 rounded p-1 text-xs resize-none outline-none leading-tight"
                   value={item.text}
                   onChange={(e) => onTextChange(item.id, e.target.value)}
                   onBlur={() => setIsEditing(false)}
                   onMouseDown={(e) => e.stopPropagation()} 
                 />
                 <TextSuggestions onSelect={(text) => onTextChange(item.id, text)} />
               </div>
            ) : (
               <div className="text-red-900 font-bold text-xs leading-tight whitespace-pre-wrap select-none" style={{ textShadow: '0px 0px 2px rgba(255,255,255,0.8)' }}>
                 {item.text || "Text"}
               </div>
            )}
          </div>
        </foreignObject>
      ) : (
        <SymbolIcon className="w-full h-full" color={config.symbols.color} />
      )}
    </div>
  );
};

// MeasurementLine receiving config
const MeasurementLine = ({ line, isSelected, onSelect, unit, onValueChange, config }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const unitConfig = UNITS[unit];

  const getNumericValue = (mm) => {
    if (mm == null) return "";
    return parseFloat((mm * unitConfig.factor).toFixed(unitConfig.precision)).toString();
  };

  const handleStartEdit = (e) => {
    e.stopPropagation();
    setIsEditing(true);
    setInputValue(getNumericValue(line.manualLengthMm));
  };

  const handleInputChange = (e) => {
    const text = e.target.value;
    if (!/^\d*\.?\d*$/.test(text)) return; 
    setInputValue(text);
    if (text === '' || text === '.') {
      onValueChange(line.id, null);
    } else {
      const val = parseFloat(text);
      if (!isNaN(val)) onValueChange(line.id, val / unitConfig.factor);
    }
  };

  let displayValue = isEditing ? inputValue : (line.manualLengthMm == null ? "---" : `${getNumericValue(line.manualLengthMm)}${unitConfig.suffix}`);

  const cx = (line.x1 + line.x2) / 2;
  const cy = (line.y1 + line.y2) / 2;
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const isMoreHorizontal = Math.abs(dx) >= Math.abs(dy);
   
  // Use individual extensions if present, otherwise default to config
  const extLenStart = (line.extLenStart ?? config.measurements.extensionLength) * MM_TO_PX;
  const extLenEnd = (line.extLenEnd ?? config.measurements.extensionLength) * MM_TO_PX;

  // Calculate perpendicular offsets
  const pxStart = isMoreHorizontal ? 0 : extLenStart / 2;
  const pyStart = isMoreHorizontal ? extLenStart / 2 : 0;
  
  const pxEnd = isMoreHorizontal ? 0 : extLenEnd / 2;
  const pyEnd = isMoreHorizontal ? extLenEnd / 2 : 0;

  const strokeColor = isSelected ? config.measurements.colorSelected : config.measurements.colorDefault; 

  return (
    <g onClick={(e) => { e.stopPropagation(); onSelect(); }} className="cursor-pointer">
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="transparent" strokeWidth="15" pointerEvents="auto" />
      
      {/* Extension Lines with Offset */}
      {/* Start Extension */}
      <line 
        x1={line.x1 - pxStart} y1={line.y1 - pyStart} 
        x2={line.x1 + pxStart} y2={line.y1 + pyStart} 
        stroke={strokeColor} strokeWidth={1} pointerEvents="none" 
      />
      {/* End Extension */}
      <line 
        x1={line.x2 - pxEnd} y1={line.y2 - pyEnd} 
        x2={line.x2 + pxEnd} y2={line.y2 + pyEnd} 
        stroke={strokeColor} strokeWidth={1} pointerEvents="none" 
      />
      
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={strokeColor} strokeWidth={config.measurements.strokeWidth} markerEnd="url(#arrowhead-measure-end)" markerStart="url(#arrowhead-measure-start)" pointerEvents="none" />
      
      <foreignObject x={cx - 60} y={cy - 20} width="120" height="40" style={{ pointerEvents: 'none' }}>
        <div className="flex items-center justify-center w-full h-full">
          {isEditing ? (
            <input 
              autoFocus 
              type="text" 
              value={inputValue} 
              onChange={handleInputChange} 
              onBlur={() => setIsEditing(false)} 
              onClick={(e) => e.stopPropagation()} 
              style={{ 
                pointerEvents: 'auto',
                color: config.measurements.fontColor
              }} 
              className="w-24 text-center font-bold font-mono outline-none border border-blue-400 rounded px-1 text-xl" 
            />
          ) : (
            <span onClick={handleStartEdit} style={{ pointerEvents: 'auto', fontSize: `${config.measurements.fontSize}px`, color: config.measurements.fontColor, backgroundColor: `rgba(255,255,255,${config.measurements.textBgOpacity})` }} className="px-1 font-bold font-mono rounded cursor-text hover:bg-slate-50 transition-colors">
              {displayValue}
            </span>
          )}
        </div>
      </foreignObject>
    </g>
  );
};

// AnnotationLine receiving config
const AnnotationLine = ({ line, isSelected, onSelect, onTextChange, config }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputText, setInputText] = useState("");

  const handleStartEdit = (e) => {
    e.stopPropagation();
    setIsEditing(true);
    setInputText(line.text || "15-AMP Electric Socket");
  };

  const handleBlur = () => {
    setIsEditing(false);
    onTextChange(line.id, inputText);
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
  };

  const strokeColor = isSelected ? config.measurements.colorSelected : config.annotations.color; 

  return (
    <g onClick={(e) => { e.stopPropagation(); onSelect(); }} className="cursor-pointer">
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="transparent" strokeWidth="15" pointerEvents="auto" />
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={strokeColor} strokeWidth={config.annotations.strokeWidth} markerEnd="url(#arrowhead-annotation)" pointerEvents="none" />
      
      <foreignObject x={line.x1 - 60} y={line.y1 - 20} width="120" height="40" style={{ pointerEvents: 'none', overflow: 'visible' }}>
        <div className="flex items-center justify-center w-full h-full relative">
          {isEditing ? (
            <div className="relative">
              <input 
                autoFocus 
                type="text" 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
                onBlur={handleBlur} 
                onClick={(e) => e.stopPropagation()} 
                style={{ 
                  pointerEvents: 'auto',
                  color: config.annotations.color 
                }} 
                className="w-28 text-center bg-white font-bold text-sm outline-none border border-blue-400 rounded px-1" 
              />
              <TextSuggestions onSelect={(text) => { setInputText(text); onTextChange(line.id, text); }} />
            </div>
          ) : (
            <span onDoubleClick={handleStartEdit} style={{ pointerEvents: 'auto', fontSize: `${config.annotations.fontSize}px`, color: config.annotations.color, backgroundColor: `rgba(255,255,255,${config.annotations.textBgOpacity})` }} className="px-1 font-bold rounded cursor-text border border-transparent hover:border-red-200">
              {line.text || "15-AMP Electric Socket"}
            </span>
          )}
        </div>
      </foreignObject>
    </g>
  );
};

const SimpleLine = ({ line, isSelected, onSelect, config }) => {
  const strokeColor = isSelected ? config.measurements.colorSelected : "black"; 
  return (
    <g onClick={(e) => { e.stopPropagation(); onSelect(); }} className="cursor-pointer">
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="transparent" strokeWidth="15" pointerEvents="auto" />
      <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke={strokeColor} strokeWidth="2" pointerEvents="none" />
    </g>
  );
};

const SimpleBox = ({ line, isSelected, onSelect, onMove, config }) => {
  const strokeColor = isSelected ? config.measurements.colorSelected : "black"; 
  const x = Math.min(line.x1, line.x2);
  const y = Math.min(line.y1, line.y2);
  const width = Math.abs(line.x2 - line.x1);
  const height = Math.abs(line.y2 - line.y1);

  let fill = "none";
  if (line.fillStyle === 'solid') fill = "black";
  else if (line.fillStyle === 'hatch') fill = "url(#diagonalHatch)";

  return (
    <g onClick={(e) => { e.stopPropagation(); onSelect(); }} onMouseDown={(e) => { e.stopPropagation(); onMove(e); }} className="cursor-move">
      <rect x={x} y={y} width={width} height={height} stroke="transparent" fill="none" strokeWidth="15" pointerEvents="stroke" />
      <rect x={x} y={y} width={width} height={height} stroke={strokeColor} strokeWidth="2" fill={fill} pointerEvents="none" />
    </g>
  );
};

const SimpleCircle = ({ line, isSelected, onSelect, onMove, config }) => {
  const strokeColor = isSelected ? config.measurements.colorSelected : "black";
  const x = Math.min(line.x1, line.x2);
  const y = Math.min(line.y1, line.y2);
  const width = Math.abs(line.x2 - line.x1);
  const height = Math.abs(line.y2 - line.y1);
  const rx = width / 2;
  const ry = height / 2;
  const cx = x + rx;
  const cy = y + ry;

  let fill = "none";
  if (line.fillStyle === 'solid') fill = "black"; 
  else if (line.fillStyle === 'hatch') fill = "url(#diagonalHatch)";

  return (
    <g
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={(e) => { e.stopPropagation(); onMove(e); }}
      className="cursor-move"
    >
      {/* Hit Area */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke="transparent" fill="none" strokeWidth="15" pointerEvents="stroke" />
      {/* Visual Circle */}
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} stroke={strokeColor} strokeWidth="2" fill={fill} pointerEvents="none" />
    </g>
  );
};

// --- God Mode Panel Component ---
const GodModePanel = ({ config, setConfig, onClose }) => {
  const [activeZone, setActiveZone] = useState('left');
   
  const handleChange = (path, value) => {
    setConfig(prev => {
      const newConfig = { ...prev };
      // Deep update helper
      const keys = path.split('.');
      let current = newConfig;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newConfig;
    });
  };

  const renderZoneControls = (zoneName) => (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <label>Perspective <input type="number" value={config.zones[zoneName].p} onChange={(e) => handleChange(`zones.${zoneName}.p`, parseInt(e.target.value))} className="w-full border rounded" /></label>
      <label>Rot X <input type="number" value={config.zones[zoneName].rx} onChange={(e) => handleChange(`zones.${zoneName}.rx`, parseInt(e.target.value))} className="w-full border rounded" /></label>
      <label>Rot Y <input type="number" value={config.zones[zoneName].ry} onChange={(e) => handleChange(`zones.${zoneName}.ry`, parseInt(e.target.value))} className="w-full border rounded" /></label>
      <label>Rot Z <input type="number" value={config.zones[zoneName].rz} onChange={(e) => handleChange(`zones.${zoneName}.rz`, parseInt(e.target.value))} className="w-full border rounded" /></label>
      <label>Skew X <input type="number" value={config.zones[zoneName].sx} onChange={(e) => handleChange(`zones.${zoneName}.sx`, parseInt(e.target.value))} className="w-full border rounded" /></label>
      <label>Skew Y <input type="number" value={config.zones[zoneName].sy} onChange={(e) => handleChange(`zones.${zoneName}.sy`, parseInt(e.target.value))} className="w-full border rounded" /></label>
    </div>
  );

  return (
    <div className="absolute top-16 right-4 w-80 bg-white shadow-2xl border border-slate-300 rounded-lg z-[150] flex flex-col max-h-[80vh]">
      <div className="p-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center rounded-t-lg">
        <h2 className="font-bold text-slate-800 flex items-center gap-2"><Sparkles size={16} className="text-yellow-500" /> God Mode</h2>
        <button onClick={onClose}><X size={16} className="text-slate-500 hover:text-red-500" /></button>
      </div>
      <div className="overflow-y-auto p-4 space-y-4">
        
        {/* Global */}
        <details open className="group">
          <summary className="font-bold text-xs uppercase text-slate-400 mb-2 cursor-pointer list-none flex justify-between items-center">Global <ChevronDown size={12} /></summary>
          <div className="space-y-2 text-sm pl-2 border-l-2 border-slate-100">
             <label className="flex items-center justify-between">Canvas BG <input type="color" value={config.global.canvasColor} onChange={(e) => handleChange('global.canvasColor', e.target.value)} /></label>
             <label className="flex items-center justify-between">Snap Threshold <input type="number" value={config.global.snapThreshold} onChange={(e) => handleChange('global.snapThreshold', parseInt(e.target.value))} className="w-16 border rounded px-1" /></label>
             <label className="flex items-center justify-between">Show Grid Lines <input type="checkbox" checked={config.global.showGrid} onChange={(e) => handleChange('global.showGrid', e.target.checked)} /></label>
             <label className="flex items-center justify-between">Show Default BG <input type="checkbox" checked={config.global.backgroundVisible} onChange={(e) => handleChange('global.backgroundVisible', e.target.checked)} /></label>
          </div>
        </details>

        {/* Measurements */}
        <details className="group">
          <summary className="font-bold text-xs uppercase text-slate-400 mb-2 cursor-pointer list-none flex justify-between items-center">Measurements <ChevronDown size={12} /></summary>
          <div className="space-y-2 text-sm pl-2 border-l-2 border-slate-100">
             <label className="flex justify-between">Arrow Size <input type="range" min="2" max="20" value={config.measurements.arrowSize} onChange={(e) => handleChange('measurements.arrowSize', parseInt(e.target.value))} /></label>
             <label className="flex justify-between">Arrow Aspect <input type="number" step="0.1" min="0.1" max="2" value={config.measurements.arrowAspectRatio} onChange={(e) => handleChange('measurements.arrowAspectRatio', parseFloat(e.target.value))} className="w-12 border rounded" /></label>
             <label className="flex justify-between">Stroke Width <input type="range" min="0.5" max="5" step="0.5" value={config.measurements.strokeWidth} onChange={(e) => handleChange('measurements.strokeWidth', parseFloat(e.target.value))} /></label>
             <label className="flex justify-between">Ext. Length <input type="range" min="0" max="20" value={config.measurements.extensionLength} onChange={(e) => handleChange('measurements.extensionLength', parseInt(e.target.value))} /></label>
             <label className="flex justify-between">Ext. Offset <input type="range" min="0" max="20" value={config.measurements.extensionOffset} onChange={(e) => handleChange('measurements.extensionOffset', parseInt(e.target.value))} /></label>
             <label className="flex justify-between">Font Size <input type="number" value={config.measurements.fontSize} onChange={(e) => handleChange('measurements.fontSize', parseInt(e.target.value))} className="w-12 border rounded" /></label>
             <label className="flex justify-between">Font Color <input type="color" value={config.measurements.fontColor} onChange={(e) => handleChange('measurements.fontColor', e.target.value)} /></label>
             <label className="flex justify-between">Text BG Opacity <input type="range" min="0" max="1" step="0.1" value={config.measurements.textBgOpacity} onChange={(e) => handleChange('measurements.textBgOpacity', parseFloat(e.target.value))} /></label>
             <label className="flex justify-between">Default Color <input type="color" value={config.measurements.colorDefault} onChange={(e) => handleChange('measurements.colorDefault', e.target.value)} /></label>
             <label className="flex justify-between">Selection Color <input type="color" value={config.measurements.colorSelected} onChange={(e) => handleChange('measurements.colorSelected', e.target.value)} /></label>
          </div>
        </details>

        {/* Annotations */}
        <details className="group">
          <summary className="font-bold text-xs uppercase text-slate-400 mb-2 cursor-pointer list-none flex justify-between items-center">Annotations <ChevronDown size={12} /></summary>
          <div className="space-y-2 text-sm pl-2 border-l-2 border-slate-100">
             <label className="flex justify-between">Font Size <input type="number" value={config.annotations.fontSize} onChange={(e) => handleChange('annotations.fontSize', parseInt(e.target.value))} className="w-12 border rounded" /></label>
             <label className="flex justify-between">Color <input type="color" value={config.annotations.color} onChange={(e) => handleChange('annotations.color', e.target.value)} /></label>
             <label className="flex justify-between">Text BG Opacity <input type="range" min="0" max="1" step="0.1" value={config.annotations.textBgOpacity} onChange={(e) => handleChange('annotations.textBgOpacity', parseFloat(e.target.value))} /></label>
             <label className="flex justify-between">Stroke Width <input type="range" min="0.5" max="5" step="0.5" value={config.annotations.strokeWidth} onChange={(e) => handleChange('annotations.strokeWidth', parseFloat(e.target.value))} /></label>
             <label className="flex justify-between">Arrow Size <input type="range" min="2" max="20" value={config.annotations.arrowSize} onChange={(e) => handleChange('annotations.arrowSize', parseInt(e.target.value))} /></label>
          </div>
        </details>

        {/* Simple Shapes */}
        <details className="group">
          <summary className="font-bold text-xs uppercase text-slate-400 mb-2 cursor-pointer list-none flex justify-between items-center">Simple Shapes <ChevronDown size={12} /></summary>
          <div className="space-y-2 text-sm pl-2 border-l-2 border-slate-100">
             <label className="flex justify-between">Stroke Width <input type="range" min="0.5" max="10" step="0.5" value={config.simpleShapes.strokeWidth} onChange={(e) => handleChange('simpleShapes.strokeWidth', parseFloat(e.target.value))} /></label>
             <label className="flex justify-between">Stroke Color <input type="color" value={config.simpleShapes.strokeColor} onChange={(e) => handleChange('simpleShapes.strokeColor', e.target.value)} /></label>
             <label className="flex justify-between">Select Color <input type="color" value={config.simpleShapes.colorSelected} onChange={(e) => handleChange('simpleShapes.colorSelected', e.target.value)} /></label>
             <label className="flex justify-between">Solid Fill Color <input type="color" value={config.simpleShapes.solidFillColor} onChange={(e) => handleChange('simpleShapes.solidFillColor', e.target.value)} /></label>
             <label className="flex justify-between">Fill Opacity <input type="range" min="0" max="1" step="0.1" value={config.simpleShapes.fillOpacity} onChange={(e) => handleChange('simpleShapes.fillOpacity', parseFloat(e.target.value))} /></label>
             
             <h4 className="font-bold text-[10px] uppercase text-slate-400 mt-2">Hatch Settings</h4>
             <label className="flex justify-between">Spacing <input type="number" value={config.simpleShapes.hatchSpacing} onChange={(e) => handleChange('simpleShapes.hatchSpacing', parseInt(e.target.value))} className="w-12 border rounded" /></label>
             <label className="flex justify-between">Angle <input type="number" value={config.simpleShapes.hatchAngle} onChange={(e) => handleChange('simpleShapes.hatchAngle', parseInt(e.target.value))} className="w-12 border rounded" /></label>
             <label className="flex justify-between">Color <input type="color" value={config.simpleShapes.hatchColor} onChange={(e) => handleChange('simpleShapes.hatchColor', e.target.value)} /></label>
             <label className="flex justify-between">Stroke <input type="number" step="0.1" value={config.simpleShapes.hatchStrokeWidth} onChange={(e) => handleChange('simpleShapes.hatchStrokeWidth', parseFloat(e.target.value))} className="w-12 border rounded" /></label>
          </div>
        </details>

         {/* Symbols */}
        <details className="group">
          <summary className="font-bold text-xs uppercase text-slate-400 mb-2 cursor-pointer list-none flex justify-between items-center">Symbols <ChevronDown size={12} /></summary>
          <div className="space-y-2 text-sm pl-2 border-l-2 border-slate-100">
             <label className="flex justify-between">Symbol Color <input type="color" value={config.symbols.color} onChange={(e) => handleChange('symbols.color', e.target.value)} /></label>
             <label className="flex justify-between">Base Scale <input type="number" step="0.1" min="0.1" max="5" value={config.symbols.baseScale} onChange={(e) => handleChange('symbols.baseScale', parseFloat(e.target.value))} className="w-16 border rounded" /></label>
             <label className="flex justify-between">Snap Offset (Ratio) <input type="number" step="0.05" min="0" max="2" value={config.symbols.snapOffsetFactor} onChange={(e) => handleChange('symbols.snapOffsetFactor', parseFloat(e.target.value))} className="w-16 border rounded" /></label>
             <label className="flex justify-between">Select Padding (px) <input type="number" min="0" max="20" value={config.symbols.selectionPadding} onChange={(e) => handleChange('symbols.selectionPadding', parseInt(e.target.value))} className="w-16 border rounded" /></label>
          </div>
        </details>

        {/* Interaction Handles */}
        <details className="group">
          <summary className="font-bold text-xs uppercase text-slate-400 mb-2 cursor-pointer list-none flex justify-between items-center">Handles <ChevronDown size={12} /></summary>
          <div className="space-y-2 text-sm pl-2 border-l-2 border-slate-100">
             <label className="flex justify-between">Size (px) <input type="number" min="4" max="24" value={config.handles.size} onChange={(e) => handleChange('handles.size', parseInt(e.target.value))} className="w-16 border rounded" /></label>
             <label className="flex justify-between">Hover Scale <input type="number" step="0.1" min="1" max="3" value={config.handles.hoverScale} onChange={(e) => handleChange('handles.hoverScale', parseFloat(e.target.value))} className="w-16 border rounded" /></label>
             <label className="flex justify-between">Color <input type="color" value={config.handles.color} onChange={(e) => handleChange('handles.color', e.target.value)} /></label>
             <label className="flex justify-between">Border <input type="color" value={config.handles.borderColor} onChange={(e) => handleChange('handles.borderColor', e.target.value)} /></label>
          </div>
        </details>

        {/* Zones / Perspective */}
        <details className="group">
          <summary className="font-bold text-xs uppercase text-slate-400 mb-2 cursor-pointer list-none flex justify-between items-center">Perspective Zones <ChevronDown size={12} /></summary>
          <div className="pl-2 border-l-2 border-slate-100">
            <div className="flex justify-between items-center mb-2">
               <select 
                 value={activeZone} 
                 onChange={(e) => setActiveZone(e.target.value)}
                 className="text-xs border rounded p-1 bg-white w-full"
               >
                 <option value="left">Left Wall</option>
                 <option value="right">Right Wall</option>
                 <option value="front">Front Wall</option>
                 <option value="floor">Floor</option>
                 <option value="text">Text / Flat</option>
               </select>
            </div>
            <div className="bg-slate-50 p-2 rounded border border-slate-100">
               {renderZoneControls(activeZone)}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};


// --- Main Application ---

export default function App() {
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [elements, setElements] = useState([]);
  const [lines, setLines] = useState([]); 
  const [selectedId, setSelectedId] = useState(null);
  const [selectedHandle, setSelectedHandle] = useState(null); // { id: string, type: 'start'|'end' }
  const [drawingTool, setDrawingTool] = useState(null);
  const [unit, setUnit] = useState('inch');
  const [showBackground, setShowBackground] = useState(true);
  const [stickyTools, setStickyTools] = useState(true);
  
  // History State
  const [history, setHistory] = useState([{ elements: [], lines: [] }]);
  const [historyStep, setHistoryStep] = useState(0);

  // God Mode State
  const [godModeUnlocked, setGodModeUnlocked] = useState(false);
  const [showGodPanel, setShowGodPanel] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Export State
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const [interaction, setInteraction] = useState({ 
    type: 'idle', 
    activeId: null, 
    handleType: null,
    startX: 0,
    startY: 0,
    initialData: null,
    hasMoved: false 
  });

  const canvasRef = useRef(null);

  // Load external scripts
  useEffect(() => {
    const scripts = [
      'https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    ];
    scripts.forEach(src => {
      if (!document.querySelector(`script[src="${src}"]`)) {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        document.body.appendChild(script);
      }
    });
  }, []);

  // --- History Logic ---
  const addToHistory = (newElements, newLines) => {
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push({
      elements: JSON.parse(JSON.stringify(newElements)),
      lines: JSON.parse(JSON.stringify(newLines))
    });
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = () => {
    if (historyStep > 0) {
      const prevStep = historyStep - 1;
      setHistoryStep(prevStep);
      setElements(JSON.parse(JSON.stringify(history[prevStep].elements)));
      setLines(JSON.parse(JSON.stringify(history[prevStep].lines)));
      setSelectedId(null);
      setSelectedHandle(null);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const nextStep = historyStep + 1;
      setHistoryStep(nextStep);
      setElements(JSON.parse(JSON.stringify(history[nextStep].elements)));
      setLines(JSON.parse(JSON.stringify(history[nextStep].lines)));
      setSelectedId(null);
      setSelectedHandle(null);
    }
  };

  const handleGodModeClick = () => {
    if (godModeUnlocked) {
      setShowGodPanel(!showGodPanel);
    } else {
      setShowPasswordModal(true);
    }
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === "khuljasimsim") {
      setGodModeUnlocked(true);
      setShowPasswordModal(false);
      setShowGodPanel(true);
      setPasswordInput("");
    } else {
      alert("Access Denied");
    }
  };

  // --- Export Handlers ---
  const handleExportPdf = async () => {
    if (!canvasRef.current || !window.domtoimage || !window.jspdf) return;
    setIsExportingPdf(true);
    const prevSelection = selectedId;
    setSelectedId(null);
    setSelectedHandle(null);
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const dataUrl = await window.domtoimage.toPng(canvasRef.current, {
        bgcolor: config.global.canvasColor, 
        width: canvasRef.current.offsetWidth,
        height: canvasRef.current.offsetHeight
      });
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgProps = doc.getImageProperties(dataUrl);
      const pdfWidth = doc.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      doc.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      doc.save('canvas-layout.pdf');
    } catch (err) {
      console.error('PDF Export failed', err);
      alert('Failed to export PDF');
    } finally {
      setIsExportingPdf(false);
      setSelectedId(prevSelection);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!canvasRef.current || !window.domtoimage) return;
    setIsCopying(true);
    const prevSelection = selectedId;
    setSelectedId(null);
    setSelectedHandle(null);
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const blob = await window.domtoimage.toBlob(canvasRef.current, {
        bgcolor: config.global.canvasColor, 
        width: canvasRef.current.offsetWidth,
        height: canvasRef.current.offsetHeight
      });
      const item = new ClipboardItem({ 'image/png': blob });
      await navigator.clipboard.write([item]);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Clipboard capture failed', err);
      alert('Failed to copy to clipboard');
    } finally {
      setIsCopying(false);
      setSelectedId(prevSelection);
    }
  };

  // --- Snapping Logic ---
  const getSnapPosition = (rawX, rawY, anchorX = null, anchorY = null, excludeId = null, activeType = null) => {
    const toPxX = (mm) => mm * MM_TO_PX;
    const toPxY = (mm) => mm * MM_TO_PX;
    const SNAP_THRESH = config.global.snapThreshold; 
    
    let bestX = rawX;
    let bestY = rawY;
    let minDistX = SNAP_THRESH;
    let minDistY = SNAP_THRESH;
    let snapped = false;

    const trySnapX = (val) => {
      const dist = Math.abs(rawX - val);
      if (dist < minDistX) {
        minDistX = dist;
        bestX = val;
        snapped = true;
      }
    };
    const trySnapY = (val) => {
      const dist = Math.abs(rawY - val);
      if (dist < minDistY) {
        minDistY = dist;
        bestY = val;
        snapped = true;
      }
    };
    
    const tryPointSnap = (tx, ty) => {
       const dist = Math.hypot(rawX - tx, rawY - ty);
       if (dist < SNAP_THRESH) {
         return { x: tx, y: ty, snapped: true };
       }
       return null;
    };

    const isMeasurement = activeType === 'measurement';

    // 1. Check for Exact Point Snaps (Connectivity)
    for (const el of elements) {
      const w = el.width;
      const h = el.height;
      let offsets = [];

      if (isMeasurement) {
         const gap = w * config.symbols.snapOffsetFactor; 
         offsets = [
            { x: 0, y: 0 }, 
            { x: 0, y: -h/2 - gap }, 
            { x: 0, y: h/2 + gap }, 
            { x: -w/2 - gap, y: 0 }, 
            { x: w/2 + gap, y: 0 }, 
         ];
      } else {
         offsets = [
            { x: 0, y: 0 }, { x: -w/2, y: -h/2 }, { x: 0, y: -h/2 }, { x: w/2, y: -h/2 },
            { x: w/2, y: 0 }, { x: w/2, y: h/2 }, { x: 0, y: h/2 }, { x: -w/2, y: h/2 }, { x: -w/2, y: 0 },
         ];
      }

      for (const off of offsets) {
        const tx = el.x + off.x;
        const ty = el.y + off.y;
        const pointMatch = tryPointSnap(tx, ty);
        if (pointMatch) return pointMatch;
      }
    }

    for (const line of lines) {
      if (line.id === excludeId) continue;
      
      const points = [];
      const segments = [];

      if (line.type === 'box') {
         points.push({ x: line.x1, y: line.y1 });
         points.push({ x: line.x2, y: line.y1 });
         points.push({ x: line.x2, y: line.y2 });
         points.push({ x: line.x1, y: line.y2 });
         
         segments.push({ x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y1 }); // Top
         segments.push({ x1: line.x2, y1: line.y1, x2: line.x2, y2: line.y2 }); // Right
         segments.push({ x1: line.x2, y1: line.y2, x2: line.x1, y2: line.y2 }); // Bottom
         segments.push({ x1: line.x1, y1: line.y2, x2: line.x1, y2: line.y1 }); // Left

      } else if (line.type === 'circle') {
        const cx = (line.x1 + line.x2) / 2;
        const cy = (line.y1 + line.y2) / 2;
        points.push({ x: cx, y: cy });
        const rx = Math.abs(line.x1 - line.x2) / 2;
        const ry = Math.abs(line.y1 - line.y2) / 2;
        const xMin = Math.min(line.x1, line.x2);
        const yMin = Math.min(line.y1, line.y2);
        const centerX = xMin + rx;
        const centerY = yMin + ry;
        points.push({ x: centerX, y: yMin });      
        points.push({ x: centerX, y: yMin + 2*ry}); 
        points.push({ x: xMin, y: centerY });       
        points.push({ x: xMin + 2*rx, y: centerY});
      } else {
         points.push({ x: line.x1, y: line.y1 });
         points.push({ x: line.x2, y: line.y2 });
         segments.push({ x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 });
      }

      for (const pt of points) {
         const pointMatch = tryPointSnap(pt.x, pt.y);
         if (pointMatch) return pointMatch;
      }

      for (const seg of segments) {
         const res = distToSegment(rawX, rawY, seg.x1, seg.y1, seg.x2, seg.y2);
         if (res.dist < SNAP_THRESH) {
            const isVert = Math.abs(seg.x1 - seg.x2) < 0.1;
            const isHorz = Math.abs(seg.y1 - seg.y2) < 0.1;

            if (isVert) trySnapX(res.x);
            else if (isHorz) trySnapY(res.y);
            else {
               trySnapX(res.x);
               trySnapY(res.y);
            }
         }
      }
    }

    if (anchorX !== null && anchorY !== null) {
      trySnapX(anchorX);
      trySnapY(anchorY);
    }

    const backgroundSegments = [
      { x1: 0, y1: 0, x2: toPxX(210), y2: 0 }, 
      { x1: toPxX(210), y1: 0, x2: toPxX(210), y2: toPxY(210) },
      { x1: toPxX(210), y1: toPxY(210), x2: 0, y2: toPxY(210) },
      { x1: 0, y1: toPxY(210), x2: 0, y2: 0 },
    ];

    if (showBackground) {
      backgroundSegments.push(
        { x1: toPxX(45), y1: 0, x2: toPxX(45), y2: toPxY(120) },
        { x1: toPxX(165), y1: 0, x2: toPxX(165), y2: toPxY(120) },
        { x1: toPxX(45), y1: toPxY(120), x2: toPxX(165), y2: toPxY(120) },
        { x1: 0, y1: toPxY(210), x2: toPxX(45), y2: toPxY(120) },
        { x1: toPxX(210), y1: toPxY(210), x2: toPxX(165), y2: toPxY(120) }
      );
    }

    for (const seg of backgroundSegments) {
       const res = distToSegment(rawX, rawY, seg.x1, seg.y1, seg.x2, seg.y2);
       if (res.dist < SNAP_THRESH) {
          const p1Match = tryPointSnap(seg.x1, seg.y1);
          if (p1Match) return p1Match;
          const p2Match = tryPointSnap(seg.x2, seg.y2);
          if (p2Match) return p2Match;

          const isVert = Math.abs(seg.x1 - seg.x2) < 0.1;
          const isHorz = Math.abs(seg.y1 - seg.y2) < 0.1;

          if (isVert) trySnapX(res.x);
          else if (isHorz) trySnapY(res.y);
          else {
             trySnapX(res.x);
             trySnapY(res.y);
          }
       }
    }

    return { x: bestX, y: bestY, snapped };
  };

  // --- Handlers ---

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (drawingTool) return;

    const typeId = e.dataTransfer.getData('application/react-symbol-id');
    if (!typeId || !canvasRef.current) return;

    const symbolDef = SYMBOL_TYPES.find(t => t.id === typeId);
    if (!symbolDef) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    
    const mmX = pixelX * PX_TO_MM;
    const mmY = pixelY * PX_TO_MM;
    const zone = getZone(mmX, mmY);

    const heightPx = symbolDef.baseHeightMm * MM_TO_PX;
    const widthPx = symbolDef.id === 'text_label' ? 120 : heightPx * symbolDef.aspectRatio;

    const newElement = {
      id: crypto.randomUUID(),
      type: typeId,
      x: pixelX,
      y: pixelY,
      width: widthPx,
      height: symbolDef.id === 'text_label' ? 60 : heightPx,
      zone, 
      rotation: 0,
      text: symbolDef.id === 'text_label' ? "Hot & Cold \n Water Inlet" : null
    };

    const nextElements = [...elements, newElement];
    setElements(nextElements);
    setSelectedId(newElement.id);
    addToHistory(nextElements, lines);
  };

  const handleMouseDown = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Determine type based on drawingTool
    let activeType = null;
    if (drawingTool) {
        if (drawingTool === 'ruler') activeType = 'measurement';
        else if (drawingTool === 'annotation') activeType = 'annotation';
        else if (drawingTool === 'simple_line') activeType = 'simple_line';
        else activeType = drawingTool; // box, circle
    }

    const startSnap = getSnapPosition(x, y, null, null, null, activeType);

    if (drawingTool) {
      const newLineId = crypto.randomUUID();
      const newLine = { 
        id: newLineId, 
        type: drawingTool === 'ruler' ? 'measurement' : activeType,
        x1: startSnap.x, 
        y1: startSnap.y, 
        x2: startSnap.x, 
        y2: startSnap.y,
        manualLengthMm: null, // For Measurement
        extLenStart: config.measurements.extensionLength, // Initial extension
        extLenEnd: config.measurements.extensionLength,   // Initial extension
        text: '15-AMP Electric Socket', // For Annotation
        fillStyle: 'none'     // For Box/Circle
      };
      setLines(prev => [...prev, newLine]);
      setSelectedId(newLineId);
      setInteraction({
        type: 'drawing_line',
        activeId: newLineId,
        startX: startSnap.x,
        startY: startSnap.y,
        initialData: newLine,
        hasMoved: false
      });
      return;
    }

    setSelectedId(null);
    setSelectedHandle(null);
  };

  const handleSymbolMouseDown = (e, id) => {
    if (drawingTool) return;
    e.stopPropagation();
    const item = elements.find(el => el.id === id);
    if (!item) return;

    setSelectedId(id);
    setSelectedHandle(null);
    setInteraction({
      type: 'dragging_symbol',
      activeId: id,
      startX: e.clientX,
      startY: e.clientY,
      initialData: { x: item.x, y: item.y },
      hasMoved: false
    });
  };

  const handleTextChange = (id, newText) => {
    const nextElements = elements.map(el => 
      el.id === id ? { ...el, text: newText } : el
    );
    setElements(nextElements);
    addToHistory(nextElements, lines);
  };

  const handleLineTextChange = (id, newText) => {
    const nextLines = lines.map(l => 
      l.id === id ? { ...l, text: newText } : l
    );
    setLines(nextLines);
    addToHistory(elements, nextLines);
  };

  const handleUpdateFillStyle = (style) => {
    if (!selectedId) return;
    const nextLines = lines.map(l => 
      l.id === selectedId ? { ...l, fillStyle: style } : l
    );
    setLines(nextLines);
    addToHistory(elements, nextLines);
  };

  const handleHandleMouseDown = (e, lineId, handleType) => {
    if (drawingTool) return;
    e.stopPropagation();
    const line = lines.find(m => m.id === lineId);
    if (!line) return;

    setSelectedId(lineId);
    
    // Set selected handle for keyboard interaction
    if (handleType === 'start' || handleType === 'end') {
      setSelectedHandle({ id: lineId, type: handleType });
    } else {
      setSelectedHandle(null);
    }

    setInteraction({
      type: 'moving_handle',
      activeId: lineId,
      handleType: handleType,
      startX: e.clientX, 
      startY: e.clientY,
      initialData: { ...line },
      hasMoved: false
    });
  };

  const handleBoxMove = (e, lineId) => {
    if (drawingTool) return;
    const line = lines.find(m => m.id === lineId);
    if (!line) return;

    setSelectedId(lineId);
    setSelectedHandle(null);
    setInteraction({
      type: 'moving_line_body',
      activeId: lineId,
      startX: e.clientX,
      startY: e.clientY,
      initialData: { ...line },
      hasMoved: false
    });
  };

  const handleMouseMove = (e) => {
    if (interaction.type === 'idle' || !canvasRef.current) return;

    // Mark as moved if interaction is active
    if (!interaction.hasMoved) {
      setInteraction(prev => ({ ...prev, hasMoved: true }));
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const dx = e.clientX - interaction.startX;
    const dy = e.clientY - interaction.startY;
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    if (interaction.type === 'dragging_symbol') {
      const { initialData, activeId } = interaction;
      const newX = initialData.x + dx;
      const newY = initialData.y + dy;
      
      const mmX = newX * PX_TO_MM;
      const mmY = newY * PX_TO_MM;
      const newZone = getZone(mmX, mmY);

      setElements(prev => prev.map(el => 
        el.id === activeId ? { ...el, x: newX, y: newY, zone: newZone } : el
      ));
    }
    
    else if (interaction.type === 'drawing_line') {
      const startX = interaction.initialData.x1;
      const startY = interaction.initialData.y1;
      
      // Determine type from interaction data
      const activeType = interaction.initialData.type;

      // Pass the current line's ID to exclude it from snap targets (avoid self-snapping)
      const snap = getSnapPosition(canvasX, canvasY, startX, startY, interaction.activeId, activeType);

      setLines(prev => prev.map(m => 
        m.id === interaction.activeId ? { ...m, x2: snap.x, y2: snap.y } : m
      ));
    }

    else if (interaction.type === 'moving_line_body') {
      const { initialData, activeId } = interaction;
      setLines(prev => prev.map(m => {
        if (m.id !== activeId) return m;
        return {
          ...m,
          x1: initialData.x1 + dx,
          y1: initialData.y1 + dy,
          x2: initialData.x2 + dx,
          y2: initialData.y2 + dy,
        };
      }));
    }

    else if (interaction.type === 'moving_handle') {
      const { initialData, activeId, handleType } = interaction;
      const activeType = initialData.type; // Get type from line data being moved
      let anchorX, anchorY;

      // Determine Anchor based on Handle Type
      if (handleType === 'start') { anchorX = initialData.x2; anchorY = initialData.y2; }
      else if (handleType === 'end') { anchorX = initialData.x1; anchorY = initialData.y1; }
      else if (handleType === 'tl') { anchorX = initialData.x2; anchorY = initialData.y2; } 
      else if (handleType === 'br') { anchorX = initialData.x1; anchorY = initialData.y1; }
      else if (handleType === 'tr') { anchorX = initialData.x1; anchorY = initialData.y2; }
      else if (handleType === 'bl') { anchorX = initialData.x2; anchorY = initialData.y1; }
      // Side handles anchor to opposite side roughly, or we just pass the moving point
      else if (handleType === 'edge-y1') { anchorX = (initialData.x1+initialData.x2)/2; anchorY = initialData.y2; }
      else if (handleType === 'edge-y2') { anchorX = (initialData.x1+initialData.x2)/2; anchorY = initialData.y1; }
      else if (handleType === 'edge-x1') { anchorX = initialData.x2; anchorY = (initialData.y1+initialData.y2)/2; }
      else if (handleType === 'edge-x2') { anchorX = initialData.x1; anchorY = (initialData.y1+initialData.y2)/2; }
      else { anchorX = initialData.x1; anchorY = initialData.y1; }

      const snap = getSnapPosition(canvasX, canvasY, anchorX, anchorY, activeId, activeType);
      
      setLines(prev => prev.map(m => {
        if (m.id !== activeId) return m;
        const updated = { ...m };
        
        if (handleType === 'start') { updated.x1 = snap.x; updated.y1 = snap.y; }
        else if (handleType === 'end') { updated.x2 = snap.x; updated.y2 = snap.y; }
        
        else if (handleType === 'tl') { updated.x1 = snap.x; updated.y1 = snap.y; } 
        else if (handleType === 'br') { updated.x2 = snap.x; updated.y2 = snap.y; }
        else if (handleType === 'tr') { updated.x2 = snap.x; updated.y1 = snap.y; }
        else if (handleType === 'bl') { updated.x1 = snap.x; updated.y2 = snap.y; }

        else if (handleType === 'edge-y1') { updated.y1 = snap.y; }
        else if (handleType === 'edge-y2') { updated.y2 = snap.y; }
        else if (handleType === 'edge-x1') { updated.x1 = snap.x; }
        else if (handleType === 'edge-x2') { updated.x2 = snap.x; }

        return updated;
      }));
    }
  };

  const handleMouseUp = () => {
    if (interaction.type !== 'idle' && interaction.hasMoved) {
      // Save to history if we finished an interaction that actually moved something
      addToHistory(elements, lines);
    }

    // Auto-deselect tool if not sticky and we just finished drawing
    if (!stickyTools && interaction.type === 'drawing_line') {
      setDrawingTool(null);
    }

    setInteraction({ type: 'idle', activeId: null, handleType: null, startX: 0, startY: 0, initialData: null, hasMoved: false });
  };

  const handleMeasurementValueChange = (id, newMm) => {
    const nextLines = lines.map(m => 
      m.id === id ? { ...m, manualLengthMm: newMm } : m
    );
    setLines(nextLines);
    addToHistory(elements, nextLines);
  };

  const handleDeleteSelected = () => {
    if (selectedId) {
      const nextElements = elements.filter(el => el.id !== selectedId);
      const nextLines = lines.filter(m => m.id !== selectedId);
      setElements(nextElements);
      setLines(nextLines);
      setSelectedId(null);
      setSelectedHandle(null);
      addToHistory(nextElements, nextLines);
    }
  };

  const clearCanvas = () => {
    if (confirm('Are you sure you want to clear the canvas?')) {
      setElements([]);
      setLines([]);
      setSelectedId(null);
      setSelectedHandle(null);
      addToHistory([], []);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      // Undo/Redo Shortcuts
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
        } else if (e.key === 'y') {
          e.preventDefault();
          redo();
        }
      }

      // Ortho-Locked Handle Movement (Arrow Keys) & Extension Length (+/-)
      if (selectedHandle) {
        const line = lines.find(l => l.id === selectedHandle.id);
        if (line) {
          // Extension Length Controls (Global)
          if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            const field = selectedHandle.type === 'start' ? 'extLenStart' : 'extLenEnd';
            const currentVal = line[field] ?? config.measurements.extensionLength;
            const nextLines = lines.map(l => l.id === line.id ? { ...l, [field]: currentVal + 1 } : l);
            setLines(nextLines);
            addToHistory(elements, nextLines);
            return;
          }
          if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            const field = selectedHandle.type === 'start' ? 'extLenStart' : 'extLenEnd';
            const currentVal = line[field] ?? config.measurements.extensionLength;
            const nextLines = lines.map(l => l.id === line.id ? { ...l, [field]: Math.max(0, currentVal - 1) } : l);
            setLines(nextLines);
            addToHistory(elements, nextLines);
            return;
          }

          // Arrow Key Movement (Tank Controls)
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            const step = e.shiftKey ? 10 : 1; 
            
            const isVert = Math.abs(line.x1 - line.x2) < 0.1;
            const isHorz = Math.abs(line.y1 - line.y2) < 0.1;
            
            let isResizing = false;
            let lenChange = 0;
            let dx = 0;
            let dy = 0;

            if (isHorz) {
                // Horizontal Line
                // Up/Down = Resize Extension (Perpendicular)
                if (e.key === 'ArrowUp') { isResizing = true; lenChange = step; }
                else if (e.key === 'ArrowDown') { isResizing = true; lenChange = -step; }
                // Left/Right = Slide Endpoint (Parallel)
                else if (e.key === 'ArrowLeft') { dx = -step; }
                else if (e.key === 'ArrowRight') { dx = step; }
            } else if (isVert) {
                // Vertical Line
                // Left/Right = Resize Extension (Perpendicular)
                if (e.key === 'ArrowLeft') { isResizing = true; lenChange = -step; }
                else if (e.key === 'ArrowRight') { isResizing = true; lenChange = step; }
                // Up/Down = Slide Endpoint (Parallel)
                else if (e.key === 'ArrowUp') { dy = -step; }
                else if (e.key === 'ArrowDown') { dy = step; }
            } else {
                // Diagonal - Default to standard movement for all keys
                if (e.key === 'ArrowLeft') dx = -step;
                if (e.key === 'ArrowRight') dx = step;
                if (e.key === 'ArrowUp') dy = -step;
                if (e.key === 'ArrowDown') dy = step;
            }

            if (isResizing) {
                 const field = selectedHandle.type === 'start' ? 'extLenStart' : 'extLenEnd';
                 const currentVal = line[field] ?? config.measurements.extensionLength;
                 // Allow shrinking, but min 0
                 // Note: lenChange can be negative. 
                 const nextLines = lines.map(l => l.id === line.id ? { ...l, [field]: Math.max(0, currentVal + lenChange) } : l);
                 setLines(nextLines);
                 addToHistory(elements, nextLines);
            } else {
                 // Moving the handle (Sliding)
                 const updated = { ...line };
                 if (selectedHandle.type === 'start') {
                   updated.x1 += dx;
                   updated.y1 += dy;
                 } else {
                   updated.x2 += dx;
                   updated.y2 += dy;
                 }
                 const nextLines = lines.map(l => l.id === line.id ? updated : l);
                 setLines(nextLines);
                 addToHistory(elements, nextLines);
            }
          }
        }
      }

      // Escape key to cancel drawing tool or deselect
      if (e.key === 'Escape') {
        setDrawingTool(null);
        setSelectedId(null);
        setSelectedHandle(null);
        setInteraction({ type: 'idle', activeId: null, handleType: null, startX: 0, startY: 0, initialData: null, hasMoved: false });
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        handleDeleteSelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedHandle, elements, lines, history, historyStep]);

  const toggleTool = (tool) => {
    if (drawingTool === tool) {
      setDrawingTool(null);
    } else {
      setDrawingTool(tool);
    }
  };

  // Helper to determine if we should enable fill options
  const selectedLine = lines.find(l => l.id === selectedId);
  const isFillOptionEnabled = selectedLine && (selectedLine.type === 'box' || selectedLine.type === 'circle');

  return (
    <div 
      className="flex h-screen w-full bg-slate-100 overflow-hidden font-sans text-slate-900 relative"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ backgroundColor: config.global.canvasColor }}
    >
      
      {/* Header Bar with God Mode */}
      <div className="absolute top-0 right-0 p-4 z-[100] flex gap-2 pointer-events-none">
        <div className="pointer-events-auto">
          <button 
            onClick={handleGodModeClick}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold shadow-md transition-colors ${godModeUnlocked ? 'bg-yellow-100 text-yellow-700 border border-yellow-300' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
          >
            {godModeUnlocked ? <Unlock size={12} /> : <Lock size={12} />}
            {godModeUnlocked ? "God Mode On" : "God Mode"}
          </button>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="absolute inset-0 bg-black/50 z-[110] flex items-center justify-center fixed">
          <form onSubmit={handlePasswordSubmit} className="bg-white p-6 rounded-lg shadow-xl w-80">
            <h3 className="font-bold text-lg mb-4">Enter Password</h3>
            <input 
              type="password" 
              autoFocus
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full border p-2 rounded mb-4"
              placeholder="Magic word..."
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Unlock</button>
            </div>
          </form>
        </div>
      )}

      {/* God Mode Panel */}
      {showGodPanel && <GodModePanel config={config} setConfig={setConfig} onClose={() => setShowGodPanel(false)} />}

      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-lg z-10 shrink-0">
        <div className="p-4 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <MousePointer2 className="w-4 h-4 text-blue-600" />
            Pro Draw
          </h1>
          <div className="mt-2 inline-block px-2 py-1 rounded bg-slate-100 text-[10px] text-slate-500 font-medium">
            Designed by Tejsav
          </div>
        </div>

        {/* Tools Section */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Tools</div>
            <button
              onClick={() => setStickyTools(!stickyTools)}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                stickyTools 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-slate-200 text-slate-600 border border-slate-300'
              }`}
              title={stickyTools ? "Sticky Tools On: Tools remain active after use" : "Sticky Tools Off: Tools deselect after use"}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${stickyTools ? 'bg-blue-600' : 'bg-slate-400'}`} />
              Sticky
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => toggleTool('ruler')}
              className={`w-full flex items-center justify-center gap-2 p-2 rounded border text-xs font-medium transition-colors ${
                drawingTool === 'ruler'
                  ? 'bg-blue-600 text-white border-blue-700' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <PenTool size={14} />
              {drawingTool === 'ruler' ? 'Drawing Ruler...' : 'Draw Ruler'}
            </button>
            <button 
              onClick={() => toggleTool('annotation')}
              className={`w-full flex items-center justify-center gap-2 p-2 rounded border text-xs font-medium transition-colors ${
                drawingTool === 'annotation'
                  ? 'bg-red-700 text-white border-red-800' 
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <MessageSquare size={14} />
              {drawingTool === 'annotation' ? 'Drawing Note...' : 'Draw Annotation'}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => toggleTool('simple_line')}
                className={`flex items-center justify-center gap-2 p-2 rounded border text-xs font-medium transition-colors ${
                  drawingTool === 'simple_line'
                    ? 'bg-black text-white border-black' 
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Minus size={14} />
                Line
              </button>
              <button 
                onClick={() => toggleTool('box')}
                className={`flex items-center justify-center gap-2 p-2 rounded border text-xs font-medium transition-colors ${
                  drawingTool === 'box'
                    ? 'bg-black text-white border-black' 
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Square size={14} />
                Box
              </button>
              <button 
                onClick={() => toggleTool('circle')}
                className={`flex items-center justify-center gap-2 p-2 rounded border text-xs font-medium transition-colors ${
                  drawingTool === 'circle'
                    ? 'bg-black text-white border-black' 
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Circle size={14} />
                Circle
              </button>
            </div>
            
            {/* Fill Controls (Always visible, but disabled/dimmed if not applicable) */}
            <div className={`flex bg-slate-100 p-1 rounded-md mt-2 border border-slate-200 transition-opacity ${isFillOptionEnabled ? 'opacity-100' : 'opacity-50 cursor-not-allowed'}`}>
                <button 
                  onClick={() => isFillOptionEnabled && handleUpdateFillStyle('none')}
                  disabled={!isFillOptionEnabled}
                  className={`flex-1 py-1 flex items-center justify-center rounded ${selectedLine?.fillStyle === 'none' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                  title="No Fill"
                >
                  <Ban size={14} />
                </button>
                <button 
                  onClick={() => isFillOptionEnabled && handleUpdateFillStyle('solid')}
                  disabled={!isFillOptionEnabled}
                  className={`flex-1 py-1 flex items-center justify-center rounded ${selectedLine?.fillStyle === 'solid' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Solid Fill"
                >
                  <Square size={14} fill="currentColor" />
                </button>
                <button 
                  onClick={() => isFillOptionEnabled && handleUpdateFillStyle('hatch')}
                  disabled={!isFillOptionEnabled}
                  className={`flex-1 py-1 flex items-center justify-center rounded ${selectedLine?.fillStyle === 'hatch' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                  title="Hatch Fill"
                >
                  <Grid3X3 size={14} />
                </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2">
            {SYMBOL_TYPES.map(type => (
              <DraggableSidebarItem key={type.id} type={type} />
            ))}
          </div>
        </div>

        <div className="p-3 border-t border-slate-100 bg-slate-50">
          <div className="space-y-4">
            {/* Unit Selection */}
            <div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-2">Units</div>
              <div className="flex bg-slate-100 p-1 rounded-md">
                {Object.keys(UNITS).map(u => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`flex-1 py-1 text-xs font-medium rounded ${
                      unit === u 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Export Actions */}
            <div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-2">Export</div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="w-full flex items-center justify-center gap-2 p-2 rounded bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 transition-colors"
                >
                  {isExportingPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {isExportingPdf ? 'Generating PDF...' : 'Save as PDF'}
                </button>
                <button
                  onClick={handleCopyToClipboard}
                  disabled={isCopying}
                  className="w-full flex items-center justify-center gap-2 p-2 rounded bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 disabled:opacity-50 transition-colors"
                >
                  {isCopying ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : copySuccess ? (
                    <CheckCircle2 size={14} className="text-green-500" />
                  ) : (
                    <Copy size={14} />
                  )}
                  {isCopying ? 'Copying...' : copySuccess ? 'Copied!' : 'Copy to Clipboard'}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-2">Actions</div>
              
              {/* Undo/Redo Buttons */}
              <div className="flex gap-2 mb-2">
                <button 
                  onClick={undo}
                  disabled={historyStep <= 0}
                  className="flex-1 flex items-center justify-center gap-2 p-2 rounded bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo size={14} />
                  Undo
                </button>
                <button 
                  onClick={redo}
                  disabled={historyStep >= history.length - 1}
                  className="flex-1 flex items-center justify-center gap-2 p-2 rounded bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo size={14} />
                  Redo
                </button>
              </div>

              <button 
                onClick={handleDeleteSelected}
                disabled={!selectedId}
                className="w-full flex items-center justify-center gap-2 p-2 rounded bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mb-2"
              >
                <Trash2 size={14} />
                Delete Selected
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={clearCanvas}
                  className="flex-1 flex items-center justify-center gap-2 p-2 rounded bg-white border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <RotateCcw size={14} />
                  Clear
                </button>
                <button 
                  onClick={() => setShowBackground(!showBackground)}
                  className={`flex-1 flex items-center justify-center gap-2 p-2 rounded border text-xs font-medium transition-colors ${
                    !showBackground
                      ? 'bg-slate-700 text-white border-slate-800' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                  title={showBackground ? "Hide Background" : "Show Background"}
                >
                  {showBackground ? <EyeOff size={14} /> : <Eye size={14} />}
                  BG
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 bg-slate-100 relative flex overflow-auto p-8">
        <div className="m-auto relative shadow-2xl bg-white border border-slate-200 shrink-0"
           style={{
             width: `${CANVAS_PX}px`,
             height: `${CANVAS_PX}px`
           }}
        >
          <div 
            ref={canvasRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onMouseDown={handleMouseDown}
            className={`absolute inset-0 z-10 transition-all ${drawingTool ? 'cursor-crosshair' : 'cursor-default'}`}
          >
            {/* Background SVG */}
            <svg 
              viewBox="0 0 210 210" 
              className="absolute inset-0 w-full h-full pointer-events-none z-0"
              style={{ shapeRendering: 'geometricPrecision' }}
            >
              <defs>
                <marker id="arrowhead-unsel" markerWidth={config.measurements.arrowSize} markerHeight={config.measurements.arrowSize*config.measurements.arrowAspectRatio} refX={config.measurements.arrowSize*0.8} refY={config.measurements.arrowSize*config.measurements.arrowAspectRatio*0.5} orient="auto">
                  <polygon points={`0 0, ${config.measurements.arrowSize} ${config.measurements.arrowSize*config.measurements.arrowAspectRatio*0.5}, 0 ${config.measurements.arrowSize*config.measurements.arrowAspectRatio}`} fill={config.measurements.colorDefault} />
                </marker>
                <marker id="arrowhead-sel" markerWidth={config.measurements.arrowSize} markerHeight={config.measurements.arrowSize*config.measurements.arrowAspectRatio} refX={config.measurements.arrowSize*0.8} refY={config.measurements.arrowSize*config.measurements.arrowAspectRatio*0.5} orient="auto">
                  <polygon points={`0 0, ${config.measurements.arrowSize} ${config.measurements.arrowSize*config.measurements.arrowAspectRatio*0.5}, 0 ${config.measurements.arrowSize*config.measurements.arrowAspectRatio}`} fill={config.measurements.colorSelected} />
                </marker>
                <marker id="arrowhead-measure-end" markerWidth={config.measurements.arrowSize} markerHeight={config.measurements.arrowSize*config.measurements.arrowAspectRatio} refX={config.measurements.arrowSize*0.8} refY={config.measurements.arrowSize*config.measurements.arrowAspectRatio*0.5} orient="auto">
                  <polygon points={`0 0, ${config.measurements.arrowSize} ${config.measurements.arrowSize*config.measurements.arrowAspectRatio*0.5}, 0 ${config.measurements.arrowSize*config.measurements.arrowAspectRatio}`} fill={selectedId ? config.measurements.colorSelected : config.measurements.colorDefault} />
                </marker>
                <marker id="arrowhead-measure-start" markerWidth={config.measurements.arrowSize} markerHeight={config.measurements.arrowSize*config.measurements.arrowAspectRatio} refX={config.measurements.arrowSize*0.8} refY={config.measurements.arrowSize*config.measurements.arrowAspectRatio*0.5} orient="auto-start-reverse">
                  <polygon points={`0 0, ${config.measurements.arrowSize} ${config.measurements.arrowSize*config.measurements.arrowAspectRatio*0.5}, 0 ${config.measurements.arrowSize*config.measurements.arrowAspectRatio}`} fill={selectedId ? config.measurements.colorSelected : config.measurements.colorDefault} />
                </marker>
                 
                {/* Annotation Arrow - uses separate config */}
                 <marker id="arrowhead-annotation" markerWidth={config.annotations.arrowSize} markerHeight={config.annotations.arrowSize*0.66} refX={config.annotations.arrowSize*0.8} refY={config.annotations.arrowSize*0.33} orient="auto">
                  <polygon points={`0 0, ${config.annotations.arrowSize} ${config.annotations.arrowSize*0.33}, 0 ${config.annotations.arrowSize*0.66}`} fill={config.annotations.color} />
                </marker>
                 
                {/* Hatch Pattern */}
                <pattern id="diagonalHatch" width={config.simpleShapes.hatchSpacing} height={config.simpleShapes.hatchSpacing} patternTransform={`rotate(${config.simpleShapes.hatchAngle} 0 0)`} patternUnits="userSpaceOnUse">
                  <line x1="0" y1="0" x2="0" y2={config.simpleShapes.hatchSpacing} style={{stroke: config.simpleShapes.hatchColor, strokeWidth: config.simpleShapes.hatchStrokeWidth}} />
                </pattern>
              </defs>

              {showBackground && (
                <>
                  <rect x="45" y="0" width="120" height="120" fill="none" />
                  <polygon points="0,0 45,0 45,120 0,210" fill="none" />
                  <polygon points="165,0 210,0 210,210 165,120" fill="none" />
                  <polygon points="45,120 165,120 210,210 0,210" fill="none" />
                  
                  <g stroke="black" strokeWidth="0.5" fill="none">
                    <rect x="45" y="0" width="120" height="120" />
                    <line x1="45" y1="120" x2="0" y2="210" />
                    <line x1="165" y1="120" x2="210" y2="210" />
                  </g>
                </>
              )}
            </svg>

            {/* Lines Layer (Measurement, Annotation & Simple Line & Boxes) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
               {lines.map(l => {
                 if (l.type === 'box') {
                   return (
                     <SimpleBox
                       key={l.id}
                       line={l}
                       isSelected={selectedId === l.id}
                       onSelect={() => setSelectedId(l.id)}
                       onMove={(e) => handleBoxMove(e, l.id)}
                       config={config}
                     />
                   );
                 } else if (l.type === 'circle') {
                   return (
                     <SimpleCircle
                       key={l.id}
                       line={l}
                       isSelected={selectedId === l.id}
                       onSelect={() => setSelectedId(l.id)}
                       onMove={(e) => handleBoxMove(e, l.id)}
                       config={config}
                     />
                   );
                 } else if (l.type === 'simple_line') {
                   return (
                     <SimpleLine
                       key={l.id}
                       line={l}
                       isSelected={selectedId === l.id}
                       onSelect={() => setSelectedId(l.id)}
                       config={config}
                     />
                   );
                 } else if (l.type === 'annotation') {
                   return (
                     <AnnotationLine
                       key={l.id}
                       line={l}
                       isSelected={selectedId === l.id}
                       onSelect={() => setSelectedId(l.id)}
                       onTextChange={handleLineTextChange}
                       config={config}
                     />
                   );
                 } else {
                   return (
                     <MeasurementLine 
                       key={l.id} 
                       line={l} 
                       isSelected={selectedId === l.id} 
                       onSelect={() => setSelectedId(l.id)}
                       unit={unit}
                       onValueChange={handleMeasurementValueChange}
                       config={config}
                     />
                   );
                 }
               })}
            </svg>

            {/* Selection Handles (Shared Logic) */}
            {lines.map(m => {
               const isSelected = selectedId === m.id;
               if (!isSelected) return null;
               
               if (m.type === 'box' || m.type === 'circle') {
                 // 8 Handles for Boxes & Circles (4 Corners + 4 Sides)
                 return (
                   <React.Fragment key={m.id}>
                     {/* Corner Handles */}
                     <Handle x={m.x1} y={m.y1} cursor="nwse-resize" config={config} onMouseDown={(e) => handleHandleMouseDown(e, m.id, 'tl')} />
                     <Handle x={m.x2} y={m.y1} cursor="nesw-resize" config={config} onMouseDown={(e) => handleHandleMouseDown(e, m.id, 'tr')} />
                     <Handle x={m.x1} y={m.y2} cursor="nesw-resize" config={config} onMouseDown={(e) => handleHandleMouseDown(e, m.id, 'bl')} />
                     <Handle x={m.x2} y={m.y2} cursor="nwse-resize" config={config} onMouseDown={(e) => handleHandleMouseDown(e, m.id, 'br')} />
                     
                     {/* Side Handles */}
                     <Handle x={(m.x1 + m.x2) / 2} y={m.y1} cursor="ns-resize" config={config} onMouseDown={(e) => handleHandleMouseDown(e, m.id, 'edge-y1')} />
                     <Handle x={(m.x1 + m.x2) / 2} y={m.y2} cursor="ns-resize" config={config} onMouseDown={(e) => handleHandleMouseDown(e, m.id, 'edge-y2')} />
                     <Handle x={m.x1} y={(m.y1 + m.y2) / 2} cursor="ew-resize" config={config} onMouseDown={(e) => handleHandleMouseDown(e, m.id, 'edge-x1')} />
                     <Handle x={m.x2} y={(m.y1 + m.y2) / 2} cursor="ew-resize" config={config} onMouseDown={(e) => handleHandleMouseDown(e, m.id, 'edge-x2')} />
                   </React.Fragment>
                 );
               }

               const isStartActive = selectedHandle?.id === m.id && selectedHandle?.type === 'start';
               const isEndActive = selectedHandle?.id === m.id && selectedHandle?.type === 'end';

               return (
                 <React.Fragment key={m.id}>
                   <Handle 
                     x={m.x1} y={m.y1} 
                     cursor="pointer" 
                     config={config} 
                     onMouseDown={(e) => handleHandleMouseDown(e, m.id, 'start')} 
                     isActive={isStartActive}
                   />
                   <Handle 
                     x={m.x2} y={m.y2} 
                     cursor="pointer" 
                     config={config} 
                     onMouseDown={(e) => handleHandleMouseDown(e, m.id, 'end')} 
                     isActive={isEndActive}
                   />
                 </React.Fragment>
               );
            })}

            {/* Draggable Symbols */}
            {elements.map(el => (
              <CanvasItem
                key={el.id}
                item={el}
                isSelected={selectedId === el.id}
                onMouseDown={handleSymbolMouseDown}
                onTextChange={handleTextChange}
                config={config}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}