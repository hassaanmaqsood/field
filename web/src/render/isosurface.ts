import * as THREE from 'three';
import { Field, asScalar } from '../protocol/Field';

const VERTEX = /* glsl */ `
  out vec3 vObjPos;
  void main() {
    vObjPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  precision highp float;
  precision highp sampler3D;

  uniform sampler3D uVoxels;
  uniform vec3 uBoxMin;
  uniform vec3 uBoxMax;
  uniform float uIso;
  uniform vec3 uCameraObjPos;
  uniform vec3 uColor;

  in vec3 vObjPos;

  out vec4 fragColor;

  // sample density at an object-space point, in [uBoxMin, uBoxMax]
  float density(vec3 p) {
    vec3 uv = (p - uBoxMin) / (uBoxMax - uBoxMin);
    return texture(uVoxels, uv).r - uIso;
  }

  vec3 normalAt(vec3 p) {
    float e = 0.01;
    float dx = density(p + vec3(e,0,0)) - density(p - vec3(e,0,0));
    float dy = density(p + vec3(0,e,0)) - density(p - vec3(0,e,0));
    float dz = density(p + vec3(0,0,e)) - density(p - vec3(0,0,e));
    return normalize(vec3(dx, dy, dz) + 1e-6);
  }

  // ray/box intersection, returns (tNear, tFar)
  vec2 boxIntersect(vec3 ro, vec3 rd) {
    vec3 inv = 1.0 / rd;
    vec3 t0 = (uBoxMin - ro) * inv;
    vec3 t1 = (uBoxMax - ro) * inv;
    vec3 tmin = min(t0, t1);
    vec3 tmax = max(t0, t1);
    return vec2(max(max(tmin.x, tmin.y), tmin.z), min(min(tmax.x, tmax.y), tmax.z));
  }

  void main() {
    vec3 ro = uCameraObjPos;
    vec3 rd = normalize(vObjPos - uCameraObjPos);
    vec2 tb = boxIntersect(ro, rd);
    if (tb.x > tb.y || tb.y < 0.0) discard;
    float t = max(tb.x, 0.0);
    float tEnd = tb.y;

    const int STEPS = 160;
    float stepSize = (tEnd - t) / float(STEPS);
    float prevD = density(ro + rd * t);
    float hitT = -1.0;

    for (int i = 1; i <= STEPS; i++) {
      float ct = t + float(i) * stepSize;
      float d = density(ro + rd * ct);
      if (prevD > 0.0 && d <= 0.0) {
        // bisection refine between (ct - stepSize) and ct
        float lo = ct - stepSize;
        float hi = ct;
        for (int j = 0; j < 6; j++) {
          float mid = 0.5 * (lo + hi);
          float dm = density(ro + rd * mid);
          if (dm > 0.0) lo = mid; else hi = mid;
        }
        hitT = 0.5 * (lo + hi);
        break;
      }
      prevD = d;
    }

    if (hitT < 0.0) discard;
    vec3 hitP = ro + rd * hitT;
    vec3 n = normalAt(hitP);
    vec3 lightDir = normalize(vec3(0.5, 0.8, 0.4));
    float diff = max(dot(n, lightDir), 0.0);
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
    vec3 color = uColor * (0.25 + 0.75 * diff) + vec3(0.15) * rim;
    fragColor = vec4(color, 1.0);
  }
`;

export interface IsosurfaceHandle {
  mesh: THREE.Mesh;
  setIso(value: number): void;
  dispose(): void;
}

/**
 * Bakes `field` (any scalar field, analytic or discrete — the render layer
 * never branches on continuity()) to a 3D texture via the generic sample()
 * bake operator, then raymarches that texture. This is the same code path
 * for analytic presets and imported/discrete datasets alike.
 */
export function buildIsosurface(
  field: Field,
  resolution = 48,
  color = new THREE.Color(0x4fd1c5)
): IsosurfaceHandle {
  const domain = field.domain();
  const [dx, dy, dz] = domain;
  const baked = field.sample({ resolution: [resolution, resolution, resolution] });

  const data = new Float32Array(resolution * resolution * resolution);
  let i = 0;
  for (let zi = 0; zi < resolution; zi++) {
    const z = dz.min + (zi / (resolution - 1)) * (dz.max - dz.min);
    for (let yi = 0; yi < resolution; yi++) {
      const y = dy.min + (yi / (resolution - 1)) * (dy.max - dy.min);
      for (let xi = 0; xi < resolution; xi++) {
        const x = dx.min + (xi / (resolution - 1)) * (dx.max - dx.min);
        const val = baked.at([x, y, z]);
        if (typeof val === 'number') {
          data[i++] = val;
        } else if (Array.isArray(val) && typeof val[0] === 'number') {
          const arr = val as number[];
          data[i++] = Math.sqrt(arr.reduce((sum, v) => sum + v * v, 0));
        } else {
          data[i++] = 0; // fallback for tensor
        }
      }
    }
  }

  const texture = new THREE.Data3DTexture(data, resolution, resolution, resolution);
  texture.format = THREE.RedFormat;
  texture.type = THREE.FloatType;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  const size = new THREE.Vector3(dx.max - dx.min, dy.max - dy.min, dz.max - dz.min);
  const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uVoxels: { value: texture },
      uBoxMin: { value: new THREE.Vector3(-size.x / 2, -size.y / 2, -size.z / 2) },
      uBoxMax: { value: new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2) },
      uIso: { value: 0 },
      uCameraObjPos: { value: new THREE.Vector3() },
      uColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
    },
    side: THREE.BackSide, // so ray origin (camera) can be outside or inside the box
    glslVersion: THREE.GLSL3,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.onBeforeRender = (_r, _s, camera) => {
    const objPos = mesh.worldToLocal(camera.position.clone());
    (material.uniforms.uCameraObjPos.value as THREE.Vector3).copy(objPos);
  };

  return {
    mesh,
    setIso: (value: number) => {
      material.uniforms.uIso.value = value;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
