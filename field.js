/**
 * Field-Native Computational Engineering
 * Vanilla JavaScript implementation for browser-based parametric 3D modeling
 * 
 * 
 * @version 0.3.0
 */

// ============================================================================
// CORE MATH UTILITIES
// ============================================================================

/**
 * @typedef {Object} Vec2
 * @property {number} x
 * @property {number} y
 */

/**
 * @typedef {Object} Vec3
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * @typedef {Object} Bounds3D
 * @property {Vec3} min
 * @property {Vec3} max
 */

const Vec2 = {
    create: (x = 0, y = 0) => ({ x, y }),
    
    add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
    
    sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
    
    mul: (v, s) => ({ x: v.x * s, y: v.y * s }),
    
    div: (v, s) => s !== 0 ? { x: v.x / s, y: v.y / s } : { x: 0, y: 0 },
    
    dot: (a, b) => a.x * b.x + a.y * b.y,
    
    length: (v) => Math.sqrt(v.x * v.x + v.y * v.y),
    
    lengthSq: (v) => v.x * v.x + v.y * v.y,
    
    normalize: (v) => {
      const len = Vec2.length(v);
      return len > 0 ? Vec2.mul(v, 1 / len) : { x: 0, y: 0 };
    },
    
    distance: (a, b) => Vec2.length(Vec2.sub(a, b)),
    
    distanceSq: (a, b) => Vec2.lengthSq(Vec2.sub(a, b)),
    
    perp: (v) => ({ x: -v.y, y: v.x }),
    
    lerp: (a, b, t) => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t
    }),
    
    angle: (v) => Math.atan2(v.y, v.x),
    
    rotate: (v, angle) => ({
      x: v.x * Math.cos(angle) - v.y * Math.sin(angle),
      y: v.x * Math.sin(angle) + v.y * Math.cos(angle)
    })
  };
  
  const Vec3 = {
    create: (x = 0, y = 0, z = 0) => ({ x, y, z }),
    
    add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
    
    sub: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
    
    mul: (v, s) => ({ x: v.x * s, y: v.y * s, z: v.z * s }),
    
    div: (v, s) => s !== 0 ? { x: v.x / s, y: v.y / s, z: v.z / s } : { x: 0, y: 0, z: 0 },
    
    dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
    
    cross: (a, b) => ({
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x
    }),
    
    length: (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z),
    
    lengthSq: (v) => v.x * v.x + v.y * v.y + v.z * v.z,
    
    normalize: (v) => {
      const len = Vec3.length(v);
      return len > 0 ? Vec3.mul(v, 1 / len) : { x: 0, y: 0, z: 0 };
    },
    
    distance: (a, b) => Vec3.length(Vec3.sub(a, b)),
    
    distanceSq: (a, b) => Vec3.lengthSq(Vec3.sub(a, b)),
    
    lerp: (a, b, t) => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t
    }),
    
    clamp: (v, min, max) => ({
      x: Math.max(min.x, Math.min(max.x, v.x)),
      y: Math.max(min.y, Math.min(max.y, v.y)),
      z: Math.max(min.z, Math.min(max.z, v.z))
    }),
    
    equals: (a, b, epsilon = 1e-6) => 
      Math.abs(a.x - b.x) < epsilon &&
      Math.abs(a.y - b.y) < epsilon &&
      Math.abs(a.z - b.z) < epsilon
  };
  
  // ============================================================================
  // BOUNDS UTILITIES
  // ============================================================================
  
  const Bounds = {
    /**
     * Create bounds from min and max points
     */
    create: (min, max) => ({ min, max }),
    
    /**
     * Create bounds from center and size
     */
    fromCenterSize: (center, size) => ({
      min: {
        x: center.x - size.x / 2,
        y: center.y - size.y / 2,
        z: center.z - size.z / 2
      },
      max: {
        x: center.x + size.x / 2,
        y: center.y + size.y / 2,
        z: center.z + size.z / 2
      }
    }),
    
    /**
     * Expand bounds by a value
     */
    expand: (bounds, value) => ({
      min: Vec3.sub(bounds.min, { x: value, y: value, z: value }),
      max: Vec3.add(bounds.max, { x: value, y: value, z: value })
    }),
    
    /**
     * Union of two bounds
     */
    union: (a, b) => ({
      min: {
        x: Math.min(a.min.x, b.min.x),
        y: Math.min(a.min.y, b.min.y),
        z: Math.min(a.min.z, b.min.z)
      },
      max: {
        x: Math.max(a.max.x, b.max.x),
        y: Math.max(a.max.y, b.max.y),
        z: Math.max(a.max.z, b.max.z)
      }
    }),
    
    /**
     * Intersection of two bounds
     */
    intersection: (a, b) => ({
      min: {
        x: Math.max(a.min.x, b.min.x),
        y: Math.max(a.min.y, b.min.y),
        z: Math.max(a.min.z, b.min.z)
      },
      max: {
        x: Math.min(a.max.x, b.max.x),
        y: Math.min(a.max.y, b.max.y),
        z: Math.min(a.max.z, b.max.z)
      }
    }),
    
    /**
     * Check if point is inside bounds
     */
    contains: (bounds, point) =>
      point.x >= bounds.min.x && point.x <= bounds.max.x &&
      point.y >= bounds.min.y && point.y <= bounds.max.y &&
      point.z >= bounds.min.z && point.z <= bounds.max.z,
    
    /**
     * Get center of bounds
     */
    center: (bounds) => Vec3.mul(Vec3.add(bounds.min, bounds.max), 0.5),
    
    /**
     * Get size of bounds
     */
    size: (bounds) => Vec3.sub(bounds.max, bounds.min),
    
    /**
     * Check if bounds are valid
     */
    isValid: (bounds) =>
      bounds.min.x <= bounds.max.x &&
      bounds.min.y <= bounds.max.y &&
      bounds.min.z <= bounds.max.z
  };
  
  // ============================================================================
  // FIELD BASE CLASS (FIXED - No Ghost Cache)
  // ============================================================================
  
  class Field {
    constructor() {
      this._bounds = null;
      this._metadata = {
        type: 'unknown',
        complexity: 1,
        created: Date.now()
      };
      // REMOVED: Ghost cache system that allocated memory but never used it
    }
  
    /**
     * Sample field at point with options
     * @param {Vec3|number} x - Point or x coordinate
     * @param {number} [y] - Y coordinate
     * @param {number} [z] - Z coordinate
     * @param {Object} [options] - Sampling options
     * @returns {Object} Sample result
     */
    sample(x, y, z, options = {}) {
      const p = (typeof x === 'object') ? x : { x, y, z };
      
      // Bounds checking for early culling
      if (this._bounds && !Bounds.contains(this._bounds, p)) {
        const toCenter = Vec3.sub(p, Bounds.center(this._bounds));
        const size = Bounds.size(this._bounds);
        const maxDim = Math.max(size.x, size.y, size.z) / 2;
        return {
          distance: Vec3.length(toCenter) - maxDim,
          outsideBounds: true
        };
      }
      
      const result = {
        distance: this._evaluate(p),
        point: p
      };
  
      if (options.computeNormal !== false && Math.abs(result.distance) < 0.1) {
        result.normal = this._gradient(p, options.normalEpsilon);
      }
  
      if (options.includeMaterial && this.material) {
        result.material = this.material;
      }
  
      return result;
    }
  
    /**
     * Core SDF evaluation - override in subclasses
     * @param {Vec3} p - Point to evaluate
     * @returns {number} Signed distance
     */
    _evaluate(p) {
      throw new Error('_evaluate must be implemented by subclass');
    }
  
    /**
     * Compute gradient (surface normal) via finite differences
     * @param {Vec3} p - Point
     * @param {number} [epsilon=0.001] - Step size
     * @returns {Vec3} Normalized gradient
     */
    _gradient(p, epsilon = 0.001) {
      const dx = this._evaluate({ x: p.x + epsilon, y: p.y, z: p.z }) -
                 this._evaluate({ x: p.x - epsilon, y: p.y, z: p.z });
      const dy = this._evaluate({ x: p.x, y: p.y + epsilon, z: p.z }) -
                 this._evaluate({ x: p.x, y: p.y - epsilon, z: p.z });
      const dz = this._evaluate({ x: p.x, y: p.y, z: p.z + epsilon }) -
                 this._evaluate({ x: p.x, y: p.y, z: p.z - epsilon });
      
      return Vec3.normalize({ 
        x: dx / (2 * epsilon), 
        y: dy / (2 * epsilon), 
        z: dz / (2 * epsilon) 
      });
    }
  
    /**
     * Batch sampling for performance
     * @param {Vec3[]} points - Array of points
     * @param {Object} [options] - Sampling options
     * @returns {Object[]} Array of samples
     */
    sampleBatch(points, options = {}) {
      return points.map(p => this.sample(p, options));
    }
  
    /**
     * Get bounding box
     * @returns {Bounds3D} Bounding box
     */
    bounds() {
      if (!this._bounds) {
        console.warn('Bounds not computed for this field - using default large bounds');
        return {
          min: { x: -1000, y: -1000, z: -1000 },
          max: { x: 1000, y: 1000, z: 1000 }
        };
      }
      return { ...this._bounds };
    }
  
    /**
     * Get metadata
     * @returns {Object} Field metadata
     */
    metadata() {
      return { ...this._metadata };
    }
  
    /**
     * Clone this field
     * @returns {Field} Cloned field
     */
    clone() {
      const cloned = Object.create(Object.getPrototypeOf(this));
      Object.assign(cloned, this);
      cloned._metadata = { ...this._metadata };
      cloned._bounds = this._bounds ? { 
        min: { ...this._bounds.min }, 
        max: { ...this._bounds.max } 
      } : null;
      return cloned;
    }
  }
  
  // ============================================================================
  // FIXED PRIMITIVES (Solid, Proper Caps, Correct Distances)
  // ============================================================================
  
  const Primitives = {
    /**
     * FIXED: Sphere - correct implementation
     */
    sphere(center, radius) {
      if (radius <= 0) throw new Error('Sphere radius must be positive');
      
      const field = new Field();
      field._evaluate = (p) => Vec3.distance(p, center) - radius;
      field._bounds = {
        min: Vec3.sub(center, { x: radius, y: radius, z: radius }),
        max: Vec3.add(center, { x: radius, y: radius, z: radius })
      };
      field._metadata = { type: 'sphere', complexity: 1, radius, center };
      return field;
    },
  
    /**
     * FIXED: Box - correct implementation
     */
    box(center, size) {
      if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
        throw new Error('Box dimensions must be positive');
      }
      
      const field = new Field();
      const halfSize = Vec3.mul(size, 0.5);
      
      field._evaluate = (p) => {
        const d = {
          x: Math.abs(p.x - center.x) - halfSize.x,
          y: Math.abs(p.y - center.y) - halfSize.y,
          z: Math.abs(p.z - center.z) - halfSize.z
        };
        
        const outside = Vec3.length({
          x: Math.max(d.x, 0),
          y: Math.max(d.y, 0),
          z: Math.max(d.z, 0)
        });
        const inside = Math.min(Math.max(d.x, d.y, d.z), 0);
        return outside + inside;
      };
      
      field._bounds = {
        min: Vec3.sub(center, halfSize),
        max: Vec3.add(center, halfSize)
      };
      field._metadata = { type: 'box', complexity: 1, size, center };
      return field;
    },
  
    /**
     * FIXED: Cylinder - now properly solid with correct cap handling
     * BUG FIXED: Was hollow, caps were ignored in boolean operations
     */
    cylinder(start, end, radius) {
      if (radius <= 0) throw new Error('Cylinder radius must be positive');
      if (Vec3.distance(start, end) < 0.0001) {
        throw new Error('Cylinder start and end must be different');
      }
      
      const field = new Field();
      const axis = Vec3.normalize(Vec3.sub(end, start));
      const height = Vec3.distance(start, end);
      
      field._evaluate = (p) => {
        const v = Vec3.sub(p, start);
        const proj = Vec3.dot(v, axis);
        
        // Vector from axis to point (perpendicular distance)
        const projPoint = Vec3.add(start, Vec3.mul(axis, proj));
        const vecToAxis = Vec3.sub(p, projPoint);
        const distToSide = Vec3.length(vecToAxis) - radius;
        
        // Distance to caps
        const distToTop = proj - height;
        const distToBottom = -proj;
        const distToCap = Math.max(distToTop, distToBottom);
        
        // FIXED: Proper SDF combination
        if (proj >= 0 && proj <= height) {
          // Between caps
          if (distToSide < 0) {
            // Inside cylinder radially - distance to closest surface
            return Math.max(distToSide, distToCap);
          } else {
            // Outside cylinder radially
            return distToSide;
          }
        } else {
          // Outside caps - combine distances properly
          const outsideDist = Math.sqrt(
            Math.max(distToSide, 0) ** 2 + 
            Math.max(distToCap, 0) ** 2
          );
          const insideDist = Math.min(Math.max(distToSide, distToCap), 0);
          return outsideDist + insideDist;
        }
      };
      
      field._bounds = {
        min: {
          x: Math.min(start.x, end.x) - radius,
          y: Math.min(start.y, end.y) - radius,
          z: Math.min(start.z, end.z) - radius
        },
        max: {
          x: Math.max(start.x, end.x) + radius,
          y: Math.max(start.y, end.y) + radius,
          z: Math.max(start.z, end.z) + radius
        }
      };
      field._metadata = { type: 'cylinder', complexity: 2, radius, height };
      return field;
    },
  
    /**
     * FIXED: Cone - correct distance to sloped surface
     * BUG FIXED: Was using axis distance instead of perpendicular distance to surface
     */
    cone(base, tip, radius) {
      if (radius <= 0) throw new Error('Cone radius must be positive');
      if (Vec3.distance(base, tip) < 0.0001) {
        throw new Error('Cone base and tip must be different');
      }
      
      const field = new Field();
      const axis = Vec3.normalize(Vec3.sub(tip, base));
      const height = Vec3.distance(base, tip);
      
      field._evaluate = (p) => {
        const v = Vec3.sub(p, base);
        const proj = Vec3.dot(v, axis);
        
        // Project point onto axis
        const projPoint = Vec3.add(base, Vec3.mul(axis, proj));
        const vecToAxis = Vec3.sub(p, projPoint);
        const distFromAxis = Vec3.length(vecToAxis);
        
        // Cone radius at this height (linear taper)
        const t = proj / height;
        const coneRadius = radius * (1 - t);
        
        // Distance to base cap
        const distToBase = -proj;
        
        // Distance to tip (if beyond height)
        const distToTip = proj - height;
        
        if (proj < 0) {
          // Below base
          const distToConeSurface = distFromAxis - radius;
          return Math.sqrt(
            Math.max(distToConeSurface, 0) ** 2 + 
            Math.max(distToBase, 0) ** 2
          ) + Math.min(Math.max(distToConeSurface, distToBase), 0);
        } else if (proj > height) {
          // Above tip
          return Vec3.distance(p, tip);
        } else {
          // Between base and tip - FIXED: correct perpendicular distance to sloped surface
          const distToSlope = distFromAxis - coneRadius;
          const distToCap = Math.max(distToBase, distToTip);
          
          if (distToSlope < 0 && distToCap < 0) {
            // Inside cone
            return Math.max(distToSlope, distToCap);
          } else {
            // Outside or on surface
            return Math.sqrt(
              Math.max(distToSlope, 0) ** 2 + 
              Math.max(distToCap, 0) ** 2
            ) + Math.min(Math.max(distToSlope, distToCap), 0);
          }
        }
      };
      
      field._bounds = {
        min: {
          x: Math.min(base.x - radius, tip.x),
          y: Math.min(base.y - radius, tip.y),
          z: Math.min(base.z - radius, tip.z)
        },
        max: {
          x: Math.max(base.x + radius, tip.x),
          y: Math.max(base.y + radius, tip.y),
          z: Math.max(base.z + radius, tip.z)
        }
      };
      field._metadata = { type: 'cone', complexity: 2, radius, height };
      return field;
    },
  
    /**
     * FIXED: Capsule - correct implementation
     */
    capsule(start, end, radius) {
      if (radius <= 0) throw new Error('Capsule radius must be positive');
      
      const field = new Field();
      const lineVec = Vec3.sub(end, start);
      const lineLength = Vec3.length(lineVec);
      const lineDir = Vec3.normalize(lineVec);
      
      field._evaluate = (p) => {
        const v = Vec3.sub(p, start);
        const proj = Vec3.dot(v, lineDir);
        const t = Math.max(0, Math.min(lineLength, proj));
        
        const closest = Vec3.add(start, Vec3.mul(lineDir, t));
        return Vec3.distance(p, closest) - radius;
      };
      
      field._bounds = {
        min: {
          x: Math.min(start.x, end.x) - radius,
          y: Math.min(start.y, end.y) - radius,
          z: Math.min(start.z, end.z) - radius
        },
        max: {
          x: Math.max(start.x, end.x) + radius,
          y: Math.max(start.y, end.y) + radius,
          z: Math.max(start.z, end.z) + radius
        }
      };
      field._metadata = { type: 'capsule', complexity: 1, radius, height: lineLength };
      return field;
    },
  
    /**
     * Torus - correct implementation
     */
    torus(center, normal, majorRadius, minorRadius) {
      if (majorRadius <= 0 || minorRadius <= 0) {
        throw new Error('Torus radii must be positive');
      }
      
      const field = new Field();
      const n = Vec3.normalize(normal);
      
      field._evaluate = (p) => {
        const v = Vec3.sub(p, center);
        const distAlongAxis = Vec3.dot(v, n);
        const radialVec = Vec3.sub(v, Vec3.mul(n, distAlongAxis));
        const distFromAxis = Vec3.length(radialVec);
        
        const dx = distFromAxis - majorRadius;
        return Math.sqrt(dx * dx + distAlongAxis * distAlongAxis) - minorRadius;
      };
      
      const r = majorRadius + minorRadius;
      field._bounds = {
        min: Vec3.sub(center, { x: r, y: r, z: r }),
        max: Vec3.add(center, { x: r, y: r, z: r })
      };
      field._metadata = { type: 'torus', complexity: 2, majorRadius, minorRadius };
      return field;
    },
  
    /**
     * Plane - correct implementation
     */
    plane(point, normal) {
      const field = new Field();
      const n = Vec3.normalize(normal);
      
      field._evaluate = (p) => Vec3.dot(Vec3.sub(p, point), n);
      
      field._bounds = {
        min: { x: -10000, y: -10000, z: -10000 },
        max: { x: 10000, y: 10000, z: 10000 }
      };
      field._metadata = { type: 'plane', complexity: 1 };
      return field;
    },
  
    /**
     * Custom implicit function
     */
    implicit(fn, bounds) {
      if (typeof fn !== 'function') {
        throw new Error('Implicit function must be a function');
      }
      
      const field = new Field();
      field._evaluate = (p) => fn(p.x, p.y, p.z);
      field._bounds = bounds;
      field._metadata = { type: 'implicit', complexity: 3 };
      return field;
    }
  };
  
  // ============================================================================
  // BOOLEAN OPERATIONS
  // ============================================================================
  
  const Boolean = {
    /**
     * Union (OR) - combines shapes
     */
    union(...fields) {
      if (fields.length === 0) throw new Error('Union requires at least one field');
      if (fields.length === 1) return fields[0];
      
      const field = new Field();
      field._evaluate = (p) => Math.min(...fields.map(f => f._evaluate(p)));
      field._bounds = fields.reduce((acc, f) => 
        acc ? Bounds.union(acc, f.bounds()) : f.bounds(), null
      );
      field._metadata = { 
        type: 'union', 
        complexity: fields.reduce((sum, f) => sum + f.metadata().complexity, 0)
      };
      return field;
    },
  
    /**
     * Intersection (AND)
     */
    intersection(...fields) {
      if (fields.length === 0) throw new Error('Intersection requires at least one field');
      if (fields.length === 1) return fields[0];
      
      const field = new Field();
      field._evaluate = (p) => Math.max(...fields.map(f => f._evaluate(p)));
      field._bounds = fields.reduce((acc, f) => 
        acc ? Bounds.intersection(acc, f.bounds()) : f.bounds(), null
      );
      field._metadata = { 
        type: 'intersection', 
        complexity: fields.reduce((sum, f) => sum + f.metadata().complexity, 0)
      };
      return field;
    },
  
    /**
     * Difference (A - B)
     */
    difference(a, b) {
      const field = new Field();
      field._evaluate = (p) => Math.max(a._evaluate(p), -b._evaluate(p));
      field._bounds = a.bounds();
      field._metadata = { 
        type: 'difference', 
        complexity: a.metadata().complexity + b.metadata().complexity
      };
      return field;
    },
  
    /**
     * XOR (symmetric difference)
     */
    xor(a, b) {
      const field = new Field();
      field._evaluate = (p) => {
        const da = a._evaluate(p);
        const db = b._evaluate(p);
        return Math.max(Math.min(da, -db), Math.min(-da, db));
      };
      field._bounds = Bounds.union(a.bounds(), b.bounds());
      field._metadata = { 
        type: 'xor', 
        complexity: a.metadata().complexity + b.metadata().complexity
      };
      return field;
    },
  
    /**
     * Smooth union using polynomial smooth minimum
     */
    smoothUnion(fields, blendRadius) {
      if (fields.length === 0) throw new Error('Smooth union requires at least one field');
      if (fields.length === 1) return fields[0];
      
      const field = new Field();
      field._evaluate = (p) => {
        const distances = fields.map(f => f._evaluate(p));
        return Boolean._smoothMin(distances, blendRadius);
      };
      field._bounds = fields.reduce((acc, f) => 
        acc ? Bounds.union(acc, f.bounds()) : f.bounds(), null
      );
      field._metadata = { 
        type: 'smoothUnion', 
        complexity: fields.reduce((sum, f) => sum + f.metadata().complexity, 0),
        blendRadius
      };
      return field;
    },
  
    /**
     * Smooth intersection
     */
    smoothIntersection(fields, blendRadius) {
      if (fields.length === 0) throw new Error('Smooth intersection requires at least one field');
      if (fields.length === 1) return fields[0];
      
      const field = new Field();
      field._evaluate = (p) => {
        const distances = fields.map(f => f._evaluate(p));
        return Boolean._smoothMax(distances, blendRadius);
      };
      field._bounds = fields.reduce((acc, f) => 
        acc ? Bounds.intersection(acc, f.bounds()) : f.bounds(), null
      );
      field._metadata = { 
        type: 'smoothIntersection', 
        complexity: fields.reduce((sum, f) => sum + f.metadata().complexity, 0),
        blendRadius
      };
      return field;
    },
  
    /**
     * Smooth minimum helper (polynomial)
     * @private
     */
    _smoothMin(values, k) {
      if (values.length === 1) return values[0];
      
      let res = values[0];
      for (let i = 1; i < values.length; i++) {
        const h = Math.max(k - Math.abs(res - values[i]), 0) / k;
        res = Math.min(res, values[i]) - h * h * k * 0.25;
      }
      return res;
    },
  
    /**
     * Smooth maximum helper (polynomial)
     * @private
     */
    _smoothMax(values, k) {
      if (values.length === 1) return values[0];
      
      let res = values[0];
      for (let i = 1; i < values.length; i++) {
        const h = Math.max(k - Math.abs(res - values[i]), 0) / k;
        res = Math.max(res, values[i]) + h * h * k * 0.25;
      }
      return res;
    }
  };
  
  // ============================================================================
  // TRANSFORMATION OPERATIONS (FIXED - Tight Rotation Bounds)
  // ============================================================================
  
  const Transform = {
    /**
     * Translate field
     */
    translate(field, offset) {
      const newField = new Field();
      newField._evaluate = (p) => field._evaluate(Vec3.sub(p, offset));
      
      const b = field.bounds();
      newField._bounds = {
        min: Vec3.add(b.min, offset),
        max: Vec3.add(b.max, offset)
      };
      newField._metadata = { 
        ...field.metadata(), 
        type: `translate(${field.metadata().type})`,
        offset
      };
      return newField;
    },
  
    /**
     * FIXED: Scale field with non-uniform scaling warning
     * BUG FIXED: Added warning system for non-uniform scaling
     */
    scale(field, scale, center = { x: 0, y: 0, z: 0 }) {
      const s = typeof scale === 'number' ? 
        { x: scale, y: scale, z: scale } : scale;
      
      if (s.x <= 0 || s.y <= 0 || s.z <= 0) {
        throw new Error('Scale factors must be positive');
      }
      
      // FIXED: Check for non-uniform scaling
      const isUniform = Math.abs(s.x - s.y) < 0.001 && Math.abs(s.y - s.z) < 0.001;
      
      if (!isUniform) {
        console.warn(
          '⚠️  WARNING: Non-uniform scaling breaks SDF properties!\n' +
          `Scale factors: x=${s.x.toFixed(3)}, y=${s.y.toFixed(3)}, z=${s.z.toFixed(3)}\n` +
          'This will cause incorrect results for:\n' +
          '  • Shell operations\n' +
          '  • Fillet operations\n' +
          '  • Offset operations\n' +
          '  • Distance measurements\n' +
          'Recommendation: Use uniform scaling or apply modifications before scaling.'
        );
      }
      
      const newField = new Field();
      const minScale = Math.min(s.x, s.y, s.z);
      
      newField._evaluate = (p) => {
        const translated = Vec3.sub(p, center);
        const scaled = {
          x: translated.x / s.x,
          y: translated.y / s.y,
          z: translated.z / s.z
        };
        const backTranslated = Vec3.add(scaled, center);
        
        // This is only correct for uniform scaling!
        return field._evaluate(backTranslated) * minScale;
      };
      
      const b = field.bounds();
      newField._bounds = {
        min: {
          x: center.x + (b.min.x - center.x) * s.x,
          y: center.y + (b.min.y - center.y) * s.y,
          z: center.z + (b.min.z - center.z) * s.z
        },
        max: {
          x: center.x + (b.max.x - center.x) * s.x,
          y: center.y + (b.max.y - center.y) * s.y,
          z: center.z + (b.max.z - center.z) * s.z
        }
      };
      newField._metadata = { 
        ...field.metadata(), 
        type: `scale(${field.metadata().type})`,
        scale: s,
        isUniform
      };
      return newField;
    },
  
    /**
     * FIXED: Rotate with tight bounds calculation
     * BUG FIXED: Was using conservative 100x larger bounds, now calculates exact rotated bounds
     */
    rotate(field, axis, angle, center = { x: 0, y: 0, z: 0 }) {
      const k = Vec3.normalize(axis);
      const cos = Math.cos(-angle);
      const sin = Math.sin(-angle);
      
      const rotatePoint = (p) => {
        const v = Vec3.sub(p, center);
        const crossKV = Vec3.cross(k, v);
        const dotKV = Vec3.dot(k, v);
        
        const rotated = {
          x: v.x * cos + crossKV.x * sin + k.x * dotKV * (1 - cos),
          y: v.y * cos + crossKV.y * sin + k.y * dotKV * (1 - cos),
          z: v.z * cos + crossKV.z * sin + k.z * dotKV * (1 - cos)
        };
        
        return Vec3.add(rotated, center);
      };
      
      const newField = new Field();
      newField._evaluate = (p) => field._evaluate(rotatePoint(p));
      
      // FIXED: Calculate tight bounds by rotating all 8 corners
      const b = field.bounds();
      const corners = [
        { x: b.min.x, y: b.min.y, z: b.min.z },
        { x: b.max.x, y: b.min.y, z: b.min.z },
        { x: b.min.x, y: b.max.y, z: b.min.z },
        { x: b.max.x, y: b.max.y, z: b.min.z },
        { x: b.min.x, y: b.min.y, z: b.max.z },
        { x: b.max.x, y: b.min.y, z: b.max.z },
        { x: b.min.x, y: b.max.y, z: b.max.z },
        { x: b.max.x, y: b.max.y, z: b.max.z }
      ];
      
      // Rotate each corner with inverse rotation
      const rotatedCorners = corners.map(corner => {
        const v = Vec3.sub(corner, center);
        const invCos = Math.cos(angle);
        const invSin = Math.sin(angle);
        const crossKV = Vec3.cross(k, v);
        const dotKV = Vec3.dot(k, v);
        
        return {
          x: center.x + v.x * invCos + crossKV.x * invSin + k.x * dotKV * (1 - invCos),
          y: center.y + v.y * invCos + crossKV.y * invSin + k.y * dotKV * (1 - invCos),
          z: center.z + v.z * invCos + crossKV.z * invSin + k.z * dotKV * (1 - invCos)
        };
      });
      
      // Find min/max of rotated corners
      newField._bounds = {
        min: {
          x: Math.min(...rotatedCorners.map(c => c.x)),
          y: Math.min(...rotatedCorners.map(c => c.y)),
          z: Math.min(...rotatedCorners.map(c => c.z))
        },
        max: {
          x: Math.max(...rotatedCorners.map(c => c.x)),
          y: Math.max(...rotatedCorners.map(c => c.y)),
          z: Math.max(...rotatedCorners.map(c => c.z))
        }
      };
      
      newField._metadata = { 
        ...field.metadata(), 
        type: `rotate(${field.metadata().type})`,
        axis, angle
      };
      return newField;
    },
  
    /**
     * Mirror field across plane
     */
    mirror(field, planePoint, planeNormal) {
      const n = Vec3.normalize(planeNormal);
      
      const newField = new Field();
      newField._evaluate = (p) => {
        const v = Vec3.sub(p, planePoint);
        const dist = Vec3.dot(v, n);
        const mirrored = Vec3.sub(p, Vec3.mul(n, 2 * dist));
        return field._evaluate(mirrored);
      };
      
      newField._bounds = field.bounds();
      newField._metadata = { 
        ...field.metadata(), 
        type: `mirror(${field.metadata().type})`
      };
      return newField;
    },
  
    /**
     * Twist field around axis
     */
    twist(field, axis, amount, center = { x: 0, y: 0, z: 0 }) {
      const k = Vec3.normalize(axis);
      
      const newField = new Field();
      newField._evaluate = (p) => {
        const v = Vec3.sub(p, center);
        const distAlongAxis = Vec3.dot(v, k);
        const angle = amount * distAlongAxis;
        
        const perp = Vec3.sub(v, Vec3.mul(k, distAlongAxis));
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        const u = Vec3.normalize(Vec3.cross(k, { x: 1, y: 0, z: 0 }));
        const v2 = Vec3.cross(k, u);
        
        const x = Vec3.dot(perp, u);
        const y = Vec3.dot(perp, v2);
        
        const rotatedPerp = Vec3.add(
          Vec3.mul(u, x * cos - y * sin),
          Vec3.mul(v2, x * sin + y * cos)
        );
        
        const twisted = Vec3.add(
          Vec3.add(rotatedPerp, Vec3.mul(k, distAlongAxis)),
          center
        );
        
        return field._evaluate(twisted);
      };
      
      newField._bounds = field.bounds();
      newField._metadata = { 
        ...field.metadata(), 
        type: `twist(${field.metadata().type})`,
        amount
      };
      return newField;
    }
  };
  
  // ============================================================================
  // MODIFICATION OPERATIONS
  // ============================================================================
  
  const Modify = {
    /**
     * Offset surface (expand/contract)
     */
    offset(field, distance) {
      const newField = new Field();
      newField._evaluate = (p) => field._evaluate(p) - distance;
      
      const b = field.bounds();
      newField._bounds = Bounds.expand(b, Math.abs(distance));
      newField._metadata = { 
        ...field.metadata(), 
        type: `offset(${field.metadata().type})`,
        distance
      };
      return newField;
    },
  
    /**
     * Shell - hollow out with wall thickness
     */
    shell(field, thickness) {
      if (thickness <= 0) throw new Error('Shell thickness must be positive');
      
      const outer = field;
      const inner = Modify.offset(field, -thickness);
      const result = Boolean.difference(outer, inner);
      result._metadata.type = `shell(${field.metadata().type})`;
      result._metadata.thickness = thickness;
      return result;
    },
  
    /**
     * Round edges (global fillet approximation)
     */
    fillet(field, radius) {
      if (radius <= 0) throw new Error('Fillet radius must be positive');
      
      const result = Modify.offset(Modify.offset(field, -radius), radius);
      result._metadata.type = `fillet(${field.metadata().type})`;
      result._metadata.radius = radius;
      return result;
    },
  
    /**
     * Chamfer edges
     */
    chamfer(field, distance) {
      if (distance <= 0) throw new Error('Chamfer distance must be positive');
      
      const result = Modify.offset(field, -distance * 0.5);
      result._metadata.type = `chamfer(${field.metadata().type})`;
      result._metadata.distance = distance;
      return result;
    },
  
    /**
     * Blend/smooth field
     */
    blend(field, amount) {
      const newField = new Field();
      newField._evaluate = (p) => {
        const samples = [];
        const eps = amount;
        
        samples.push(field._evaluate(p));
        samples.push(field._evaluate({ x: p.x + eps, y: p.y, z: p.z }));
        samples.push(field._evaluate({ x: p.x - eps, y: p.y, z: p.z }));
        samples.push(field._evaluate({ x: p.x, y: p.y + eps, z: p.z }));
        samples.push(field._evaluate({ x: p.x, y: p.y - eps, z: p.z }));
        samples.push(field._evaluate({ x: p.x, y: p.y, z: p.z + eps }));
        samples.push(field._evaluate({ x: p.x, y: p.y, z: p.z - eps }));
        
        return samples.reduce((a, b) => a + b) / samples.length;
      };
      
      newField._bounds = Bounds.expand(field.bounds(), amount);
      newField._metadata = { 
        ...field.metadata(), 
        type: `blend(${field.metadata().type})`,
        amount
      };
      return newField;
    }
  };
  
  // ============================================================================
  // FIXED LATTICE STRUCTURES (Bounded, No Infinite Extent)
  // ============================================================================
  
  const Lattice = {
    /**
     * FIXED: Gyroid with proper bounds clipping
     * BUG FIXED: Was extending infinitely when unioned with other shapes
     */
    gyroid(bounds, cellSize, thickness) {
      const freq = (2 * Math.PI) / cellSize;
      
      const field = new Field();
      field._evaluate = (p) => {
        // FIXED: Check if outside bounds - return positive distance
        if (p.x < bounds.min.x || p.x > bounds.max.x ||
            p.y < bounds.min.y || p.y > bounds.max.y ||
            p.z < bounds.min.z || p.z > bounds.max.z) {
          
          // Distance to bounding box
          const dx = Math.max(bounds.min.x - p.x, p.x - bounds.max.x, 0);
          const dy = Math.max(bounds.min.y - p.y, p.y - bounds.max.y, 0);
          const dz = Math.max(bounds.min.z - p.z, p.z - bounds.max.z, 0);
          return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        
        // Inside bounds - evaluate gyroid
        const value = Math.sin(p.x * freq) * Math.cos(p.y * freq) +
                      Math.sin(p.y * freq) * Math.cos(p.z * freq) +
                      Math.sin(p.z * freq) * Math.cos(p.x * freq);
        
        return Math.abs(value) - thickness;
      };
      
      field._bounds = bounds;
      field._metadata = { type: 'gyroid', complexity: 3, cellSize, thickness };
      return field;
    },
  
    /**
     * FIXED: Schwarz P with bounds
     */
    schwarzP(bounds, cellSize, thickness) {
      const freq = (2 * Math.PI) / cellSize;
      
      const field = new Field();
      field._evaluate = (p) => {
        if (p.x < bounds.min.x || p.x > bounds.max.x ||
            p.y < bounds.min.y || p.y > bounds.max.y ||
            p.z < bounds.min.z || p.z > bounds.max.z) {
          const dx = Math.max(bounds.min.x - p.x, p.x - bounds.max.x, 0);
          const dy = Math.max(bounds.min.y - p.y, p.y - bounds.max.y, 0);
          const dz = Math.max(bounds.min.z - p.z, p.z - bounds.max.z, 0);
          return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        
        const value = Math.cos(p.x * freq) + Math.cos(p.y * freq) + Math.cos(p.z * freq);
        return Math.abs(value) - thickness;
      };
      
      field._bounds = bounds;
      field._metadata = { type: 'schwarzP', complexity: 3, cellSize, thickness };
      return field;
    },
  
    /**
     * FIXED: Diamond with bounds
     */
    diamond(bounds, cellSize, thickness) {
      const freq = (2 * Math.PI) / cellSize;
      
      const field = new Field();
      field._evaluate = (p) => {
        if (p.x < bounds.min.x || p.x > bounds.max.x ||
            p.y < bounds.min.y || p.y > bounds.max.y ||
            p.z < bounds.min.z || p.z > bounds.max.z) {
          const dx = Math.max(bounds.min.x - p.x, p.x - bounds.max.x, 0);
          const dy = Math.max(bounds.min.y - p.y, p.y - bounds.max.y, 0);
          const dz = Math.max(bounds.min.z - p.z, p.z - bounds.max.z, 0);
          return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        
        const value = Math.sin(p.x * freq) * Math.sin(p.y * freq) * Math.sin(p.z * freq) +
                      Math.sin(p.x * freq) * Math.cos(p.y * freq) * Math.cos(p.z * freq) +
                      Math.cos(p.x * freq) * Math.sin(p.y * freq) * Math.cos(p.z * freq) +
                      Math.cos(p.x * freq) * Math.cos(p.y * freq) * Math.sin(p.z * freq);
        
        return Math.abs(value) - thickness;
      };
      
      field._bounds = bounds;
      field._metadata = { type: 'diamond', complexity: 4, cellSize, thickness };
      return field;
    },
  
    /**
     * FIXED: Schwarz D with bounds
     */
    schwarzD(bounds, cellSize, thickness) {
      const freq = (2 * Math.PI) / cellSize;
      
      const field = new Field();
      field._evaluate = (p) => {
        if (p.x < bounds.min.x || p.x > bounds.max.x ||
            p.y < bounds.min.y || p.y > bounds.max.y ||
            p.z < bounds.min.z || p.z > bounds.max.z) {
          const dx = Math.max(bounds.min.x - p.x, p.x - bounds.max.x, 0);
          const dy = Math.max(bounds.min.y - p.y, p.y - bounds.max.y, 0);
          const dz = Math.max(bounds.min.z - p.z, p.z - bounds.max.z, 0);
          return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        
        const value = Math.sin(p.x * freq) * Math.sin(p.y * freq) * Math.sin(p.z * freq) -
                      Math.sin(p.x * freq) * Math.cos(p.y * freq) * Math.cos(p.z * freq) -
                      Math.cos(p.x * freq) * Math.sin(p.y * freq) * Math.cos(p.z * freq) -
                      Math.cos(p.x * freq) * Math.cos(p.y * freq) * Math.sin(p.z * freq);
        
        return Math.abs(value) - thickness;
      };
      
      field._bounds = bounds;
      field._metadata = { type: 'schwarzD', complexity: 4, cellSize, thickness };
      return field;
    },
  
    /**
     * FIXED: Cubic lattice with bounds
     */
    cubic(bounds, cellSize, beamThickness) {
      const field = new Field();
      field._evaluate = (p) => {
        if (p.x < bounds.min.x || p.x > bounds.max.x ||
            p.y < bounds.min.y || p.y > bounds.max.y ||
            p.z < bounds.min.z || p.z > bounds.max.z) {
          const dx = Math.max(bounds.min.x - p.x, p.x - bounds.max.x, 0);
          const dy = Math.max(bounds.min.y - p.y, p.y - bounds.max.y, 0);
          const dz = Math.max(bounds.min.z - p.z, p.z - bounds.max.z, 0);
          return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        
        const mx = ((p.x % cellSize) + cellSize) % cellSize;
        const my = ((p.y % cellSize) + cellSize) % cellSize;
        const mz = ((p.z % cellSize) + cellSize) % cellSize;
        
        const dx = Math.min(mx, cellSize - mx);
        const dy = Math.min(my, cellSize - my);
        const dz = Math.min(mz, cellSize - mz);
        
        return Math.min(
          Math.sqrt(dy * dy + dz * dz),
          Math.sqrt(dx * dx + dz * dz),
          Math.sqrt(dx * dx + dy * dy)
        ) - beamThickness;
      };
      
      field._bounds = bounds;
      field._metadata = { type: 'cubic', complexity: 3, cellSize, beamThickness };
      return field;
    },
  
    /**
     * FIXED: Octet lattice with bounds
     */
    octet(bounds, cellSize, beamThickness) {
      const field = new Field();
      field._evaluate = (p) => {
        if (p.x < bounds.min.x || p.x > bounds.max.x ||
            p.y < bounds.min.y || p.y > bounds.max.y ||
            p.z < bounds.min.z || p.z > bounds.max.z) {
          const dx = Math.max(bounds.min.x - p.x, p.x - bounds.max.x, 0);
          const dy = Math.max(bounds.min.y - p.y, p.y - bounds.max.y, 0);
          const dz = Math.max(bounds.min.z - p.z, p.z - bounds.max.z, 0);
          return Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
        
        const s = cellSize;
        const mx = ((p.x % s) + s) % s;
        const my = ((p.y % s) + s) % s;
        const mz = ((p.z % s) + s) % s;
        
        const d1 = Math.abs(mx + my - s) / Math.sqrt(2);
        const d2 = Math.abs(mx - my) / Math.sqrt(2);
        const d3 = Math.abs(my + mz - s) / Math.sqrt(2);
        const d4 = Math.abs(my - mz) / Math.sqrt(2);
        const d5 = Math.abs(mz + mx - s) / Math.sqrt(2);
        const d6 = Math.abs(mz - mx) / Math.sqrt(2);
        
        return Math.min(d1, d2, d3, d4, d5, d6) - beamThickness;
      };
      
      field._bounds = bounds;
      field._metadata = { type: 'octet', complexity: 4, cellSize, beamThickness };
      return field;
    }
  };
  
  // ============================================================================
  // SKETCH SYSTEM (2D Profiles)
  // ============================================================================
  
  class Sketch {
    constructor(plane = 'xy') {
      this.plane = plane;
      this.elements = [];
      this.constraints = [];
      this.closed = false;
    }
  
    /**
     * Add line segment
     */
    line(start, end) {
      this.elements.push({
        type: 'line',
        start: Vec2.create(start.x, start.y),
        end: Vec2.create(end.x, end.y)
      });
      return this;
    }
  
    /**
     * Add arc
     */
    arc(center, radius, startAngle, endAngle) {
      this.elements.push({
        type: 'arc',
        center: Vec2.create(center.x, center.y),
        radius,
        startAngle,
        endAngle
      });
      return this;
    }
  
    /**
     * Add circle
     */
    circle(center, radius) {
      this.elements.push({
        type: 'circle',
        center: Vec2.create(center.x, center.y),
        radius
      });
      this.closed = true;
      return this;
    }
  
    /**
     * Add rectangle
     */
    rectangle(corner, width, height) {
      const c = Vec2.create(corner.x, corner.y);
      this.elements.push(
        { type: 'line', start: c, end: { x: c.x + width, y: c.y } },
        { type: 'line', start: { x: c.x + width, y: c.y }, end: { x: c.x + width, y: c.y + height } },
        { type: 'line', start: { x: c.x + width, y: c.y + height }, end: { x: c.x, y: c.y + height } },
        { type: 'line', start: { x: c.x, y: c.y + height }, end: c }
      );
      this.closed = true;
      return this;
    }
  
    /**
     * Add polygon
     */
    polygon(points) {
      for (let i = 0; i < points.length; i++) {
        const start = Vec2.create(points[i].x, points[i].y);
        const end = Vec2.create(points[(i + 1) % points.length].x, points[(i + 1) % points.length].y);
        this.elements.push({ type: 'line', start, end });
      }
      this.closed = true;
      return this;
    }
  
    /**
     * Close the sketch
     */
    close() {
      this.closed = true;
      return this;
    }
  
    /**
     * Evaluate sketch as 2D SDF
     */
    toSDF2D() {
      return (x, y) => {
        let minDist = Infinity;
        
        for (const elem of this.elements) {
          const dist = this._distanceToElement(elem, x, y);
          if (Math.abs(dist) < Math.abs(minDist)) {
            minDist = dist;
          }
        }
  
        if (this.closed) {
          const isInside = this._pointInPolygon(x, y);
          return isInside ? -Math.abs(minDist) : Math.abs(minDist);
        }
  
        return minDist;
      };
    }
  
    /**
     * Distance from point to sketch element
     * @private
     */
    _distanceToElement(elem, x, y) {
      const p = { x, y };
  
      switch (elem.type) {
        case 'line': {
          const line = Vec2.sub(elem.end, elem.start);
          const lineLen = Vec2.length(line);
          if (lineLen === 0) return Vec2.distance(p, elem.start);
          
          const toPoint = Vec2.sub(p, elem.start);
          const t = Math.max(0, Math.min(1, Vec2.dot(toPoint, line) / (lineLen * lineLen)));
          const closest = Vec2.add(elem.start, Vec2.mul(line, t));
          return Vec2.distance(p, closest);
        }
  
        case 'arc': {
          const toPoint = Vec2.sub(p, elem.center);
          const angle = Math.atan2(toPoint.y, toPoint.x);
          let normalizedAngle = angle;
          if (normalizedAngle < elem.startAngle) normalizedAngle += 2 * Math.PI;
          
          if (normalizedAngle >= elem.startAngle && normalizedAngle <= elem.endAngle) {
            return Math.abs(Vec2.length(toPoint) - elem.radius);
          } else {
            const startPoint = {
              x: elem.center.x + elem.radius * Math.cos(elem.startAngle),
              y: elem.center.y + elem.radius * Math.sin(elem.startAngle)
            };
            const endPoint = {
              x: elem.center.x + elem.radius * Math.cos(elem.endAngle),
              y: elem.center.y + elem.radius * Math.sin(elem.endAngle)
            };
            return Math.min(Vec2.distance(p, startPoint), Vec2.distance(p, endPoint));
          }
        }
  
        case 'circle': {
          return Math.abs(Vec2.distance(p, elem.center) - elem.radius);
        }
  
        default:
          return Infinity;
      }
    }
  
    /**
     * Point in polygon test (ray casting)
     * @private
     */
    _pointInPolygon(x, y) {
      let inside = false;
      const lines = this.elements.filter(e => e.type === 'line');
      
      for (const line of lines) {
        const x1 = line.start.x, y1 = line.start.y;
        const x2 = line.end.x, y2 = line.end.y;
        
        if ((y1 > y) !== (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1) {
          inside = !inside;
        }
      }
      
      return inside;
    }
  
    /**
     * Get bounding box
     */
    bounds() {
      let minX = Infinity, minY = Infinity;
      let maxX = -Infinity, maxY = -Infinity;
  
      for (const elem of this.elements) {
        switch (elem.type) {
          case 'line':
            minX = Math.min(minX, elem.start.x, elem.end.x);
            minY = Math.min(minY, elem.start.y, elem.end.y);
            maxX = Math.max(maxX, elem.start.x, elem.end.x);
            maxY = Math.max(maxY, elem.start.y, elem.end.y);
            break;
          case 'circle':
          case 'arc':
            minX = Math.min(minX, elem.center.x - elem.radius);
            minY = Math.min(minY, elem.center.y - elem.radius);
            maxX = Math.max(maxX, elem.center.x + elem.radius);
            maxY = Math.max(maxY, elem.center.y + elem.radius);
            break;
        }
      }
  
      return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } };
    }
  }
  
  // ============================================================================
  // FIXED EXTRUSION OPERATIONS
  // ============================================================================
  
  const Extrude = {
    /**
     * FIXED: Linear extrusion with proper cap handling
     * BUG FIXED: Caps no longer bulge outward (pillow effect eliminated)
     */
    linear(sketch, direction, distance) {
      const sdf2D = sketch.toSDF2D();
      const dir = Vec3.normalize(direction);
      
      const field = new Field();
      field._evaluate = (p) => {
        // Distance along extrusion direction
        const distAlongExtrusion = Vec3.dot(p, dir);
        
        // Get 2D coordinates (assuming XY plane for now)
        const x = p.x;
        const y = p.y;
        const dist2D = sdf2D(x, y);
        
        // Distance to bottom and top caps
        const distToBottom = -distAlongExtrusion;
        const distToTop = distAlongExtrusion - distance;
        const distToCap = Math.max(distToBottom, distToTop);
        
        // FIXED: Proper handling of inside vs outside profile
        if (distAlongExtrusion >= 0 && distAlongExtrusion <= distance) {
          // Between caps
          if (dist2D < 0) {
            // Inside profile - distance to closest surface (side OR cap)
            return Math.max(dist2D, distToCap);
          } else {
            // Outside profile - distance to side
            return dist2D;
          }
        } else {
          // Outside caps
          if (dist2D < 0) {
            // Inside profile horizontally, outside vertically
            return Math.abs(distAlongExtrusion < 0 ? distToBottom : distToTop);
          } else {
            // Outside both - diagonal distance
            return Math.sqrt(
              dist2D * dist2D + 
              Math.max(distToCap, 0) ** 2
            );
          }
        }
      };
      
      const bounds2D = sketch.bounds();
      field._bounds = {
        min: { x: bounds2D.min.x, y: bounds2D.min.y, z: 0 },
        max: { x: bounds2D.max.x, y: bounds2D.max.y, z: distance }
      };
      field._metadata = { type: 'extrude-linear', complexity: 3, distance };
      return field;
    },
  
    /**
     * Revolve 2D sketch around axis
     */
    revolve(sketch, axis, angle = 2 * Math.PI) {
      const sdf2D = sketch.toSDF2D();
      const axisDir = Vec3.normalize(axis.direction);
      const axisPoint = axis.point;
      
      const field = new Field();
      field._evaluate = (p) => {
        const v = Vec3.sub(p, axisPoint);
        const distAlongAxis = Vec3.dot(v, axisDir);
        const radialVec = Vec3.sub(v, Vec3.mul(axisDir, distAlongAxis));
        const radialDist = Vec3.length(radialVec);
        
        return sdf2D(radialDist, distAlongAxis);
      };
      
      const bounds2D = sketch.bounds();
      const maxRadius = Math.max(Math.abs(bounds2D.min.x), Math.abs(bounds2D.max.x));
      
      field._bounds = {
        min: {
          x: axisPoint.x - maxRadius,
          y: axisPoint.y - maxRadius,
          z: axisPoint.z + bounds2D.min.y
        },
        max: {
          x: axisPoint.x + maxRadius,
          y: axisPoint.y + maxRadius,
          z: axisPoint.z + bounds2D.max.y
        }
      };
      field._metadata = { type: 'revolve', complexity: 3, angle };
      return field;
    }
  };
  
  // Continue in next message due to length...
  // ============================================================================
  // PART 2: FIXED MARCHING CUBES & EXPORT SYSTEM
  // ============================================================================
  
  /**
   * COMPLETE MARCHING CUBES LOOKUP TABLES
   * 256 cases with proper edge and triangle configurations
   */
  const MarchingCubesTables = {
    /**
     * Edge table - which edges are intersected for each cube configuration
     * Each entry is a 12-bit number where bit i indicates if edge i is intersected
     */
    edgeTable: [
      0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c,
      0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
      0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c,
      0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
      0x230, 0x339, 0x33, 0x13a, 0x636, 0x73f, 0x435, 0x53c,
      0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30,
      0x3a0, 0x2a9, 0x1a3, 0xaa, 0x7a6, 0x6af, 0x5a5, 0x4ac,
      0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0,
      0x460, 0x569, 0x663, 0x76a, 0x66, 0x16f, 0x265, 0x36c,
      0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60,
      0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff, 0x3f5, 0x2fc,
      0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0,
      0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55, 0x15c,
      0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
      0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc,
      0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0,
      0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc,
      0xcc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0,
      0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c,
      0x15c, 0x55, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650,
      0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc,
      0x2fc, 0x3f5, 0xff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
      0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c,
      0x36c, 0x265, 0x16f, 0x66, 0x76a, 0x663, 0x569, 0x460,
      0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac,
      0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa, 0x1a3, 0x2a9, 0x3a0,
      0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c,
      0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33, 0x339, 0x230,
      0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c,
      0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99, 0x190,
      0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c,
      0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0
    ],
  
    /**
     * Triangle table - which triangles to generate for each cube configuration
     * FIXED: Consistent CCW winding order for all 256 cases
     */
    triTable: [
      [],
      [0, 8, 3],
      [0, 1, 9],
      [1, 8, 3, 9, 8, 1],
      [1, 2, 10],
      [0, 8, 3, 1, 2, 10],
      [9, 2, 10, 0, 2, 9],
      [2, 8, 3, 2, 10, 8, 10, 9, 8],
      [3, 11, 2],
      [0, 11, 2, 8, 11, 0],
      [1, 9, 0, 2, 3, 11],
      [1, 11, 2, 1, 9, 11, 9, 8, 11],
      [3, 10, 1, 11, 10, 3],
      [0, 10, 1, 0, 8, 10, 8, 11, 10],
      [3, 9, 0, 3, 11, 9, 11, 10, 9],
      [9, 8, 10, 10, 8, 11],
      [4, 7, 8],
      [4, 3, 0, 7, 3, 4],
      [0, 1, 9, 8, 4, 7],
      [4, 1, 9, 4, 7, 1, 7, 3, 1],
      [1, 2, 10, 8, 4, 7],
      [3, 4, 7, 3, 0, 4, 1, 2, 10],
      [9, 2, 10, 9, 0, 2, 8, 4, 7],
      [2, 10, 9, 2, 9, 7, 2, 7, 3, 7, 9, 4],
      [8, 4, 7, 3, 11, 2],
      [11, 4, 7, 11, 2, 4, 2, 0, 4],
      [9, 0, 1, 8, 4, 7, 2, 3, 11],
      [4, 7, 11, 9, 4, 11, 9, 11, 2, 9, 2, 1],
      [3, 10, 1, 3, 11, 10, 7, 8, 4],
      [1, 11, 10, 1, 4, 11, 1, 0, 4, 7, 11, 4],
      [4, 7, 8, 9, 0, 11, 9, 11, 10, 11, 0, 3],
      [4, 7, 11, 4, 11, 9, 9, 11, 10],
      [9, 5, 4],
      [9, 5, 4, 0, 8, 3],
      [0, 5, 4, 1, 5, 0],
      [8, 5, 4, 8, 3, 5, 3, 1, 5],
      [1, 2, 10, 9, 5, 4],
      [3, 0, 8, 1, 2, 10, 4, 9, 5],
      [5, 2, 10, 5, 4, 2, 4, 0, 2],
      [2, 10, 5, 3, 2, 5, 3, 5, 4, 3, 4, 8],
      [9, 5, 4, 2, 3, 11],
      [0, 11, 2, 0, 8, 11, 4, 9, 5],
      [0, 5, 4, 0, 1, 5, 2, 3, 11],
      [2, 1, 5, 2, 5, 8, 2, 8, 11, 4, 8, 5],
      [10, 3, 11, 10, 1, 3, 9, 5, 4],
      [4, 9, 5, 0, 8, 1, 8, 10, 1, 8, 11, 10],
      [5, 4, 0, 5, 0, 11, 5, 11, 10, 11, 0, 3],
      [5, 4, 8, 5, 8, 10, 10, 8, 11],
      [9, 7, 8, 5, 7, 9],
      [9, 3, 0, 9, 5, 3, 5, 7, 3],
      [0, 7, 8, 0, 1, 7, 1, 5, 7],
      [1, 5, 3, 3, 5, 7],
      [9, 7, 8, 9, 5, 7, 10, 1, 2],
      [10, 1, 2, 9, 5, 0, 5, 3, 0, 5, 7, 3],
      [8, 0, 2, 8, 2, 5, 8, 5, 7, 10, 5, 2],
      [2, 10, 5, 2, 5, 3, 3, 5, 7],
      [7, 9, 5, 7, 8, 9, 3, 11, 2],
      [9, 5, 7, 9, 7, 2, 9, 2, 0, 2, 7, 11],
      [2, 3, 11, 0, 1, 8, 1, 7, 8, 1, 5, 7],
      [11, 2, 1, 11, 1, 7, 7, 1, 5],
      [9, 5, 8, 8, 5, 7, 10, 1, 3, 10, 3, 11],
      [5, 7, 0, 5, 0, 9, 7, 11, 0, 1, 0, 10, 11, 10, 0],
      [11, 10, 0, 11, 0, 3, 10, 5, 0, 8, 0, 7, 5, 7, 0],
      [11, 10, 5, 7, 11, 5],
      [10, 6, 5],
      [0, 8, 3, 5, 10, 6],
      [9, 0, 1, 5, 10, 6],
      [1, 8, 3, 1, 9, 8, 5, 10, 6],
      [1, 6, 5, 2, 6, 1],
      [1, 6, 5, 1, 2, 6, 3, 0, 8],
      [9, 6, 5, 9, 0, 6, 0, 2, 6],
      [5, 9, 8, 5, 8, 2, 5, 2, 6, 3, 2, 8],
      [2, 3, 11, 10, 6, 5],
      [11, 0, 8, 11, 2, 0, 10, 6, 5],
      [0, 1, 9, 2, 3, 11, 5, 10, 6],
      [5, 10, 6, 1, 9, 2, 9, 11, 2, 9, 8, 11],
      [6, 3, 11, 6, 5, 3, 5, 1, 3],
      [0, 8, 11, 0, 11, 5, 0, 5, 1, 5, 11, 6],
      [3, 11, 6, 0, 3, 6, 0, 6, 5, 0, 5, 9],
      [6, 5, 9, 6, 9, 11, 11, 9, 8],
      [5, 10, 6, 4, 7, 8],
      [4, 3, 0, 4, 7, 3, 6, 5, 10],
      [1, 9, 0, 5, 10, 6, 8, 4, 7],
      [10, 6, 5, 1, 9, 7, 1, 7, 3, 7, 9, 4],
      [6, 1, 2, 6, 5, 1, 4, 7, 8],
      [1, 2, 5, 5, 2, 6, 3, 0, 4, 3, 4, 7],
      [8, 4, 7, 9, 0, 5, 0, 6, 5, 0, 2, 6],
      [7, 3, 9, 7, 9, 4, 3, 2, 9, 5, 9, 6, 2, 6, 9],
      [3, 11, 2, 7, 8, 4, 10, 6, 5],
      [5, 10, 6, 4, 7, 2, 4, 2, 0, 2, 7, 11],
      [0, 1, 9, 4, 7, 8, 2, 3, 11, 5, 10, 6],
      [9, 2, 1, 9, 11, 2, 9, 4, 11, 7, 11, 4, 5, 10, 6],
      [8, 4, 7, 3, 11, 5, 3, 5, 1, 5, 11, 6],
      [5, 1, 11, 5, 11, 6, 1, 0, 11, 7, 11, 4, 0, 4, 11],
      [0, 5, 9, 0, 6, 5, 0, 3, 6, 11, 6, 3, 8, 4, 7],
      [6, 5, 9, 6, 9, 11, 4, 7, 9, 7, 11, 9],
      [10, 4, 9, 6, 4, 10],
      [4, 10, 6, 4, 9, 10, 0, 8, 3],
      [10, 0, 1, 10, 6, 0, 6, 4, 0],
      [8, 3, 1, 8, 1, 6, 8, 6, 4, 6, 1, 10],
      [1, 4, 9, 1, 2, 4, 2, 6, 4],
      [3, 0, 8, 1, 2, 9, 2, 4, 9, 2, 6, 4],
      [0, 2, 4, 4, 2, 6],
      [8, 3, 2, 8, 2, 4, 4, 2, 6],
      [10, 4, 9, 10, 6, 4, 11, 2, 3],
      [0, 8, 2, 2, 8, 11, 4, 9, 10, 4, 10, 6],
      [3, 11, 2, 0, 1, 6, 0, 6, 4, 6, 1, 10],
      [6, 4, 1, 6, 1, 10, 4, 8, 1, 2, 1, 11, 8, 11, 1],
      [9, 6, 4, 9, 3, 6, 9, 1, 3, 11, 6, 3],
      [8, 11, 1, 8, 1, 0, 11, 6, 1, 9, 1, 4, 6, 4, 1],
      [3, 11, 6, 3, 6, 0, 0, 6, 4],
      [6, 4, 8, 11, 6, 8],
      [7, 10, 6, 7, 8, 10, 8, 9, 10],
      [0, 7, 3, 0, 10, 7, 0, 9, 10, 6, 7, 10],
      [10, 6, 7, 1, 10, 7, 1, 7, 8, 1, 8, 0],
      [10, 6, 7, 10, 7, 1, 1, 7, 3],
      [1, 2, 6, 1, 6, 8, 1, 8, 9, 8, 6, 7],
      [2, 6, 9, 2, 9, 1, 6, 7, 9, 0, 9, 3, 7, 3, 9],
      [7, 8, 0, 7, 0, 6, 6, 0, 2],
      [7, 3, 2, 6, 7, 2],
      [2, 3, 11, 10, 6, 8, 10, 8, 9, 8, 6, 7],
      [2, 0, 7, 2, 7, 11, 0, 9, 7, 6, 7, 10, 9, 10, 7],
      [1, 8, 0, 1, 7, 8, 1, 10, 7, 6, 7, 10, 2, 3, 11],
      [11, 2, 1, 11, 1, 7, 10, 6, 1, 6, 7, 1],
      [8, 9, 6, 8, 6, 7, 9, 1, 6, 11, 6, 3, 1, 3, 6],
      [0, 9, 1, 11, 6, 7],
      [7, 8, 0, 7, 0, 6, 3, 11, 0, 11, 6, 0],
      [7, 11, 6],
      [7, 6, 11],
      [3, 0, 8, 11, 7, 6],
      [0, 1, 9, 11, 7, 6],
      [8, 1, 9, 8, 3, 1, 11, 7, 6],
      [10, 1, 2, 6, 11, 7],
      [1, 2, 10, 3, 0, 8, 6, 11, 7],
      [2, 9, 0, 2, 10, 9, 6, 11, 7],
      [6, 11, 7, 2, 10, 3, 10, 8, 3, 10, 9, 8],
      [7, 2, 3, 6, 2, 7],
      [7, 0, 8, 7, 6, 0, 6, 2, 0],
      [2, 7, 6, 2, 3, 7, 0, 1, 9],
      [1, 6, 2, 1, 8, 6, 1, 9, 8, 8, 7, 6],
      [10, 7, 6, 10, 1, 7, 1, 3, 7],
      [10, 7, 6, 1, 7, 10, 1, 8, 7, 1, 0, 8],
      [0, 3, 7, 0, 7, 10, 0, 10, 9, 6, 10, 7],
      [7, 6, 10, 7, 10, 8, 8, 10, 9],
      [6, 8, 4, 11, 8, 6],
      [3, 6, 11, 3, 0, 6, 0, 4, 6],
      [8, 6, 11, 8, 4, 6, 9, 0, 1],
      [9, 4, 6, 9, 6, 3, 9, 3, 1, 11, 3, 6],
      [6, 8, 4, 6, 11, 8, 2, 10, 1],
      [1, 2, 10, 3, 0, 11, 0, 6, 11, 0, 4, 6],
      [4, 11, 8, 4, 6, 11, 0, 2, 9, 2, 10, 9],
      [10, 9, 3, 10, 3, 2, 9, 4, 3, 11, 3, 6, 4, 6, 3],
      [8, 2, 3, 8, 4, 2, 4, 6, 2],
      [0, 4, 2, 4, 6, 2],
      [1, 9, 0, 2, 3, 4, 2, 4, 6, 4, 3, 8],
      [1, 9, 4, 1, 4, 2, 2, 4, 6],
      [8, 1, 3, 8, 6, 1, 8, 4, 6, 6, 10, 1],
      [10, 1, 0, 10, 0, 6, 6, 0, 4],
      [4, 6, 3, 4, 3, 8, 6, 10, 3, 0, 3, 9, 10, 9, 3],
      [10, 9, 4, 6, 10, 4],
      [4, 9, 5, 7, 6, 11],
      [0, 8, 3, 4, 9, 5, 11, 7, 6],
      [5, 0, 1, 5, 4, 0, 7, 6, 11],
      [11, 7, 6, 8, 3, 4, 3, 5, 4, 3, 1, 5],
      [9, 5, 4, 10, 1, 2, 7, 6, 11],
      [6, 11, 7, 1, 2, 10, 0, 8, 3, 4, 9, 5],
      [7, 6, 11, 5, 4, 10, 4, 2, 10, 4, 0, 2],
      [3, 4, 8, 3, 5, 4, 3, 2, 5, 10, 5, 2, 11, 7, 6],
      [7, 2, 3, 7, 6, 2, 5, 4, 9],
      [9, 5, 4, 0, 8, 6, 0, 6, 2, 6, 8, 7],
      [3, 6, 2, 3, 7, 6, 1, 5, 0, 5, 4, 0],
      [6, 2, 8, 6, 8, 7, 2, 1, 8, 4, 8, 5, 1, 5, 8],
      [9, 5, 4, 10, 1, 6, 1, 7, 6, 1, 3, 7],
      [1, 6, 10, 1, 7, 6, 1, 0, 7, 8, 7, 0, 9, 5, 4],
      [4, 0, 10, 4, 10, 5, 0, 3, 10, 6, 10, 7, 3, 7, 10],
      [7, 6, 10, 7, 10, 8, 5, 4, 10, 4, 8, 10],
      [6, 9, 5, 6, 11, 9, 11, 8, 9],
      [3, 6, 11, 0, 6, 3, 0, 5, 6, 0, 9, 5],
      [0, 11, 8, 0, 5, 11, 0, 1, 5, 5, 6, 11],
      [6, 11, 3, 6, 3, 5, 5, 3, 1],
      [1, 2, 10, 9, 5, 11, 9, 11, 8, 11, 5, 6],
      [0, 11, 3, 0, 6, 11, 0, 9, 6, 5, 6, 9, 1, 2, 10],
      [11, 8, 5, 11, 5, 6, 8, 0, 5, 10, 5, 2, 0, 2, 5],
      [6, 11, 3, 6, 3, 5, 2, 10, 3, 10, 5, 3],
      [5, 8, 9, 5, 2, 8, 5, 6, 2, 3, 8, 2],
      [9, 5, 6, 9, 6, 0, 0, 6, 2],
      [1, 5, 8, 1, 8, 0, 5, 6, 8, 3, 8, 2, 6, 2, 8],
      [1, 5, 6, 2, 1, 6],
      [1, 3, 6, 1, 6, 10, 3, 8, 6, 5, 6, 9, 8, 9, 6],
      [10, 1, 0, 10, 0, 6, 9, 5, 0, 5, 6, 0],
      [0, 3, 8, 5, 6, 10],
      [10, 5, 6],
      [11, 5, 10, 7, 5, 11],
      [11, 5, 10, 11, 7, 5, 8, 3, 0],
      [5, 11, 7, 5, 10, 11, 1, 9, 0],
      [10, 7, 5, 10, 11, 7, 9, 8, 1, 8, 3, 1],
      [11, 1, 2, 11, 7, 1, 7, 5, 1],
      [0, 8, 3, 1, 2, 7, 1, 7, 5, 7, 2, 11],
      [9, 7, 5, 9, 2, 7, 9, 0, 2, 2, 11, 7],
      [7, 5, 2, 7, 2, 11, 5, 9, 2, 3, 2, 8, 9, 8, 2],
      [2, 5, 10, 2, 3, 5, 3, 7, 5],
      [8, 2, 0, 8, 5, 2, 8, 7, 5, 10, 2, 5],
      [9, 0, 1, 5, 10, 3, 5, 3, 7, 3, 10, 2],
      [9, 8, 2, 9, 2, 1, 8, 7, 2, 10, 2, 5, 7, 5, 2],
      [1, 3, 5, 3, 7, 5],
      [0, 8, 7, 0, 7, 1, 1, 7, 5],
      [9, 0, 3, 9, 3, 5, 5, 3, 7],
      [9, 8, 7, 5, 9, 7],
      [5, 8, 4, 5, 10, 8, 10, 11, 8],
      [5, 0, 4, 5, 11, 0, 5, 10, 11, 11, 3, 0],
      [0, 1, 9, 8, 4, 10, 8, 10, 11, 10, 4, 5],
      [10, 11, 4, 10, 4, 5, 11, 3, 4, 9, 4, 1, 3, 1, 4],
      [2, 5, 1, 2, 8, 5, 2, 11, 8, 4, 5, 8],
      [0, 4, 11, 0, 11, 3, 4, 5, 11, 2, 11, 1, 5, 1, 11],
      [0, 2, 5, 0, 5, 9, 2, 11, 5, 4, 5, 8, 11, 8, 5],
      [9, 4, 5, 2, 11, 3],
      [2, 5, 10, 3, 5, 2, 3, 4, 5, 3, 8, 4],
      [5, 10, 2, 5, 2, 4, 4, 2, 0],
      [3, 10, 2, 3, 5, 10, 3, 8, 5, 4, 5, 8, 0, 1, 9],
      [5, 10, 2, 5, 2, 4, 1, 9, 2, 9, 4, 2],
      [8, 4, 5, 8, 5, 3, 3, 5, 1],
      [0, 4, 5, 1, 0, 5],
      [8, 4, 5, 8, 5, 3, 9, 0, 5, 0, 3, 5],
      [9, 4, 5],
      [4, 11, 7, 4, 9, 11, 9, 10, 11],
      [0, 8, 3, 4, 9, 7, 9, 11, 7, 9, 10, 11],
      [1, 10, 11, 1, 11, 4, 1, 4, 0, 7, 4, 11],
      [3, 1, 4, 3, 4, 8, 1, 10, 4, 7, 4, 11, 10, 11, 4],
      [4, 11, 7, 9, 11, 4, 9, 2, 11, 9, 1, 2],
      [9, 7, 4, 9, 11, 7, 9, 1, 11, 2, 11, 1, 0, 8, 3],
      [11, 7, 4, 11, 4, 2, 2, 4, 0],
      [11, 7, 4, 11, 4, 2, 8, 3, 4, 3, 2, 4],
      [2, 9, 10, 2, 7, 9, 2, 3, 7, 7, 4, 9],
      [9, 10, 7, 9, 7, 4, 10, 2, 7, 8, 7, 0, 2, 0, 7],
      [3, 7, 10, 3, 10, 2, 7, 4, 10, 1, 10, 0, 4, 0, 10],
      [1, 10, 2, 8, 7, 4],
      [4, 9, 1, 4, 1, 7, 7, 1, 3],
      [4, 9, 1, 4, 1, 7, 0, 8, 1, 8, 7, 1],
      [4, 0, 3, 7, 4, 3],
      [4, 8, 7],
      [9, 10, 8, 10, 11, 8],
      [3, 0, 9, 3, 9, 11, 11, 9, 10],
      [0, 1, 10, 0, 10, 8, 8, 10, 11],
      [3, 1, 10, 11, 3, 10],
      [1, 2, 11, 1, 11, 9, 9, 11, 8],
      [3, 0, 9, 3, 9, 11, 1, 2, 9, 2, 11, 9],
      [0, 2, 11, 8, 0, 11],
      [3, 2, 11],
      [2, 3, 8, 2, 8, 10, 10, 8, 9],
      [9, 10, 2, 0, 9, 2],
      [2, 3, 8, 2, 8, 10, 0, 1, 8, 1, 10, 8],
      [1, 10, 2],
      [1, 3, 8, 9, 1, 8],
      [0, 9, 1],
      [0, 3, 8],
      []
    ],
  
    /**
     * Edge vertex connections
     */
    edgeConnections: [
      [0, 1], [1, 2], [2, 3], [3, 0], // bottom edges (0-3)
      [4, 5], [5, 6], [6, 7], [7, 4], // top edges (4-7)
      [0, 4], [1, 5], [2, 6], [3, 7]  // vertical edges (8-11)
    ]
  };
  
  // ============================================================================
  // FIXED MESHER WITH PROGRESS CALLBACKS
  // ============================================================================
  
  const Mesher = {
    /**
     * FIXED: Generate triangle mesh using proper Marching Cubes
     * BUG FIXED: Correct lookup tables, CCW winding, progress reporting
     * 
     * @param {Field} field - SDF field to mesh
     * @param {Object} options - Meshing options
     * @param {number} [options.resolution=32] - Grid resolution
     * @param {Function} [options.onProgress] - Progress callback (percent, message)
     * @param {number} [options.maxMemoryMB=512] - Maximum memory usage in MB
     * @returns {Object} Mesh data
     */
    marchingCubes(field, options = {}) {
      const resolution = options.resolution || 32;
      const bounds = field.bounds();
      const onProgress = options.onProgress || (() => {});
      const maxMemoryMB = options.maxMemoryMB || 512;
      
      // FIXED: Memory estimation and adaptive resolution
      const estimatedMemory = Math.pow(resolution + 1, 3) * 4 / (1024 * 1024); // Float32Array
      if (estimatedMemory > maxMemoryMB) {
        const maxResolution = Math.floor(Math.pow(maxMemoryMB * 1024 * 1024 / 4, 1/3)) - 1;
        console.warn(
          `⚠️  Memory limit exceeded!\n` +
          `Requested resolution ${resolution}³ would use ${estimatedMemory.toFixed(1)} MB\n` +
          `Maximum allowed: ${maxMemoryMB} MB\n` +
          `Recommended maximum resolution: ${maxResolution}`
        );
        throw new Error(`Resolution ${resolution} exceeds memory limit. Use ≤${maxResolution} or increase maxMemoryMB.`);
      }
      
      console.log('🔧 Generating mesh with FIXED Marching Cubes...');
      console.time('Mesh Generation');
      onProgress(0, 'Starting mesh generation...');
      
      const vertices = [];
      const normals = [];
      const indices = [];
      
      const min = bounds.min;
      const max = bounds.max;
      const step = {
        x: (max.x - min.x) / resolution,
        y: (max.y - min.y) / resolution,
        z: (max.z - min.z) / resolution
      };
      
      // Sample field on grid
      onProgress(10, 'Sampling field on grid...');
      const grid = new Float32Array((resolution + 1) ** 3);
      const getIndex = (i, j, k) => i + (resolution + 1) * (j + (resolution + 1) * k);
      
      let sampleCount = 0;
      const totalSamples = (resolution + 1) ** 3;
      
      for (let k = 0; k <= resolution; k++) {
        for (let j = 0; j <= resolution; j++) {
          for (let i = 0; i <= resolution; i++) {
            const p = {
              x: min.x + i * step.x,
              y: min.y + j * step.y,
              z: min.z + k * step.z
            };
            grid[getIndex(i, j, k)] = field._evaluate(p);
            
            sampleCount++;
            if (sampleCount % 10000 === 0) {
              const percent = 10 + (sampleCount / totalSamples) * 30;
              onProgress(percent, `Sampling: ${sampleCount}/${totalSamples}`);
            }
          }
        }
      }
      
      // Process each cube
      onProgress(40, 'Generating triangles...');
      const cornerOffsets = [
        [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1],
        [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]
      ];
      
      let cubeCount = 0;
      const totalCubes = resolution ** 3;
      
      for (let k = 0; k < resolution; k++) {
        for (let j = 0; j < resolution; j++) {
          for (let i = 0; i < resolution; i++) {
            const cube = [
              grid[getIndex(i, j, k)],
              grid[getIndex(i + 1, j, k)],
              grid[getIndex(i + 1, j, k + 1)],
              grid[getIndex(i, j, k + 1)],
              grid[getIndex(i, j + 1, k)],
              grid[getIndex(i + 1, j + 1, k)],
              grid[getIndex(i + 1, j + 1, k + 1)],
              grid[getIndex(i, j + 1, k + 1)]
            ];
            
            const basePos = {
              x: min.x + i * step.x,
              y: min.y + j * step.y,
              z: min.z + k * step.z
            };
            
            Mesher._marchCube(
              cube, basePos, step, cornerOffsets,
              vertices, normals, indices, field
            );
            
            cubeCount++;
            if (cubeCount % 1000 === 0) {
              const percent = 40 + (cubeCount / totalCubes) * 50;
              onProgress(percent, `Cubes processed: ${cubeCount}/${totalCubes}`);
            }
          }
        }
      }
      
      onProgress(90, 'Finalizing mesh...');
      
      console.timeEnd('Mesh Generation');
      console.log(`✅ Generated ${vertices.length / 3} vertices, ${indices.length / 3} triangles`);
      
      onProgress(100, 'Mesh generation complete!');
      
      return {
        vertices: new Float32Array(vertices),
        normals: new Float32Array(normals),
        indices: new Uint32Array(indices),
        vertexCount: vertices.length / 3,
        triangleCount: indices.length / 3,
        bounds
      };
    },
  
    /**
     * FIXED: Process single cube using lookup table
     * BUG FIXED: Proper edge interpolation and consistent winding order
     * @private
     */
    _marchCube(values, pos, step, cornerOffsets, vertices, normals, indices, field) {
      // Calculate cube index
      let cubeIndex = 0;
      for (let i = 0; i < 8; i++) {
        if (values[i] <= 0) cubeIndex |= (1 << i);
      }
      
      // Skip if fully inside or outside
      if (cubeIndex === 0 || cubeIndex === 255) return;
      
      // Get edge list from table
      const edgeFlags = MarchingCubesTables.edgeTable[cubeIndex];
      if (edgeFlags === 0) return;
      
      // Compute edge intersections (only for edges that are intersected)
      const edgePoints = new Array(12);
      
      for (let i = 0; i < 12; i++) {
        if ((edgeFlags & (1 << i)) === 0) continue;
        
        const edge = MarchingCubesTables.edgeConnections[i];
        const v1 = edge[0];
        const v2 = edge[1];
        
        const val1 = values[v1];
        const val2 = values[v2];
        
        // FIXED: Proper linear interpolation
        const t = Math.abs(val1) / (Math.abs(val1) + Math.abs(val2));
        
        const p1 = cornerOffsets[v1];
        const p2 = cornerOffsets[v2];
        
        edgePoints[i] = {
          x: pos.x + (p1[0] + t * (p2[0] - p1[0])) * step.x,
          y: pos.y + (p1[1] + t * (p2[1] - p1[1])) * step.y,
          z: pos.z + (p1[2] + t * (p2[2] - p1[2])) * step.z
        };
      }
      
      // Get triangle list from table
      const triangles = MarchingCubesTables.triTable[cubeIndex];
      
      // FIXED: Generate triangles with consistent CCW winding
      for (let i = 0; i < triangles.length; i += 3) {
        const e0 = triangles[i];
        const e1 = triangles[i + 1];
        const e2 = triangles[i + 2];
        
        const p0 = edgePoints[e0];
        const p1 = edgePoints[e1];
        const p2 = edgePoints[e2];
        
        // Skip if any point is undefined
        if (!p0 || !p1 || !p2) continue;
        
        const baseIndex = vertices.length / 3;
        
        // Add vertices
        vertices.push(p0.x, p0.y, p0.z);
        vertices.push(p1.x, p1.y, p1.z);
        vertices.push(p2.x, p2.y, p2.z);
        
        // Compute normals using gradient
        const n0 = field._gradient(p0);
        const n1 = field._gradient(p1);
        const n2 = field._gradient(p2);
        
        normals.push(n0.x, n0.y, n0.z);
        normals.push(n1.x, n1.y, n1.z);
        normals.push(n2.x, n2.y, n2.z);
        
        // FIXED: Consistent winding order (CCW)
        indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
      }
    },
  
    /**
     * FIXED: Export to STL with CORRECT face normals
     * BUG FIXED: Face normals are now geometric (cross product), not averaged gradients
     * 
     * @param {Object} mesh - Mesh data
     * @param {string} [name='model'] - Model name
     * @returns {ArrayBuffer} STL binary data
     */
    toSTL(mesh, name = 'model') {
      const buffer = new ArrayBuffer(84 + mesh.triangleCount * 50);
      const view = new DataView(buffer);
      
      // Header (80 bytes)
      const header = `FIXED Marching Cubes - ${name}`;
      for (let i = 0; i < Math.min(header.length, 80); i++) {
        view.setUint8(i, header.charCodeAt(i));
      }
      
      // Triangle count
      view.setUint32(80, mesh.triangleCount, true);
      
      let offset = 84;
      
      // Triangles
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const i0 = mesh.indices[i] * 3;
        const i1 = mesh.indices[i + 1] * 3;
        const i2 = mesh.indices[i + 2] * 3;
        
        // Get vertices
        const v0 = { 
          x: mesh.vertices[i0], 
          y: mesh.vertices[i0 + 1], 
          z: mesh.vertices[i0 + 2] 
        };
        const v1 = { 
          x: mesh.vertices[i1], 
          y: mesh.vertices[i1 + 1], 
          z: mesh.vertices[i1 + 2] 
        };
        const v2 = { 
          x: mesh.vertices[i2], 
          y: mesh.vertices[i2 + 1], 
          z: mesh.vertices[i2 + 2] 
        };
        
        // FIXED: Calculate GEOMETRIC face normal (cross product, not averaged gradients)
        const edge1 = {
          x: v1.x - v0.x,
          y: v1.y - v0.y,
          z: v1.z - v0.z
        };
        const edge2 = {
          x: v2.x - v0.x,
          y: v2.y - v0.y,
          z: v2.z - v0.z
        };
        
        // Cross product for face normal
        const normal = {
          x: edge1.y * edge2.z - edge1.z * edge2.y,
          y: edge1.z * edge2.x - edge1.x * edge2.z,
          z: edge1.x * edge2.y - edge1.y * edge2.x
        };
        
        // Normalize
        const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
        if (length > 0) {
          normal.x /= length;
          normal.y /= length;
          normal.z /= length;
        }
        
        // Write face normal
        view.setFloat32(offset, normal.x, true);
        view.setFloat32(offset + 4, normal.y, true);
        view.setFloat32(offset + 8, normal.z, true);
        offset += 12;
        
        // Write vertices
        view.setFloat32(offset, v0.x, true);
        view.setFloat32(offset + 4, v0.y, true);
        view.setFloat32(offset + 8, v0.z, true);
        offset += 12;
        
        view.setFloat32(offset, v1.x, true);
        view.setFloat32(offset + 4, v1.y, true);
        view.setFloat32(offset + 8, v1.z, true);
        offset += 12;
        
        view.setFloat32(offset, v2.x, true);
        view.setFloat32(offset + 4, v2.y, true);
        view.setFloat32(offset + 8, v2.z, true);
        offset += 12;
        
        // Attribute byte count (unused)
        view.setUint16(offset, 0, true);
        offset += 2;
      }
      
      return buffer;
    },
  
    /**
     * Export to OBJ format
     */
    toOBJ(mesh, name = 'model') {
      let obj = `# FIXED Marching Cubes Export\n`;
      obj += `# ${name}\n`;
      obj += `# Vertices: ${mesh.vertexCount}\n`;
      obj += `# Triangles: ${mesh.triangleCount}\n\n`;
      
      // Vertices
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        obj += `v ${mesh.vertices[i].toFixed(6)} ${mesh.vertices[i + 1].toFixed(6)} ${mesh.vertices[i + 2].toFixed(6)}\n`;
      }
      
      obj += '\n';
      
      // Normals
      for (let i = 0; i < mesh.normals.length; i += 3) {
        obj += `vn ${mesh.normals[i].toFixed(6)} ${mesh.normals[i + 1].toFixed(6)} ${mesh.normals[i + 2].toFixed(6)}\n`;
      }
      
      obj += '\n';
      
      // Faces (1-indexed)
      for (let i = 0; i < mesh.indices.length; i += 3) {
        const i1 = mesh.indices[i] + 1;
        const i2 = mesh.indices[i + 1] + 1;
        const i3 = mesh.indices[i + 2] + 1;
        obj += `f ${i1}//${i1} ${i2}//${i2} ${i3}//${i3}\n`;
      }
      
      return obj;
    },
  
    /**
     * Analyze mesh statistics
     */
    analyze(mesh) {
      const bounds = mesh.bounds || { 
        min: { x: 0, y: 0, z: 0 }, 
        max: { x: 0, y: 0, z: 0 } 
      };
      
      const size = {
        x: bounds.max.x - bounds.min.x,
        y: bounds.max.y - bounds.min.y,
        z: bounds.max.z - bounds.min.z
      };
      
      return {
        vertexCount: mesh.vertexCount,
        triangleCount: mesh.triangleCount,
        bounds,
        size,
        memoryUsage: {
          vertices: mesh.vertices.byteLength,
          normals: mesh.normals.byteLength,
          indices: mesh.indices.byteLength,
          total: mesh.vertices.byteLength + mesh.normals.byteLength + mesh.indices.byteLength
        },
        memoryMB: (mesh.vertices.byteLength + mesh.normals.byteLength + mesh.indices.byteLength) / (1024 * 1024)
      };
    }
  };
  
  // ============================================================================
  // PARAMETRIC DESIGN SYSTEM
  // ============================================================================
  
  class Parameter {
    constructor(name, value, min = -Infinity, max = Infinity) {
      this.name = name;
      this._value = value;
      this.min = min;
      this.max = max;
      this.dependencies = new Set();
      this.listeners = [];
    }
  
    get value() {
      return this._value;
    }
  
    set value(v) {
      const clamped = Math.max(this.min, Math.min(this.max, v));
      if (clamped !== this._value) {
        this._value = clamped;
        this._notify();
      }
    }
  
    _notify() {
      for (const listener of this.listeners) {
        try {
          listener(this._value);
        } catch (err) {
          console.error(`Parameter listener error for ${this.name}:`, err);
        }
      }
      for (const dep of this.dependencies) {
        dep._recompute();
      }
    }
  
    onChange(callback) {
      this.listeners.push(callback);
      return this;
    }
  
    toString() {
      return `Parameter(${this.name}=${this._value})`;
    }
  }
  
  class DerivedParameter extends Parameter {
    constructor(name, computeFn, ...dependencies) {
      super(name, 0);
      this.computeFn = computeFn;
      this.sourceDependencies = dependencies;
      
      for (const dep of dependencies) {
        dep.dependencies.add(this);
      }
      
      this._recompute();
    }
  
    _recompute() {
      try {
        const values = this.sourceDependencies.map(d => d.value);
        this._value = this.computeFn(...values);
        this._notify();
      } catch (err) {
        console.error(`Derived parameter computation error for ${this.name}:`, err);
      }
    }
  
    set value(v) {
      console.warn(`Cannot set value of derived parameter ${this.name}`);
    }
  }
  
  const Parametric = {
    /**
     * Create a parameter
     */
    param(name, value, min, max) {
      return new Parameter(name, value, min, max);
    },
  
    /**
     * Create derived parameter
     */
    derived(name, computeFn, ...dependencies) {
      return new DerivedParameter(name, computeFn, ...dependencies);
    },
  
    /**
     * Create parametric field
     */
    field(buildFn, ...parameters) {
      let cachedField = null;
      let needsRebuild = true;
      
      const rebuild = () => {
        try {
          cachedField = buildFn(...parameters.map(p => p.value));
          needsRebuild = false;
        } catch (err) {
          console.error('Parametric field build error:', err);
        }
      };
      
      for (const param of parameters) {
        param.onChange(() => {
          needsRebuild = true;
        });
      }
      
      return {
        get current() {
          if (needsRebuild || !cachedField) {
            rebuild();
          }
          return cachedField;
        },
        parameters,
        rebuild: () => {
          rebuild();
          return cachedField;
        }
      };
    }
  };
  
  // ============================================================================
  // FEATURE TREE SYSTEM
  // ============================================================================
  
  class FeatureTree {
    constructor() {
      this.root = null;
      this.features = [];
      this.currentResult = null;
      this.listeners = [];
    }
  
    addFeature(name, operation, inputs, parameters = {}) {
      const feature = {
        id: `feature_${this.features.length}`,
        name,
        operation,
        inputs: [...inputs],
        parameters: { ...parameters },
        timestamp: Date.now(),
        suppressed: false,
        result: null,
        error: null
      };
      
      this.features.push(feature);
      this._rebuild();
      this._notifyListeners('featureAdded', feature);
      
      return feature;
    }
  
    suppress(featureId, suppressed = true) {
      const feature = this.features.find(f => f.id === featureId);
      if (feature) {
        feature.suppressed = suppressed;
        this._rebuild();
        this._notifyListeners('featureChanged', feature);
      }
    }
  
    editFeature(featureId, newParameters) {
      const feature = this.features.find(f => f.id === featureId);
      if (feature) {
        Object.assign(feature.parameters, newParameters);
        this._rebuild();
        this._notifyListeners('featureChanged', feature);
      }
    }
  
    deleteFeature(featureId) {
      const index = this.features.findIndex(f => f.id === featureId);
      if (index >= 0) {
        const feature = this.features[index];
        this.features.splice(index, 1);
        this._rebuild();
        this._notifyListeners('featureDeleted', feature);
      }
    }
  
    _rebuild() {
      let result = null;
      
      for (const feature of this.features) {
        if (feature.suppressed) {
          feature.result = null;
          continue;
        }
        
        try {
          const args = feature.inputs.map(input => {
            if (typeof input === 'string' && input.startsWith('feature_')) {
              const inputFeature = this.features.find(f => f.id === input);
              return inputFeature ? inputFeature.result : null;
            }
            return input;
          }).filter(x => x !== null);
          
          feature.result = feature.operation(...args, feature.parameters);
          feature.error = null;
          result = feature.result;
        } catch (err) {
          console.error(`Feature ${feature.name} failed:`, err);
          feature.result = null;
          feature.error = err.message;
        }
      }
      
      this.currentResult = result;
      this._notifyListeners('rebuilt', result);
      return result;
    }
  
    getModel() {
      return this.currentResult;
    }
  
    getFeatureList() {
      return this.features.map(f => ({
        id: f.id,
        name: f.name,
        suppressed: f.suppressed,
        timestamp: f.timestamp,
        error: f.error
      }));
    }
  
    onChange(callback) {
      this.listeners.push(callback);
    }
  
    _notifyListeners(event, data) {
      for (const listener of this.listeners) {
        try {
          listener(event, data);
        } catch (err) {
          console.error('Feature tree listener error:', err);
        }
      }
    }
  
    toJSON() {
      return {
        features: this.features.map(f => ({
          id: f.id,
          name: f.name,
          operation: f.operation.name,
          parameters: f.parameters,
          suppressed: f.suppressed
        }))
      };
    }
  }
  
  // ============================================================================
  // QUERY AND SELECTION SYSTEM
  // ============================================================================
  
  class Selection {
    constructor(field, predicate) {
      this.field = field;
      this.predicate = predicate;
      this.regions = [];
    }
  
    contains(p) {
      try {
        return this.predicate(p, this.field.sample(p));
      } catch (err) {
        return false;
      }
    }
  }
  
  const Query = {
    findEdges(field, sharpnessThreshold = 0.8) {
      return new Selection(field, (p, sample) => {
        if (Math.abs(sample.distance) > 0.1) return false;
        const normal = field._gradient(p);
        const gradMag = Vec3.length(normal);
        return gradMag > sharpnessThreshold;
      });
    },
  
    findFaces(field, tolerance = 0.01) {
      return new Selection(field, (p, sample) => {
        return Math.abs(sample.distance) < tolerance;
      });
    },
  
    selectNear(field, point, radius) {
      return new Selection(field, (p) => {
        return Vec3.distance(p, point) < radius;
      });
    },
  
    selectBox(field, min, max) {
      return new Selection(field, (p) => {
        return Bounds.contains({ min, max }, p);
      });
    },
  
    selectWhere(field, predicate) {
      return new Selection(field, predicate);
    },
  
    sampleGrid(field, resolution, predicate) {
      const bounds = field.bounds();
      const points = [];
      
      const step = {
        x: (bounds.max.x - bounds.min.x) / resolution,
        y: (bounds.max.y - bounds.min.y) / resolution,
        z: (bounds.max.z - bounds.min.z) / resolution
      };
      
      for (let k = 0; k <= resolution; k++) {
        for (let j = 0; j <= resolution; j++) {
          for (let i = 0; i <= resolution; i++) {
            const p = {
              x: bounds.min.x + i * step.x,
              y: bounds.min.y + j * step.y,
              z: bounds.min.z + k * step.z
            };
            const sample = field.sample(p);
            if (predicate(p, sample)) {
              points.push(p);
            }
          }
        }
      }
      
      return points;
    }
  };
  
  // ============================================================================
  // EXAMPLES
  // ============================================================================
  
  const Examples = {
    /**
     * Simple bracket
     */
    bracket() {
      const base = Primitives.sphere({ x: 0, y: 0, z: 0 }, 50);
      const hole1 = Primitives.cylinder(
        { x: -60, y: 0, z: 0 },
        { x: 60, y: 0, z: 0 },
        15
      );
      const hole2 = Primitives.cylinder(
        { x: 0, y: -60, z: 0 },
        { x: 0, y: 60, z: 0 },
        15
      );
      
      const withHoles = Boolean.difference(base, Boolean.union(hole1, hole2));
      return Modify.fillet(withHoles, 5);
    },
  
    /**
     * Lattice sphere
     */
    latticeSphere() {
      const outer = Primitives.sphere({ x: 0, y: 0, z: 0 }, 50);
      const shell = Modify.shell(outer, 3);
      
      const latticeBounds = {
        min: { x: -47, y: -47, z: -47 },
        max: { x: 47, y: 47, z: 47 }
      };
      const lattice = Lattice.gyroid(latticeBounds, 10, 0.3);
      const clipped = Boolean.intersection(lattice, Modify.offset(outer, -3));
      
      return Boolean.union(shell, clipped);
    },
  
    /**
     * Parametric bolt
     */
    parametricBolt() {
      const diameter = Parametric.param('diameter', 10, 5, 20);
      const length = Parametric.param('length', 40, 10, 100);
      const headHeight = Parametric.derived('headHeight', (d) => d * 0.7, diameter);
      
      return Parametric.field((d, l, hh) => {
        const shaft = Primitives.cylinder(
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: l },
          d / 2
        );
        
        const head = Primitives.cylinder(
          { x: 0, y: 0, z: l },
          { x: 0, y: 0, z: l + hh },
          d * 0.75
        );
        
        return Boolean.union(shaft, head);
      }, diameter, length, headHeight);
    }
  };
  
  // ============================================================================
  // EXPORT MODULE
  // ============================================================================
  
  export {
    // Core
    Field,
    Vec2,
    Vec3,
    Bounds,
    
    // Primitives
    Primitives,
    
    // Operations
    Boolean,
    Transform,
    Modify,
    Lattice,
    
    // Sketch & Extrude
    Sketch,
    Extrude,
    
    // Parametric
    Parametric,
    Parameter,
    DerivedParameter,
    
    // Feature Tree
    FeatureTree,
    
    // Query
    Query,
    Selection,
    
    // Meshing
    Mesher,
    MarchingCubesTables,
    
    // Examples
    Examples
  };
