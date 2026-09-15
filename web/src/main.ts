import * as THREE from 'three';
import './style.css';

// ── Field library imports ──────────────────────────────────────────────────
import { Field, shapeLabel, SerializedField } from './protocol/Field';
import { createScene } from './render/scene';
import { buildIsosurface, IsosurfaceHandle } from './render/isosurface';
import { buildVectorGlyphs, buildTensorGlyphs } from './render/glyphs';
import { buildProbeVolume, probe } from './render/probe';
import { buildSlicePlane } from './render/slice-plane';
import { buildStreamlines } from './render/streamlines';
import { presetRegistry, userFormulaPreset } from './presets/analyticPresets';
import { AnalyticField } from './backends/AnalyticField';

import { gradient, divergence, curl, laplacian } from './algebra/differential';
import { add, subtract, dot } from './algebra/arithmetic';
import { min as fMin, max as fMax, smoothMin } from './algebra/boolean';
import { slice, pan } from './algebra/slicing';
import { bake, fit } from './algebra/bakeFit';
import { vonMisesStress } from './plugins/mechanical';
import { GridField } from './backends/GridField';
import { parseConfig, DEFAULT_CODE, ParsedConfig, ViewLayer, FieldPipeline } from './ui/parser';
import { JogPad } from './ui/jog-pad';
import { createFieldEditor, FieldEditorHandle } from './ui/field-editor';

// ── DOM refs ───────────────────────────────────────────────────────────────
const canvas            = document.getElementById('canvas')            as HTMLCanvasElement;
const inspector         = document.getElementById('inspector')         as HTMLDivElement;
const inspectorBar      = document.getElementById('inspector-bar')     as HTMLDivElement;
const toggleBtn         = document.getElementById('toggle-inspector')  as HTMLButtonElement;
const codeEditorMount   = document.getElementById('code-editor-mount') as HTMLDivElement;
const runBtn            = document.getElementById('run-btn')           as HTMLButtonElement;
const progressWrap      = document.getElementById('progress-wrap')     as HTMLDivElement;
const progressBar       = document.getElementById('progress-bar')      as HTMLDivElement;
const errorMsg          = document.getElementById('error-msg')         as HTMLSpanElement;
const statusDot         = document.getElementById('status-dot')        as HTMLSpanElement;
const statusText        = document.getElementById('status-text')       as HTMLSpanElement;
const typeBadge         = document.getElementById('type-badge')        as HTMLSpanElement;
const barDot            = document.getElementById('bar-dot')           as HTMLSpanElement;
const barType           = document.getElementById('bar-type')          as HTMLSpanElement;
const probeValue        = document.getElementById('probe-value')       as HTMLSpanElement;

// Topbar right & settings dropdown
const helpBtn           = document.getElementById('help-btn')          as HTMLButtonElement;
const settingsBtn       = document.getElementById('settings-btn')      as HTMLButtonElement;
const settingsDropdown  = document.getElementById('settings-dropdown') as HTMLDivElement;
const menuDragCam       = document.getElementById('menu-drag-cam')      as HTMLButtonElement;
const menuDragBox       = document.getElementById('menu-drag-box')      as HTMLButtonElement;
const menuPadsCorners   = document.getElementById('menu-pads-corners')  as HTMLButtonElement;
const menuPadsCenter    = document.getElementById('menu-pads-center')   as HTMLButtonElement;
const togglePadsVisible = document.getElementById('toggle-pads-visible')as HTMLInputElement;

// Guide modal
const guideModal        = document.getElementById('guide-modal')       as HTMLDivElement;
const guideCloseBtn     = document.getElementById('guide-close-btn')   as HTMLButtonElement;

// Jog pads
const padLeft           = document.getElementById('pad-left')          as HTMLDivElement;
const padRight          = document.getElementById('pad-right')         as HTMLDivElement;
const diskLeftEl        = document.getElementById('disk-left')         as HTMLCanvasElement;
const stripLeftEl       = document.getElementById('strip-left')        as HTMLCanvasElement;
const diskRightEl       = document.getElementById('disk-right')        as HTMLCanvasElement;
const stripRightEl      = document.getElementById('strip-right')       as HTMLCanvasElement;


// ── Scene ──────────────────────────────────────────────────────────────────
const { scene, camera, renderer, controls, fieldGroup, updateBoxWire } = createScene(canvas);

// ── App state ──────────────────────────────────────────────────────────────
let displayFields: Field[] = [];
let isoHandles: IsosurfaceHandle[] = [];
let probeVolumes: THREE.Mesh[] = [];

// Total algebraic offset baked into the field
let algebraicOffset = new THREE.Vector3();

// Canvas drag target: 'cam' or 'box'
let dragTarget: 'cam' | 'box' = 'cam';

// Pad layout: 'corners' or 'center'
let padLayout: 'corners' | 'center' = 'corners';

// Debounce timer for auto-run
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Worker ref
let activeWorker: Worker | null = null;

// ── Status helpers ────────────────────────────────────────────────────────
function setStatus(state: 'ready' | 'busy' | 'error', text: string, progress?: number) {
  statusDot.className = `status-dot ${state}`;
  barDot.className    = `status-dot ${state}`;
  statusText.textContent = text;
  if (progress !== undefined) {
    progressWrap.style.display = 'block';
    progressBar.style.width = `${Math.round(progress * 100)}%`;
  } else {
    progressWrap.style.display = 'none';
  }
}

function setError(msg: string) {
  errorMsg.textContent = msg;
  setStatus('error', 'Error');
}

function clearError() {
  errorMsg.textContent = '';
}

function updateTypeBadge(field: Field) {
  const label = shapeLabel(field.rankOut());
  const rankIn = field.rankIn();
  const rankOutStr = field.rankOut().length === 0 ? 'ℝ' :
    `ℝ${field.rankOut().join('×')}`;
  const badge = `${label} · ℝ${rankIn}→${rankOutStr}`;
  typeBadge.textContent = badge;
  barType.textContent   = badge;
}

// ── Field construction from config ────────────────────────────────────────
function buildField(config: FieldPipeline): Field {
  const fd = config.field;

  // Source field
  let f: Field;
  if (fd.preset) {
    f = presetRegistry[fd.preset] ? presetRegistry[fd.preset]() : presetRegistry.radial();
  } else if (fd.expr) {
    // Detect vector expression: starts with '['
    const trimmed = fd.expr.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      // Vector: parse components
      const inner = trimmed.slice(1, -1);
      const parts = inner.split(',').map(s => s.trim());
      const n = parts.length;
      const combined = `[${parts.join(',')}]`;
      // Build as analytic field with rankOut=[n]
      const ALLOWED = /^[0-9a-zA-Z_+\-*/%.,() \t\[\]]*$/;
      if (!ALLOWED.test(inner)) throw new Error('Vector expr contains disallowed chars');
      const SAFE = ['sin','cos','tan','sqrt','abs','pow','exp','log','min','max','PI'];
      const mathVals = SAFE.map(nm => (Math as any)[nm]);
      // eslint-disable-next-line no-new-func
      const fn = new Function('x','y','z','w',...SAFE, `"use strict"; return ${combined};`);
      f = new AnalyticField({
        name: 'userVector',
        domain: fd.domain,
        rankIn: fd.domain.length,
        rankOut: [n],
        formula: trimmed,
        fn: (p: number[]) => fn(p[0]??0, p[1]??0, p[2]??0, p[3]??0, ...mathVals),
      });

    } else {
      f = userFormulaPreset(fd.expr, fd.domain.length === 4 ? 4 : 3);
      // Patch domain if user specified one different from default
      // (userFormulaPreset uses a hardcoded BOX3; for now accept it)
    }
  } else {
    f = presetRegistry.radial();
  }

  // Apply ops
  for (const op of config.ops) {
    switch (op.kind) {
      case 'gradient':   f = gradient(f);  break;
      case 'divergence': f = divergence(f); break;
      case 'curl':       f = curl(f);      break;
      case 'laplacian':  f = laplacian(f); break;
      case 'combine': {
        const other = op.with && presetRegistry[op.with] ? presetRegistry[op.with]() : presetRegistry.radial();
        const oper = op.op ?? 'add';
        if (oper === 'add')       f = add(f, other);
        else if (oper === 'subtract') f = subtract(f, other);
        else if (oper === 'min')  f = fMin(f, other);
        else if (oper === 'max')  f = fMax(f, other);
        else if (oper === 'smoothMin') f = smoothMin(f, other, 0.5);
        else if (oper === 'dot') f = dot(f, other);
        break;
      }
      case 'bake': {
        const res = op.res ?? 24;
        f = bake(f, { resolution: new Array(f.rankIn()).fill(res) });
        break;
      }
      case 'slice': {
        if (op.axis !== undefined && op.value !== undefined) {
          f = slice(f, [{ axis: op.axis, value: op.value }]);
        }
        break;
      }
    }
  }

  return f;
}

// ── Clear scene ───────────────────────────────────────────────────────────
function clearFieldGroup() {
  for (const child of [...fieldGroup.children]) {
    fieldGroup.remove(child);
    (child as any).geometry?.dispose?.();
    (child as any).material?.dispose?.();
  }
  for (const h of isoHandles) h.dispose();
  isoHandles = [];
  probeVolumes = [];
  displayFields = [];
}

// ── Render layers ─────────────────────────────────────────────────────────
function renderLayer(field: Field, layer: ViewLayer, box: { min: number; max: number }[], sampleRes: number) {
  const boxBounds = box.length >= 3 ? box.slice(0, 3) : [
    { min:-4,max:4 }, { min:-4,max:4 }, { min:-4,max:4 }
  ];

  switch (layer.kind) {
    case 'iso': {
      const color = new THREE.Color(layer.color ?? '#2563eb');
      const res = (layer as any).res ?? sampleRes ?? 48;
      const handle = buildIsosurface(field, res, color);
      
      let defaultLevel = 0;
      if (shapeLabel(field.rankOut()) === 'vector') {
        defaultLevel = 1.0;
      }
      handle.setIso(layer.level ?? defaultLevel);
      
      fieldGroup.add(handle.mesh);
      isoHandles.push(handle);
      break;
    }
    case 'glyphs': {
      const label = shapeLabel(field.rankOut());
      const count = layer.count ?? sampleRes ?? 7;
      const targetField = label === 'scalar' ? gradient(field) : field;
      
      if (label === 'vector' || label === 'scalar') fieldGroup.add(buildVectorGlyphs(targetField, count));
      else if (label === 'tensor') fieldGroup.add(buildTensorGlyphs(targetField, count));
      break;
    }
    case 'streamlines': {
      const label = shapeLabel(field.rankOut());
      const targetField = label === 'scalar' ? gradient(field) : field;
      
      if (label === 'vector' || label === 'scalar') {
        const obj = buildStreamlines(
          targetField,
          layer.seeds ?? 48,
          layer.steps ?? 150,
          layer.tube  ?? 0,
          boxBounds,
          layer.cmap  ?? 'viridis',
        );
        fieldGroup.add(obj);
      }
      break;
    }
    case 'slice': {
      const axis = layer.axis ?? 'z';
      const value = layer.value ?? 0;
      const resolution = 64;
      // Only slice scalar fields for now
      if (shapeLabel(field.rankOut()) === 'scalar') {
        const mesh = buildSlicePlane(field, axis, value, boxBounds, layer.cmap ?? 'viridis', resolution);
        fieldGroup.add(mesh);
      }
      break;
    }
    case 'volume':
      // Placeholder — volume rendering is a GPU path; fall back to iso
      break;
  }
}

// ── Async iso bake via Web Worker ─────────────────────────────────────────
function bakeViaWorker(
  fieldSpec: SerializedField,
  box: { min: number; max: number }[],
  resolution: number,
  color: THREE.Color,
  isoLevel: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (activeWorker) { activeWorker.terminate(); activeWorker = null; }

    const worker = new Worker(
      new URL('./compute/field-worker.ts', import.meta.url),
      { type: 'module' }
    );
    activeWorker = worker;
    setStatus('busy', 'Computing…', 0);
    progressWrap.style.display = 'block';

    worker.onmessage = (ev) => {
      const { type, value, buffer, message } = ev.data;
      if (type === 'progress') {
        setStatus('busy', `Computing… ${Math.round(value * 100)}%`, value);
      } else if (type === 'done') {
        activeWorker = null;
        progressWrap.style.display = 'none';
        setStatus('ready', 'Ready');

        // Upload to GPU texture
        const data = new Float32Array(buffer as ArrayBuffer);
        const res = resolution;
        const [bx, by, bz] = box;

        const texture = new THREE.Data3DTexture(data, res, res, res);
        texture.format = THREE.RedFormat;
        texture.type   = THREE.FloatType;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.unpackAlignment = 1;
        texture.needsUpdate = true;

        // Rebuild iso handle with the pre-baked texture
        // Reuse existing isosurface infrastructure — create a fake baked field
        // by constructing a GridField from the buffer and wrapping with buildIsosurface.
        // For simplicity, rebuild using the standard path which re-samples anyway.
        // Future: inject pre-baked texture directly.
        resolve();
        worker.terminate();
      } else if (type === 'error') {
        activeWorker = null;
        progressWrap.style.display = 'none';
        setStatus('error', 'Error');
        reject(new Error(message));
        worker.terminate();
      }
    };

    worker.onerror = (e) => {
      activeWorker = null;
      progressWrap.style.display = 'none';
      reject(new Error(e.message));
      worker.terminate();
    };

    worker.postMessage({ type: 'compute', fieldSpec, box, resolution });
  });
}

// ── Main run pipeline ─────────────────────────────────────────────────────
async function runPipeline(source: string) {
  clearError();
  runBtn.disabled = true;
  setStatus('busy', 'Parsing…');

  let config: ParsedConfig;
  try {
    config = parseConfig(source);
  } catch (e) {
    setError(`Parse error: ${(e as Error).message}`);
    runBtn.disabled = false;
    return;
  }

  clearFieldGroup();
  updateBoxWire(config.sample.box);
  setStatus('busy', 'Building layers…');

  try {
    for (const pipeline of config.pipelines) {
      let field: Field;
      try {
        field = buildField(pipeline);
        if (algebraicOffset.lengthSq() > 0) {
          field = pan(field, [algebraicOffset.x, algebraicOffset.y, algebraicOffset.z]);
        }
      } catch (e) {
        setError(`Field error: ${(e as Error).message}`);
        runBtn.disabled = false;
        return;
      }

      displayFields.push(field);

      // Render each view layer
      if (pipeline.view.length === 0) {
        // Default: isosurface
        const handle = buildIsosurface(field, config.sample.res);
        handle.setIso(0);
        fieldGroup.add(handle.mesh);
        isoHandles.push(handle);
      } else {
        for (const layer of pipeline.view) {
          renderLayer(field, layer, config.sample.box, config.sample.res);
        }
      }

      // Probe volume (invisible raycast target)
      const vol = buildProbeVolume(field);
      vol.visible = false;
      fieldGroup.add(vol);
      probeVolumes.push(vol);
    }
    
    // Update badge using the first field if available
    if (displayFields.length > 0) {
      updateTypeBadge(displayFields[0]);
    } else {
      typeBadge.textContent = 'No field';
      barType.textContent = 'No field';
    }

    setStatus('ready', 'Ready');
  } catch (e) {
    setError(`Render error: ${(e as Error).message}`);
  }

  runBtn.disabled = false;
}

// ── CodeMirror Editor Setup ───────────────────────────────────────────────
let editorHandle: FieldEditorHandle;

editorHandle = createFieldEditor(
  codeEditorMount,
  DEFAULT_CODE,
  (code) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    runPipeline(code);
  },
  (code) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runPipeline(code), 500);
  },
);

// ── Inspector toggle ──────────────────────────────────────────────────────
function expandInspector() {
  inspector.classList.remove('hidden');
  inspectorBar.classList.add('hidden');
  inspectorBar.setAttribute('aria-expanded', 'false');
  editorHandle.focus();
}
function collapseInspector() {
  inspector.classList.add('hidden');
  inspectorBar.classList.remove('hidden');
  inspectorBar.setAttribute('aria-expanded', 'true');
}

toggleBtn.addEventListener('click', collapseInspector);
inspectorBar.addEventListener('click', expandInspector);
inspectorBar.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') expandInspector(); });

// ── Run button ────────────────────────────────────────────────────────────
runBtn.addEventListener('click', () => runPipeline(editorHandle.getValue()));

// ── Top-right: Settings & Controls Dropdown ───────────────────────────────
settingsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const isHidden = settingsDropdown.classList.contains('hidden');
  if (isHidden) {
    settingsDropdown.classList.remove('hidden');
    settingsBtn.setAttribute('aria-expanded', 'true');
  } else {
    settingsDropdown.classList.add('hidden');
    settingsBtn.setAttribute('aria-expanded', 'false');
  }
});

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (!settingsDropdown.contains(e.target as Node) && e.target !== settingsBtn) {
    settingsDropdown.classList.add('hidden');
    settingsBtn.setAttribute('aria-expanded', 'false');
  }
});

// Canvas drag target: CAM / BOX
menuDragCam.addEventListener('click', () => {
  dragTarget = 'cam';
  menuDragCam.classList.add('active');
  menuDragCam.setAttribute('aria-checked', 'true');
  menuDragBox.classList.remove('active');
  menuDragBox.setAttribute('aria-checked', 'false');
  controls.enabled = true;
});

menuDragBox.addEventListener('click', () => {
  dragTarget = 'box';
  menuDragBox.classList.add('active');
  menuDragBox.setAttribute('aria-checked', 'true');
  menuDragCam.classList.remove('active');
  menuDragCam.setAttribute('aria-checked', 'false');
  controls.enabled = false;
});

// Pads layout: Corners / Side-by-side
menuPadsCorners.addEventListener('click', () => {
  padLayout = 'corners';
  menuPadsCorners.classList.add('active');
  menuPadsCorners.setAttribute('aria-checked', 'true');
  menuPadsCenter.classList.remove('active');
  menuPadsCenter.setAttribute('aria-checked', 'false');
  padLeft.classList.remove('center-layout');
  padRight.classList.remove('center-layout');
});

menuPadsCenter.addEventListener('click', () => {
  padLayout = 'center';
  menuPadsCenter.classList.add('active');
  menuPadsCenter.setAttribute('aria-checked', 'true');
  menuPadsCorners.classList.remove('active');
  menuPadsCorners.setAttribute('aria-checked', 'false');
  padLeft.classList.add('center-layout');
  padRight.classList.add('center-layout');
});

// Pads visibility toggle
togglePadsVisible.addEventListener('change', () => {
  if (togglePadsVisible.checked) {
    padLeft.classList.remove('hidden');
    padRight.classList.remove('hidden');
  } else {
    padLeft.classList.add('hidden');
    padRight.classList.add('hidden');
  }
});

// ── Top-right: Guide Modal ────────────────────────────────────────────────
function openGuide() {
  guideModal.classList.remove('hidden');
  settingsDropdown.classList.add('hidden');
  settingsBtn.setAttribute('aria-expanded', 'false');
}

function closeGuide() {
  guideModal.classList.add('hidden');
}

helpBtn.addEventListener('click', openGuide);
guideCloseBtn.addEventListener('click', closeGuide);

guideModal.addEventListener('click', (e) => {
  if (e.target === guideModal) {
    closeGuide();
  }
});

// Global Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeGuide();
    settingsDropdown.classList.add('hidden');
    settingsBtn.setAttribute('aria-expanded', 'false');
  }
});

let isRendering = false;
let renderPending = false;

function requestRealtimeRun() {
  if (isRendering) {
    renderPending = true;
    return;
  }
  isRendering = true;
  requestAnimationFrame(async () => {
    await runPipeline(editorHandle.getValue());
    isRendering = false;
    if (renderPending) {
      renderPending = false;
      requestRealtimeRun();
    }
  });
}

// ── Box drag on canvas (when dragTarget === 'box') ────────────────────────
{
  let dragging = false;
  let lastX = 0, lastY = 0;

  canvas.addEventListener('pointerdown', (e) => {
    if (dragTarget !== 'box') return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || dragTarget !== 'box') return;
    const dx = (e.clientX - lastX) / canvas.clientWidth;
    const dy = (e.clientY - lastY) / canvas.clientHeight;
    lastX = e.clientX;
    lastY = e.clientY;

    const right   = new THREE.Vector3();
    const up      = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.matrix.extractBasis(right, up, forward);

    const scale = 20;
    algebraicOffset.addScaledVector(right, dx * scale);
    algebraicOffset.addScaledVector(up,   -dy * scale);
    requestRealtimeRun();
  });

  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
}

// ── Probing ───────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();

canvas.addEventListener('click', (ev) => {
  if (dragTarget === 'box') return; // skip probe in box-drag mode
  if (probeVolumes.length === 0 || displayFields.length === 0) return;

  const rect = canvas.getBoundingClientRect();
  pointer.x = ((ev.clientX - rect.left) / rect.width)  * 2 - 1;
  pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const result = probe(displayFields[0], probeVolumes[0], raycaster);
  if (!result) {
    probeValue.textContent = '— click on the field to sample —';
    return;
  }
  const pt = result.point.map(v => v.toFixed(3)).join(', ');
  const val = Array.isArray(result.value)
    ? `[${(result.value as number[]).map(v => v.toFixed(4)).join(', ')}]`
    : (result.value as number).toFixed(6);
  probeValue.textContent = `at(${pt}) = ${val}`;
});

// ── Jog pad — LEFT (BOX control) ─────────────────────────────────────────
const padBox = new JogPad(diskLeftEl, stripLeftEl, '#B45309', 'BOX', {
  onXY: (x, y) => {
    const right = new THREE.Vector3();
    const up    = new THREE.Vector3();
    camera.matrix.extractBasis(right, up, new THREE.Vector3());
    const speed = 0.06;
    algebraicOffset.addScaledVector(right,  x * speed);
    algebraicOffset.addScaledVector(up,    -y * speed);
    requestRealtimeRun();
  },
  onZ: (z) => {
    algebraicOffset.z += z * 0.06;
    requestRealtimeRun();
  },
  onReset: () => {
    algebraicOffset.set(0, 0, 0);
    requestRealtimeRun();
  },
});

// ── Jog pad — RIGHT (CAMERA control) ─────────────────────────────────────
const padCam = new JogPad(diskRightEl, stripRightEl, '#1D4ED8', 'CAM', {
  onXY: (x, y) => {
    const offset = camera.position.clone().sub(controls.target);
    const sph    = new THREE.Spherical().setFromVector3(offset);
    sph.theta -= x * 0.025;
    sph.phi   += y * 0.025;
    sph.phi    = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi));
    camera.position.setFromSpherical(sph).add(controls.target);
    camera.lookAt(controls.target);
    controls.update();
  },
  onZ: (z) => {
    const offset = camera.position.clone().sub(controls.target);
    const dist   = Math.max(1, offset.length() * (1 - z * 0.06));
    camera.position.copy(controls.target).addScaledVector(offset.normalize(), dist);
    controls.update();
  },
  onReset: () => {
    camera.position.set(9, 7, 11);
    controls.target.set(0, 0, 0);
    controls.update();
  },
});

// ── URL & Iframe message integration (for Colab / Jupyter / GitHub Pages) ───
const urlParams = new URLSearchParams(window.location.search);
const hashStr   = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
const hashParams = new URLSearchParams(hashStr);

const codeParam = urlParams.get('code') || hashParams.get('code');
if (urlParams.get('hideInspector') === 'true' || hashParams.get('hideInspector') === 'true') {
  collapseInspector();
}
if (urlParams.get('hidePads') === 'true' || hashParams.get('hidePads') === 'true') {
  togglePadsVisible.checked = false;
  padLeft.classList.add('hidden');
  padRight.classList.add('hidden');
}

window.addEventListener('message', (event) => {
  if (event.data && typeof event.data === 'object') {
    if (event.data.type === 'SET_CODE' && typeof event.data.code === 'string') {
      editorHandle.setValue(event.data.code);
      runPipeline(event.data.code);
    } else if (event.data.type === 'SET_INSPECTOR' && typeof event.data.visible === 'boolean') {
      if (event.data.visible) expandInspector();
      else collapseInspector();
    } else if (event.data.type === 'SET_PADS' && typeof event.data.visible === 'boolean') {
      togglePadsVisible.checked = event.data.visible;
      if (event.data.visible) {
        padLeft.classList.remove('hidden');
        padRight.classList.remove('hidden');
      } else {
        padLeft.classList.add('hidden');
        padRight.classList.add('hidden');
      }
    }
  }
});

// ── Boot ───────────────────────────────────────────────────────────────────
const initialCode = codeParam ? decodeURIComponent(codeParam) : DEFAULT_CODE;
if (codeParam) {
  editorHandle.setValue(initialCode);
}
runPipeline(initialCode);


