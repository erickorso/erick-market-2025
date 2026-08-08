
import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const ThreeDBackground: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animationFrameId = useRef<number | null>(null);
  const mouse = useRef(new THREE.Vector2());
  const particleTexturesRef = useRef<THREE.Texture[]>([]);
  const particleGroupRef = useRef<THREE.Group | null>(null);
  const textureLoaderRef = useRef<THREE.TextureLoader | null>(null);

  const tealColor = '#2dd4bf';
  const lightGrayColor = '#e5e7eb';
  const darkGrayColor = '#4b5563';

  // --- SVG Chess Piece Texture Creation Functions ---

  const loadPawnChessSVGTexture = (loader: THREE.TextureLoader): Promise<THREE.Texture> => {
    return new Promise((resolve) => {
      const svgString = `
        <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
          <rect x="24" y="16" width="16" height="16" fill="${tealColor}"/> <!-- Head -->
          <rect x="28" y="32" width="8" height="16" fill="${tealColor}"/> <!-- Stem -->
          <rect x="16" y="48" width="32" height="8" fill="${tealColor}"/> <!-- Base -->
        </svg>
      `;
      const dataUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;
      loader.load(dataUrl, (texture) => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        resolve(texture);
      }, undefined, (error) => {
        console.error('Error loading Pawn SVG texture:', error);
        resolve(createFallbackTexture(tealColor, 'P!'));
      });
    });
  };

  const loadRookChessSVGTexture = (loader: THREE.TextureLoader): Promise<THREE.Texture> => {
    return new Promise((resolve) => {
      const svgString = `
        <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
          <rect x="16" y="8" width="8" height="16" fill="${lightGrayColor}"/>
          <rect x="40" y="8" width="8" height="16" fill="${lightGrayColor}"/>
          <rect x="24" y="16" width="16" height="8" fill="${lightGrayColor}"/>
          <rect x="20" y="24" width="24" height="24" fill="${lightGrayColor}"/>
          <rect x="16" y="48" width="32" height="8" fill="${lightGrayColor}"/>
        </svg>
      `;
      const dataUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;
      loader.load(dataUrl, (texture) => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        resolve(texture);
      }, undefined, (error) => {
        console.error('Error loading Rook SVG texture:', error);
        resolve(createFallbackTexture(lightGrayColor, 'R!'));
      });
    });
  };

  const loadKnightChessSVGTexture = (loader: THREE.TextureLoader): Promise<THREE.Texture> => {
    return new Promise((resolve) => {
      const svgString = `
        <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
          <rect x="32" y="8" width="8" height="8" fill="${darkGrayColor}"/> <!-- Ear -->
          <rect x="24" y="16" width="24" height="8" fill="${darkGrayColor}"/> <!-- Head top -->
          <rect x="16" y="24" width="24" height="8" fill="${darkGrayColor}"/> <!-- Snout -->
          <rect x="24" y="32" width="16" height="16" fill="${darkGrayColor}"/> <!-- Neck/Body -->
          <rect x="16" y="48" width="32" height="8" fill="${darkGrayColor}"/> <!-- Base -->
        </svg>
      `;
      const dataUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;
      loader.load(dataUrl, (texture) => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        resolve(texture);
      }, undefined, (error) => {
        console.error('Error loading Knight SVG texture:', error);
        resolve(createFallbackTexture(darkGrayColor, 'N!')); // N for kNight
      });
    });
  };

  const loadBishopChessSVGTexture = (loader: THREE.TextureLoader): Promise<THREE.Texture> => {
    return new Promise((resolve) => {
      const svgString = `
        <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
          <rect x="28" y="8" width="8" height="8" fill="${lightGrayColor}"/>
          <rect x="24" y="16" width="16" height="8" fill="${lightGrayColor}"/>
          <rect x="20" y="24" width="24" height="16" fill="${lightGrayColor}"/>
          <rect x="24" y="40" width="16" height="8" fill="${lightGrayColor}"/>
          <rect x="16" y="48" width="32" height="8" fill="${lightGrayColor}"/>
        </svg>
      `;
      const dataUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;
      loader.load(dataUrl, (texture) => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        resolve(texture);
      }, undefined, (error) => {
        console.error('Error loading Bishop SVG texture:', error);
        resolve(createFallbackTexture(lightGrayColor, 'B!'));
      });
    });
  };

  const loadQueenChessSVGTexture = (loader: THREE.TextureLoader): Promise<THREE.Texture> => {
    return new Promise((resolve) => {
      const svgString = `
        <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
          <rect x="20" y="8" width="8" height="8" fill="${tealColor}"/>
          <rect x="28" y="0" width="8" height="16" fill="${tealColor}"/>
          <rect x="36" y="8" width="8" height="8" fill="${tealColor}"/>
          <rect x="20" y="16" width="24" height="8" fill="${tealColor}"/>
          <rect x="24" y="24" width="16" height="16" fill="${tealColor}"/>
          <rect x="16" y="40" width="32" height="8" fill="${tealColor}"/>
          <rect x="12" y="48" width="40" height="8" fill="${tealColor}"/>
        </svg>
      `;
      const dataUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;
      loader.load(dataUrl, (texture) => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        resolve(texture);
      }, undefined, (error) => {
        console.error('Error loading Queen SVG texture:', error);
        resolve(createFallbackTexture(tealColor, 'Q!'));
      });
    });
  };

  const loadKingChessSVGTexture = (loader: THREE.TextureLoader): Promise<THREE.Texture> => {
    return new Promise((resolve) => {
      const svgString = `
        <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
          <rect x="28" y="0" width="8" height="12" fill="${darkGrayColor}"/>
          <rect x="20" y="8" width="24" height="4" fill="${darkGrayColor}"/>
          <rect x="20" y="12" width="24" height="8" fill="${darkGrayColor}"/>
          <rect x="24" y="20" width="16" height="20" fill="${darkGrayColor}"/>
          <rect x="16" y="40" width="32" height="8" fill="${darkGrayColor}"/>
          <rect x="12" y="48" width="40" height="8" fill="${darkGrayColor}"/>
        </svg>
      `;
      const dataUrl = `data:image/svg+xml;base64,${btoa(svgString)}`;
      loader.load(dataUrl, (texture) => {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        resolve(texture);
      }, undefined, (error) => {
        console.error('Error loading King SVG texture:', error);
        resolve(createFallbackTexture(darkGrayColor, 'K!'));
      });
    });
  };


  const createFallbackTexture = (color: string, text: string): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) { // Should ideally not happen
        const errorCanvas = document.createElement('canvas'); // Minimal fallback
        return new THREE.CanvasTexture(errorCanvas);
    }
    ctx.fillStyle = color; // Background for the fallback
    ctx.fillRect(0, 0, 64, 64);
    ctx.font = 'bold 32px monospace'; // Blocky font
    ctx.fillStyle = '#fff'; // Contrasting text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
  };


  useEffect(() => {
    if (!mountRef.current) return;

    // Skip WebGL when the user prefers reduced motion (a11y + battery).
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Avoid heavy GPU work on very small viewports.
    if (window.matchMedia("(max-width: 640px)").matches) {
      return;
    }

    const currentMount = mountRef.current;
    if (!textureLoaderRef.current) {
      textureLoaderRef.current = new THREE.TextureLoader();
    }
    const loader = textureLoaderRef.current;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.z = 80;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true }); // antialias false for sharper pixels
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    currentMount.appendChild(renderer.domElement);

    const initTexturesAndParticles = async () => {
      try {
        const textures = await Promise.all([
          loadPawnChessSVGTexture(loader),
          loadRookChessSVGTexture(loader),
          loadKnightChessSVGTexture(loader),
          loadBishopChessSVGTexture(loader),
          loadQueenChessSVGTexture(loader),
          loadKingChessSVGTexture(loader),
        ]);
        particleTexturesRef.current = textures.filter(t => t !== null) as THREE.Texture[];

        if (particleTexturesRef.current.length === 0) {
            console.warn("No textures loaded, using only fallbacks or aborting particle creation.");
            // Create a default set of fallbacks if all failed
             particleTexturesRef.current = [
                createFallbackTexture(tealColor, 'P?'),
                createFallbackTexture(lightGrayColor, 'R?'),
                createFallbackTexture(darkGrayColor, 'N?'),
                createFallbackTexture(lightGrayColor, 'B?'),
                createFallbackTexture(tealColor, 'Q?'),
                createFallbackTexture(darkGrayColor, 'K?'),
             ];
             if (particleTexturesRef.current.length === 0) { // Should not happen with above
                console.error("Still no textures available. Aborting particle system.");
                return;
            }
        }

        const particleCount = 200; // Increased slightly for more variety
        const group = new THREE.Group();
        particleGroupRef.current = group;
        const spriteScale = 8; // Slightly increased scale for pixel art visibility

        for (let i = 0; i < particleCount; i++) {
          if (particleTexturesRef.current.length === 0) break; // Safety break
          const texture = particleTexturesRef.current[Math.floor(Math.random() * particleTexturesRef.current.length)];
          const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.1, 
            blending: THREE.NormalBlending,
            depthWrite: true,
          });
          const sprite = new THREE.Sprite(material);

          sprite.position.set(
            (Math.random() - 0.5) * 200,
            (Math.random() - 0.5) * 200,
            (Math.random() - 0.5) * 200
          );
          sprite.scale.set(spriteScale, spriteScale, spriteScale);
          group.add(sprite);
        }
        scene.add(group);
        animate(); 
      } catch (error) {
        console.error("Failed to initialize textures and particles:", error);
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      const now = Date.now() * 0.00005;

      if (particleGroupRef.current) {
        particleGroupRef.current.rotation.y = now * 0.1;
        particleGroupRef.current.rotation.x = now * 0.05;

        particleGroupRef.current.children.forEach((sprite, index) => {
          if (sprite instanceof THREE.Sprite && sprite.position) {
            // Adjust bobbing for visual appeal
            sprite.position.y += Math.sin(Date.now() * 0.0003 + index * 0.7) * 0.04;
          }
        });
      }

      camera.position.x += (mouse.current.x * 10 - camera.position.x) * 0.02;
      camera.position.y += (-mouse.current.y * 10 - camera.position.y) * 0.02;
      camera.lookAt(scene.position);

      renderer.render(scene, camera);
    };

    initTexturesAndParticles();

    const handleResize = () => {
      if (!currentMount || !renderer) return;
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onMouseMove);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (renderer && renderer.domElement && currentMount && currentMount.contains(renderer.domElement)) {
        currentMount.removeChild(renderer.domElement);
      }
      particleTexturesRef.current.forEach(texture => texture?.dispose());
      particleTexturesRef.current = [];
      if (particleGroupRef.current) {
        particleGroupRef.current.children.forEach(child => {
          if (child instanceof THREE.Sprite) {
            child.material.map?.dispose();
            child.material.dispose();
          }
        });
        particleGroupRef.current.clear();
      }
      scene.clear();
      renderer?.dispose(); // Safely call dispose
    };
  }, []);

  return <div
    ref={mountRef}
    aria-hidden="true"
    className="pointer-events-none fixed inset-0 -z-10"
    style={{ width: "100%", height: "100%" }}
  />;
};

export default ThreeDBackground;
