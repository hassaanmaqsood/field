import { EditorState, Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  dropCursor,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  StreamLanguage,
  StringStream,
  bracketMatching,
  syntaxHighlighting,
  HighlightStyle,
} from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import {
  autocompletion,
  CompletionContext,
  CompletionResult,
  snippetCompletion,
  closeBrackets,
  closeBracketsKeymap,
} from '@codemirror/autocomplete';

// ── Custom Academic Highlight Style ──────────────────────────────────────────
const academicHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#854D0E', fontWeight: '600' },          // amber-800 for block headers (field, ops, view, sample)
  { tag: t.definitionKeyword, color: '#1D4ED8', fontWeight: '600' },// blue-700
  { tag: t.propertyName, color: '#0F766E', fontWeight: '500' },     // teal-700 for property keys
  { tag: t.string, color: '#15803D' },                              // green-700
  { tag: t.number, color: '#B45309' },                              // amber-700
  { tag: t.operator, color: '#4B5563' },                            // gray-600
  { tag: t.comment, color: '#9CA3AF', fontStyle: 'italic' },        // gray-400
  { tag: t.bracket, color: '#374151' },                             // gray-700
  { tag: t.standard(t.variableName), color: '#6D28D9' },            // purple-700 for presets & ops
]);

// ── Field Syntax Stream Lexer ────────────────────────────────────────────────
const TOP_BLOCKS = new Set(['field', 'ops', 'view', 'sample']);
const KEYWORDS = new Set([
  'preset', 'expr', 'domain', 'rankOut',
  'gradient', 'divergence', 'curl', 'laplacian',
  'combine', 'bake', 'slice', 'fit',
  'iso', 'glyphs', 'streamlines', 'volume',
  'with', 'op', 'res', 'axis', 'value',
  'level', 'color', 'opacity', 'count', 'scale', 'cmap', 'seeds', 'steps', 'tube', 'box',
]);
const PRESETS = new Set([
  'radial', 'vortex', 'dipole', 'saddle', 'rotor4d', 'stressTensor',
  'add', 'subtract', 'min', 'max', 'smoothMin', 'dot',
  'viridis', 'coolwarm', 'plasma', 'gray',
]);
const MATH_FUNCS = new Set([
  'sin', 'cos', 'tan', 'sqrt', 'exp', 'log', 'pow', 'abs', 'norm',
  'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh',
]);

const fieldLanguage = StreamLanguage.define<{ inComment: boolean }>({
  startState() {
    return { inComment: false };
  },
  token(stream: StringStream) {
    if (stream.eatSpace()) return null;

    // Comments: # or //
    if (stream.match('#') || stream.match('//')) {
      stream.skipToEnd();
      return 'comment';
    }

    // Strings
    if (stream.match(/^"([^"\\]|\\.)*"/)) return 'string';
    if (stream.match(/^'([^'\\]|\\.)*'/)) return 'string';

    // Numbers (including scientific & negative in expr)
    if (stream.match(/^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?/)) {
      return 'number';
    }

    // Color hex: #1D4ED8
    if (stream.match(/^#[0-9a-fA-F]{3,8}/)) {
      return 'string';
    }

    // Brackets & delimiters
    if (stream.match(/^[{}[\](),:]/)) {
      return 'bracket';
    }

    // Operators
    if (stream.match(/^[+\-*/^=<>!&|]+/)) {
      return 'operator';
    }

    // Word identifiers
    const match = stream.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (match) {
      const word = Array.isArray(match) ? match[0] : stream.current();
      if (TOP_BLOCKS.has(word)) return 'keyword';
      if (KEYWORDS.has(word)) return 'propertyName';
      if (PRESETS.has(word)) return 'standard(variableName)';
      if (MATH_FUNCS.has(word)) return 'definitionKeyword';
      return 'variableName';
    }

    stream.next();
    return null;
  },
});

// ── Autocomplete Source ──────────────────────────────────────────────────────
const COMPLETIONS = [
  // Top-level blocks
  snippetCompletion('field {\n  preset: ${1:radial}\n}', {
    label: 'field (preset)',
    detail: 'Field block with preset',
    type: 'keyword',
    boost: 90,
  }),
  snippetCompletion('field {\n  expr: "${1:sin(x)*cos(y)}"\n}', {
    label: 'field (expr)',
    detail: 'Field block with math expression',
    type: 'keyword',
    boost: 90,
  }),
  snippetCompletion('ops {\n  ${1:gradient}\n}', {
    label: 'ops',
    detail: 'Differential / algebraic operations block',
    type: 'keyword',
    boost: 85,
  }),
  snippetCompletion('view {\n  iso { level: ${1:0.0} color: ${2:#1D4ED8} opacity: ${3:0.9} }\n}', {
    label: 'view (iso)',
    detail: 'View block with isosurface',
    type: 'keyword',
    boost: 85,
  }),
  snippetCompletion('view {\n  streamlines { seeds: ${1:48} steps: ${2:150} cmap: ${3:viridis} }\n}', {
    label: 'view (streamlines)',
    detail: 'View block with streamlines',
    type: 'keyword',
    boost: 85,
  }),
  snippetCompletion('sample {\n  res: ${1:48}\n  box: x[${2:-4:4}] y[${3:-4:4}] z[${4:-4:4}]\n}', {
    label: 'sample',
    detail: 'Sampling resolution & box domain',
    type: 'keyword',
    boost: 80,
  }),

  // Field keys
  snippetCompletion('preset: ${1:radial}', { label: 'preset:', detail: 'Analytic preset', type: 'property', boost: 70 }),
  snippetCompletion('expr: "${1:norm([x,y,z]) - 2.0}"', { label: 'expr:', detail: 'Scalar or vector expression', type: 'property', boost: 70 }),
  snippetCompletion('domain: x[${1:-4:4}] y[${2:-4:4}] z[${3:-4:4}]', { label: 'domain:', detail: 'Field domain bounds', type: 'property', boost: 65 }),
  snippetCompletion('rankOut: [${1:3}]', { label: 'rankOut:', detail: 'Output tensor rank [3] or [3,3]', type: 'property', boost: 60 }),

  // Presets
  { label: 'radial', detail: 'Scalar: concentric spherical shells', type: 'variable', boost: 60 },
  { label: 'vortex', detail: 'Vector: 3D rotational whirlpool [-y, x, 0.2*z]', type: 'variable', boost: 60 },
  { label: 'dipole', detail: 'Scalar: two opposing electrostatic poles', type: 'variable', boost: 60 },
  { label: 'saddle', detail: 'Scalar: hyperbolic saddle x² - y² + 0.5z²', type: 'variable', boost: 60 },
  { label: 'rotor4d', detail: 'Scalar: stereographic projection of 4D Hopf torus', type: 'variable', boost: 60 },
  { label: 'stressTensor', detail: 'Rank-2 Tensor: 3x3 symmetric stress state', type: 'variable', boost: 60 },

  // Differential Operators
  { label: 'gradient', detail: '∇f: vector field of steepest ascent', type: 'function', boost: 75 },
  { label: 'divergence', detail: '∇·F: scalar flux expansion / compression', type: 'function', boost: 75 },
  { label: 'curl', detail: '∇×F: vector field of local rotation', type: 'function', boost: 75 },
  { label: 'laplacian', detail: '∇²f: scalar diffusion / curvature rate', type: 'function', boost: 75 },

  // Ops snippets
  snippetCompletion('combine { with: ${1:dipole} op: ${2:add} }', {
    label: 'combine',
    detail: 'Algebraic field combination (add, subtract, min, max, smoothMin, dot)',
    type: 'class',
    boost: 70,
  }),
  snippetCompletion('bake { res: ${1:24} }', {
    label: 'bake',
    detail: 'Pre-evaluate field onto a discrete 3D voxel grid',
    type: 'class',
    boost: 70,
  }),
  snippetCompletion('slice { axis: ${1:z} value: ${2:0.0} }', {
    label: 'slice (op)',
    detail: 'Slice 3D field to 2D hyperplane',
    type: 'class',
    boost: 70,
  }),

  // View layers
  snippetCompletion('iso { level: ${1:0.0} color: ${2:#1D4ED8} opacity: ${3:0.9} }', {
    label: 'iso',
    detail: 'Raymarched implicit isosurface f(x,y,z) = level',
    type: 'class',
    boost: 75,
  }),
  snippetCompletion('glyphs { count: ${1:8} scale: ${2:auto} cmap: ${3:viridis} }', {
    label: 'glyphs',
    detail: 'Vector arrows or tensor ellipsoids',
    type: 'class',
    boost: 75,
  }),
  snippetCompletion('streamlines { seeds: ${1:48} steps: ${2:150} cmap: ${3:viridis} }', {
    label: 'streamlines',
    detail: 'RK4 flow trajectories through vector field',
    type: 'class',
    boost: 75,
  }),
  snippetCompletion('slice { axis: ${1:z} value: ${2:0.0} cmap: ${3:viridis} }', {
    label: 'slice (view)',
    detail: 'Colormapped cross-sectional planar cut',
    type: 'class',
    boost: 75,
  }),
  snippetCompletion('volume { cmap: ${1:viridis} opacity: ${2:0.8} }', {
    label: 'volume',
    detail: 'Direct volume ray-casting density preview',
    type: 'class',
    boost: 70,
  }),

  // Colormaps
  { label: 'viridis', detail: 'Colormap: Perceptually uniform blue-green-yellow', type: 'constant' },
  { label: 'coolwarm', detail: 'Colormap: Diverging blue-white-red', type: 'constant' },
  { label: 'plasma', detail: 'Colormap: High-contrast purple-orange-yellow', type: 'constant' },
  { label: 'gray', detail: 'Colormap: Monochromatic grayscale', type: 'constant' },

  // Combination Ops
  { label: 'add', detail: 'f₁ + f₂', type: 'operator' },
  { label: 'subtract', detail: 'f₁ - f₂', type: 'operator' },
  { label: 'min', detail: 'Boolean CSG intersection: min(f₁, f₂)', type: 'operator' },
  { label: 'max', detail: 'Boolean CSG union: max(f₁, f₂)', type: 'operator' },
  { label: 'smoothMin', detail: 'Polynomial smooth union: smin(f₁, f₂)', type: 'operator' },
  { label: 'dot', detail: 'Inner product: F₁ · F₂', type: 'operator' },

  // Math Functions in expressions
  { label: 'sin', detail: 'sin(x)', type: 'function' },
  { label: 'cos', detail: 'cos(x)', type: 'function' },
  { label: 'tan', detail: 'tan(x)', type: 'function' },
  { label: 'sqrt', detail: 'sqrt(x)', type: 'function' },
  { label: 'exp', detail: 'exp(x)', type: 'function' },
  { label: 'log', detail: 'log(x) natural log', type: 'function' },
  { label: 'pow', detail: 'pow(base, exp)', type: 'function' },
  { label: 'abs', detail: 'abs(x)', type: 'function' },
  { label: 'norm', detail: 'norm([x,y,z]) Euclidean length', type: 'function' },
];

function fieldCompletions(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[a-zA-Z_0-9#:]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  return {
    from: word.from,
    options: COMPLETIONS,
    validFor: /^[a-zA-Z_0-9#:]*$/,
  };
}

// ── Academic CodeMirror Theme ────────────────────────────────────────────────
const academicTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontFamily: "var(--f-mono, 'JetBrains Mono', 'Fira Code', monospace)",
    fontSize: '12px',
    backgroundColor: '#FFFFFF',
    color: '#1A1714',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: "inherit",
    lineHeight: '1.65',
    padding: '4px 0',
  },
  '.cm-content': {
    caretColor: '#1D4ED8',
    padding: '4px 10px',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: '#1D4ED8',
    borderLeftWidth: '2px',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
    backgroundColor: 'rgba(29, 78, 216, 0.15) !important',
  },
  '.cm-gutters': {
    backgroundColor: '#F8F6F2',
    color: '#9E9489',
    borderRight: '1px solid #E5E0D6',
    paddingRight: '6px',
    fontFamily: "var(--f-mono, monospace)",
    fontSize: '10.5px',
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#ECE7DD',
    color: '#1A1714',
    fontWeight: '600',
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(29, 78, 216, 0.035)',
  },
  // Autocomplete popup styling
  '.cm-tooltip-autocomplete': {
    border: '1px solid #D0C9BC',
    backgroundColor: '#FFFFFF',
    borderRadius: '6px',
    boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
    fontFamily: "var(--f-ui, 'Inter', sans-serif)",
    fontSize: '11.5px',
    overflow: 'hidden',
    zIndex: '200',
  },
  '.cm-tooltip-autocomplete ul': {
    padding: '4px',
    maxHeight: '220px',
  },
  '.cm-tooltip-autocomplete ul li': {
    padding: '4px 8px',
    borderRadius: '4px',
    lineHeight: '1.4',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: '#1D4ED8',
    color: '#FFFFFF',
  },
  '.cm-completionDetail': {
    fontStyle: 'normal',
    color: '#6B6259',
    fontSize: '10.5px',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected] .cm-completionDetail': {
    color: 'rgba(255,255,255,0.85)',
  },
  '.cm-completionLabel': {
    fontFamily: "var(--f-mono, monospace)",
    fontWeight: '500',
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: 'rgba(29, 78, 216, 0.2)',
    outline: '1px solid #1D4ED8',
    borderRadius: '2px',
  },
});

export interface FieldEditorHandle {
  view: EditorView;
  getValue: () => string;
  setValue: (code: string) => void;
  focus: () => void;
}

export function createFieldEditor(
  container: HTMLElement,
  initialCode: string,
  onRun?: (code: string) => void,
  onChange?: (code: string) => void,
): FieldEditorHandle {
  const runCommand = () => {
    if (onRun) {
      onRun(view.state.doc.toString());
      return true;
    }
    return false;
  };

  const keymaps: Extension = [
    keymap.of([
      { key: 'Mod-Enter', run: runCommand },
      indentWithTab,
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
    ]),
  ];

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged && onChange) {
      onChange(update.state.doc.toString());
    }
  });

  const state = EditorState.create({
    doc: initialCode,
    extensions: [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      history(),
      dropCursor(),
      bracketMatching(),
      closeBrackets(),
      autocompletion({
        override: [fieldCompletions],
        icons: true,
        activateOnTyping: true,
      }),
      fieldLanguage,
      syntaxHighlighting(academicHighlightStyle),
      academicTheme,
      keymaps,
      updateListener,
    ],
  });

  const view = new EditorView({
    state,
    parent: container,
  });

  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue: (newCode: string) => {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: newCode,
        },
      });
    },
    focus: () => view.focus(),
  };
}
