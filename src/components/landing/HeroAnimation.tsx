import { useEffect, useRef } from 'react';

interface Node3D {
  x: number;
  y: number;
  z: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  symbol?: string;
}

interface Connection {
  from: number;
  to: number;
}

interface ProofPath {
  nodes: number[];
  progress: number;
  startTime: number;
}

const MATH_SYMBOLS = ['∑', '∂', 'π', 'λ', '∴', '⊕', '∇', 'Θ'];
const NODE_COUNT = 40;
const CONNECTION_PROBABILITY = 0.15;
const ROTATION_SPEED = 0.0003;
const PROOF_PATH_LENGTH = 6;
const PROOF_PATH_INTERVAL = 4000; // ms between proof paths
const PROOF_PATH_DURATION = 2500; // ms to complete a proof path
const SPHERE_RADIUS = 280;

/**
 * HeroAnimation - Full-screen animated canvas background
 *
 * Renders a slowly rotating 3D network of cryptographic nodes with
 * occasional highlighted proof paths. Designed to be a subtle,
 * elegant background element.
 *
 * Reads colors from CSS variables:
 * - --text-primary: node colors
 * - --text-muted: line colors
 * - --border: faint connections
 * - --accent: proof highlight path
 */
export function HeroAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const nodesRef = useRef<Node3D[]>([]);
  const connectionsRef = useRef<Connection[]>([]);
  const rotationRef = useRef(0);
  const proofPathRef = useRef<ProofPath | null>(null);
  const lastProofPathRef = useRef(0);
  const dprRef = useRef(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let mounted = true;

    // Initialize nodes in 3D sphere
    const initializeNodes = () => {
      const nodes: Node3D[] = [];

      for (let i = 0; i < NODE_COUNT; i++) {
        // Fibonacci sphere distribution for even spacing
        const phi = Math.acos(1 - 2 * (i + 0.5) / NODE_COUNT);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;

        const x = SPHERE_RADIUS * Math.sin(phi) * Math.cos(theta);
        const y = SPHERE_RADIUS * Math.sin(phi) * Math.sin(theta);
        const z = SPHERE_RADIUS * Math.cos(phi);

        nodes.push({
          x,
          y,
          z,
          baseX: x,
          baseY: y,
          baseZ: z,
          symbol: Math.random() < 0.3 ? MATH_SYMBOLS[Math.floor(Math.random() * MATH_SYMBOLS.length)] : undefined,
        });
      }

      nodesRef.current = nodes;
    };

    // Create connections between nearby nodes
    const initializeConnections = () => {
      const connections: Connection[] = [];
      const nodes = nodesRef.current;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]!;
          const b = nodes[j]!;
          const dx = a.baseX - b.baseX;
          const dy = a.baseY - b.baseY;
          const dz = a.baseZ - b.baseZ;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

          // Connect nodes within a certain distance threshold
          if (distance < SPHERE_RADIUS * 0.8 && Math.random() < CONNECTION_PROBABILITY) {
            connections.push({ from: i, to: j });
          }
        }
      }

      connectionsRef.current = connections;
    };

    // Generate a random proof path
    const generateProofPath = (): ProofPath => {
      const nodes: number[] = [];
      const visited = new Set<number>();

      // Start from a random node
      let current = Math.floor(Math.random() * NODE_COUNT);
      nodes.push(current);
      visited.add(current);

      // Build path by following connections
      for (let i = 1; i < PROOF_PATH_LENGTH; i++) {
        const neighbors = connectionsRef.current
          .filter(c => (c.from === current || c.to === current) && !visited.has(c.from === current ? c.to : c.from))
          .map(c => c.from === current ? c.to : c.from);

        if (neighbors.length === 0) break;

        current = neighbors[Math.floor(Math.random() * neighbors.length)] ?? current;
        nodes.push(current);
        visited.add(current);
      }

      return {
        nodes,
        progress: 0,
        startTime: performance.now(),
      };
    };

    // Resize canvas with DPR scaling
    const resizeCanvas = () => {
      if (!canvas) return;

      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;

      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      ctx.scale(dpr, dpr);
    };

    // Project 3D point to 2D screen space
    const project = (x: number, y: number, z: number, width: number, height: number) => {
      const perspective = 800;
      const scale = perspective / (perspective + z);

      return {
        x: x * scale + width / 2,
        y: y * scale + height / 2,
        scale,
      };
    };

    // Get CSS variable color
    const getColor = (varName: string): string => {
      return getComputedStyle(canvas).getPropertyValue(varName).trim() || '#888';
    };

    // Animation loop
    const animate = (timestamp: number) => {
      if (!mounted || !canvas || !ctx) return;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      // Reset transform and clear
      ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Update rotation
      rotationRef.current += ROTATION_SPEED;

      // Update proof path
      if (!proofPathRef.current && timestamp - lastProofPathRef.current > PROOF_PATH_INTERVAL) {
        proofPathRef.current = generateProofPath();
        lastProofPathRef.current = timestamp;
      }

      if (proofPathRef.current) {
        const elapsed = timestamp - proofPathRef.current.startTime;
        proofPathRef.current.progress = Math.min(elapsed / PROOF_PATH_DURATION, 1);

        if (proofPathRef.current.progress >= 1) {
          proofPathRef.current = null;
        }
      }

      // Rotate nodes around Y axis
      const cosR = Math.cos(rotationRef.current);
      const sinR = Math.sin(rotationRef.current);

      nodesRef.current.forEach(node => {
        node.x = node.baseX * cosR - node.baseZ * sinR;
        node.z = node.baseX * sinR + node.baseZ * cosR;
        node.y = node.baseY;
      });

      // Get theme colors
      const textMuted = getColor('--text-muted');
      const textPrimary = getColor('--text-primary');
      const border = getColor('--border');
      const accent = getColor('--accent');

      // Draw connections
      ctx.globalAlpha = 0.6;
      connectionsRef.current.forEach(conn => {
        const from = nodesRef.current[conn.from];
        const to = nodesRef.current[conn.to];
        if (!from || !to) return;

        const fromProj = project(from.x, from.y, from.z, width, height);
        const toProj = project(to.x, to.y, to.z, width, height);

        // Check if this connection is part of the proof path
        let isInProofPath = false;
        let proofAlpha = 0;

        if (proofPathRef.current) {
          const path = proofPathRef.current.nodes;
          for (let i = 0; i < path.length - 1; i++) {
            if ((path[i] === conn.from && path[i + 1] === conn.to) ||
                (path[i] === conn.to && path[i + 1] === conn.from)) {
              isInProofPath = true;
              // Fade in the proof path segment based on progress
              const segmentStart = i / (path.length - 1);
              const segmentEnd = (i + 1) / (path.length - 1);
              if (proofPathRef.current.progress >= segmentStart) {
                proofAlpha = Math.min((proofPathRef.current.progress - segmentStart) / (segmentEnd - segmentStart), 1);
              }
              break;
            }
          }
        }

        ctx.beginPath();
        ctx.moveTo(fromProj.x, fromProj.y);
        ctx.lineTo(toProj.x, toProj.y);

        if (isInProofPath && proofAlpha > 0) {
          ctx.strokeStyle = accent;
          ctx.globalAlpha = 0.6 * proofAlpha;
          ctx.lineWidth = 2;
        } else {
          ctx.strokeStyle = border;
          ctx.globalAlpha = 0.15;
          ctx.lineWidth = 1;
        }

        ctx.stroke();
      });

      // Draw nodes
      nodesRef.current.forEach((node, index) => {
        const proj = project(node.x, node.y, node.z, width, height);

        // Check if node is in proof path
        let isInProofPath = false;
        let nodeAlpha = 0;

        if (proofPathRef.current) {
          const pathIndex = proofPathRef.current.nodes.indexOf(index);
          if (pathIndex !== -1) {
            isInProofPath = true;
            const nodeProgress = pathIndex / (proofPathRef.current.nodes.length - 1);
            if (proofPathRef.current.progress >= nodeProgress) {
              nodeAlpha = Math.min((proofPathRef.current.progress - nodeProgress) * 3, 1);
            }
          }
        }

        // Draw node
        const radius = isInProofPath && nodeAlpha > 0 ? 4 : 2.5;
        const nodeColor = isInProofPath && nodeAlpha > 0 ? accent : textPrimary;

        ctx.beginPath();
        ctx.arc(proj.x, proj.y, radius * proj.scale, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.globalAlpha = isInProofPath ? 0.6 * nodeAlpha : 0.4;
        ctx.fill();

        // Draw symbol if present
        if (node.symbol) {
          ctx.font = `${12 * proj.scale}px serif`;
          ctx.fillStyle = textMuted;
          ctx.globalAlpha = 0.3;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.symbol, proj.x + 15 * proj.scale, proj.y);
        }
      });

      ctx.globalAlpha = 1;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Initialize
    initializeNodes();
    initializeConnections();
    resizeCanvas();

    // Start animation
    animationFrameRef.current = requestAnimationFrame(animate);

    // Handle resize
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);

    // Cleanup
    return () => {
      mounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.6 }}
      aria-hidden="true"
    />
  );
}
