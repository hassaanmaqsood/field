import { Bounds } from '../protocol/Field';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FieldDef {
  preset?: string;
  expr?: string;
  domain: Bounds[];
  rankOut: number[];
}

export type OpKind =
  | 'gradient' | 'divergence' | 'curl' | 'laplacian'
  | 'combine' | 'bake' | 'slice' | 'rotate2D' | 'mirror' | 'guarded';

export interface OpStep {
  kind: OpKind;
  with?: string;
  op?: string;
  res?: number;
  axis?: number;
  value?: number;
  angle?: number;
  a0?: number;
  a1?: number;
}

export type ViewKind =
  | 'iso' | 'volume' | 'glyphs' | 'streamlines' | 'slice'
  | 'density' | 'bands' | 'isolines'
  | 'height' | 'terraces' | 'shells'
  | 'ascii';

export interface ViewLayer {
  kind: ViewKind;
  level?: number;
  color?: string;
  opacity?: number;
  cmap?: string;
  count?: number;
  scale?: string | number;
  seeds?: number;
  steps?: number;
  tube?: number;
  axis?: 'x' | 'y' | 'z';
  value?: number;

  // New fields for discrete containers:
  res?: number;          // sampling resolution
  tiers?: number;        // halftone tier count (default 20)
  cellSize?: number;     // halftone cell spacing
  heightScale?: number;  // height field / terraces vertical scale
  shells?: number[];     // isosurface shell levels
  cols?: number;         // ascii columns
  rows?: number;         // ascii rows
  fps?: number;          // ascii target fps
}

export interface SampleDef {
  box: Bounds[];
  res: number;
}

export interface FieldPipeline {
  field: FieldDef;
  ops: OpStep[];
  view: ViewLayer[];
}

export interface ParsedConfig {
  pipelines: FieldPipeline[];
  sample: SampleDef;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const DEFAULT_BOX3: Bounds[] = [
  { min: -4, max: 4 },
  { min: -4, max: 4 },
  { min: -4, max: 4 },
];

function stripComments(s: string): string {
  return s.replace(/#[^\n]*/g, '');
}

function extractBlock(s: string, name: string): string | null {
  const re = new RegExp('(?:^|\\s)' + name + '\\s*\\{', 'gm');
  let match;
  let blocks: string[] = [];
  while ((match = re.exec(s)) !== null) {
    const braceStart = s.indexOf('{', match.index + match[0].length - 1);
    let depth = 0;
    for (let i = braceStart; i < s.length; i++) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') { 
        depth--; 
        if (depth === 0) {
          blocks.push(s.slice(braceStart + 1, i).trim());
          break;
        }
      }
    }
  }
  return blocks.length > 0 ? blocks.join('\n') : null;
}

function parseDomainSpec(spec: string): Bounds[] {
  const result: Bounds[] = [];
  const re = /[xyzw]\[(-?\d*\.?\d+)\s*:\s*(-?\d*\.?\d+)\]/g;
  let m;
  while ((m = re.exec(spec)) !== null) {
    result.push({ min: parseFloat(m[1]), max: parseFloat(m[2]) });
  }
  return result.length > 0 ? result : DEFAULT_BOX3.slice();
}

function parseInlineKV(inner: string): Record<string, string> {
  const result: Record<string, string> = {};
  const exprMatch = /expr\s*:\s*(.+)$/m.exec(inner);
  if (exprMatch) {
    result['expr'] = exprMatch[1].trim();
    inner = inner.slice(0, exprMatch.index) + inner.slice(exprMatch.index + exprMatch[0].length);
  }
  const kvRe = /(\w+)\s*:\s*(.*?)(?=\s+\w+\s*:|$)/gs;
  let kv;
  while ((kv = kvRe.exec(inner)) !== null) {
    result[kv[1]] = kv[2].trim();
  }
  return result;
}

function extractInlineBlocks(text: string): { name: string; kv: Record<string, string>; pos: number; end: number }[] {
  const result: { name: string; kv: Record<string, string>; pos: number; end: number }[] = [];
  let i = 0;
  while (i < text.length) {
    const wordMatch = /(\w+)\s*\{/.exec(text.slice(i));
    if (!wordMatch) break;
    const start = i + wordMatch.index;
    const braceOpen = text.indexOf('{', start);
    let depth = 0;
    let end = braceOpen;
    for (let j = braceOpen; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    const inner = text.slice(braceOpen + 1, end);
    result.push({ name: wordMatch[1], kv: parseInlineKV(inner), pos: start, end: end + 1 });
    i = end + 1;
  }
  return result;
}

// ── Section parsers ────────────────────────────────────────────────────────

function parseFieldBlock(raw: string): FieldDef {
  const kv = parseInlineKV(raw);
  const domain = kv['domain'] ? parseDomainSpec(kv['domain']) : DEFAULT_BOX3.slice();
  const rankOut: number[] = [];
  if (kv['rankOut']) {
    const m = /\[([^\]]+)\]/.exec(kv['rankOut']);
    if (m) rankOut.push(...m[1].split(',').map(Number).filter(n => !isNaN(n)));
  }
  return { preset: kv['preset'], expr: kv['expr'], domain, rankOut };
}

const OP_KEYWORDS = ['gradient', 'divergence', 'curl', 'laplacian', 'guarded'] as const;

function parseOpsBlock(raw: string): OpStep[] {
  const steps: OpStep[] = [];
  const blocks = extractInlineBlocks(raw);
  const occupied = new Set<number>();

  for (const { name, kv, pos, end } of blocks) {
    const step: OpStep = { kind: name as OpKind };
    if (kv['with'])   step.with  = kv['with'];
    if (kv['op'])     step.op    = kv['op'];
    if (kv['res'])    step.res   = parseInt(kv['res']);
    if (kv['axis'] !== undefined) step.axis = 'xyzw'.indexOf(kv['axis']);
    if (kv['value'] !== undefined) step.value = parseFloat(kv['value']);
    if (kv['angle'] !== undefined) step.angle = parseFloat(kv['angle']);
    if (kv['a0'] !== undefined) step.a0 = parseInt(kv['a0']);
    if (kv['a1'] !== undefined) step.a1 = parseInt(kv['a1']);
    steps.push(step);
    for (let i = pos; i < end; i++) occupied.add(i);
  }

  const lines = raw.split('\n');
  let offset = 0;
  for (const line of lines) {
    const lineStart = raw.indexOf(line, offset);
    offset = lineStart + line.length + 1;
    const trimmed = line.trim();
    if (!trimmed) continue;
    if ([...occupied].some(p => p >= lineStart && p < lineStart + line.length)) continue;
    for (const kw of OP_KEYWORDS) {
      if (trimmed === kw) { steps.push({ kind: kw }); break; }
    }
  }
  return steps;
}

function parseViewBlock(raw: string): ViewLayer[] {
  const layers: ViewLayer[] = [];
  for (const { name, kv } of extractInlineBlocks(raw)) {
    const layer: ViewLayer = { kind: name as ViewKind };
    if (kv['level']   !== undefined) layer.level   = parseFloat(kv['level']);
    if (kv['color'])                  layer.color   = kv['color'];
    if (kv['opacity'] !== undefined)  layer.opacity = parseFloat(kv['opacity']);
    if (kv['cmap'])                   layer.cmap    = kv['cmap'];
    if (kv['count']   !== undefined)  layer.count   = parseInt(kv['count']);
    if (kv['scale']   !== undefined)  layer.scale   = kv['scale'] === 'auto' ? 'auto' : parseFloat(kv['scale']);
    if (kv['seeds']   !== undefined)  layer.seeds   = parseInt(kv['seeds']);
    if (kv['steps']   !== undefined)  layer.steps   = parseInt(kv['steps']);
    if (kv['tube']    !== undefined)  layer.tube    = parseFloat(kv['tube']);
    if (kv['axis'])                   layer.axis    = kv['axis'] as 'x' | 'y' | 'z';
    if (kv['value']   !== undefined)  layer.value   = parseFloat(kv['value']);

    // Discrete token view parameters
    if (kv['res'])                    layer.res     = parseInt(kv['res']);
    if (kv['cellSize'])               layer.cellSize= parseInt(kv['cellSize']);
    if (kv['tiers'])                  layer.tiers   = parseInt(kv['tiers']);
    if (kv['heightScale'])            layer.heightScale = parseFloat(kv['heightScale']);
    if (kv['cols'])                   layer.cols    = parseInt(kv['cols']);
    if (kv['rows'])                   layer.rows    = parseInt(kv['rows']);
    if (kv['fps'])                    layer.fps     = parseInt(kv['fps']);
    if (kv['shells']) {
      const clean = kv['shells'].replace(/[\[\]]/g, '');
      layer.shells = clean.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    }

    layers.push(layer);
  }
  return layers;
}

function parseSampleBlock(raw: string): SampleDef {
  const kv = parseInlineKV(raw);
  const box = kv['box'] ? parseDomainSpec(kv['box']) : DEFAULT_BOX3.slice();
  const res = kv['res'] ? parseInt(kv['res']) : 48;
  return { box, res };
}

// ── Public API ─────────────────────────────────────────────────────────────

export const DEFAULT_CODE = `field {
  expr:   sqrt(x*x + y*y + z*z) - 1.8
  domain: x[-4:4] y[-4:4] z[-4:4]
}

ops {
}

view {
  shells { shells: [-0.4, 0.0, 0.4] }
}

sample {
  box: x[-4:4] y[-4:4] z[-4:4]
  res: 48
}`;

export function parseConfig(source: string): ParsedConfig {
  const clean = stripComments(source);
  
  const pipelines: FieldPipeline[] = [];
  const fieldRegex = /(?:^|\s)field\s*\{/gm;
  const indices: number[] = [];
  
  let match;
  while ((match = fieldRegex.exec(clean)) !== null) {
    indices.push(match.index);
  }
  
  if (indices.length === 0) {
    // Fallback: parse as single implicitly
    pipelines.push({
      field: parseFieldBlock(extractBlock(clean, 'field') ?? ''),
      ops: parseOpsBlock(extractBlock(clean, 'ops') ?? ''),
      view: parseViewBlock(extractBlock(clean, 'view') ?? '')
    });
  } else {
    for (let i = 0; i < indices.length; i++) {
      const start = indices[i];
      const end = i + 1 < indices.length ? indices[i + 1] : clean.length;
      const segment = clean.slice(start, end);
      pipelines.push({
        field: parseFieldBlock(extractBlock(segment, 'field') ?? ''),
        ops: parseOpsBlock(extractBlock(segment, 'ops') ?? ''),
        view: parseViewBlock(extractBlock(segment, 'view') ?? '')
      });
    }
  }

  return {
    pipelines,
    sample: parseSampleBlock(extractBlock(clean, 'sample') ?? ''),
  };
}
