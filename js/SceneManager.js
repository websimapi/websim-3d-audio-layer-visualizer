import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export class SceneManager {
    constructor(container) {
        this.container = container;
        this.width = container.offsetWidth;
        this.height = container.offsetHeight;

        this.initScene();
        this.initPostProcessing();
        this.createObjects();
        
        window.addEventListener('resize', this.onResize.bind(this));
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.02);

        this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.1, 1000);
        this.camera.position.z = 20;
        this.camera.position.y = 5;
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xff0080, 500);
        pointLight.position.set(10, 10, 10);
        this.scene.add(pointLight);
        
        const pointLight2 = new THREE.PointLight(0x0080ff, 500);
        pointLight2.position.set(-10, -10, 5);
        this.scene.add(pointLight2);
    }

    initPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // Bloom Effect
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.width, this.height),
            1.5, // Strength
            0.4, // Radius
            0.85 // Threshold
        );
        this.composer.addPass(this.bloomPass);
    }

    createObjects() {
        // 1. Central Distorted Sphere
        const geo = new THREE.IcosahedronGeometry(4, 20); // High detail for distortion
        // Store original positions for calculation
        geo.userData = { originalPositions: geo.attributes.position.clone() };
        
        const mat = new THREE.MeshStandardMaterial({
            color: 0x222222,
            roughness: 0.2,
            metalness: 0.8,
            wireframe: true,
            emissive: 0x000000
        });
        
        this.sphere = new THREE.Mesh(geo, mat);
        this.scene.add(this.sphere);

        // 2. Background Particles
        const partGeo = new THREE.BufferGeometry();
        const partCount = 2000;
        const posArray = new Float32Array(partCount * 3);
        
        for(let i = 0; i < partCount * 3; i++) {
            posArray[i] = (Math.random() - 0.5) * 100;
        }
        
        partGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        const partMat = new THREE.PointsMaterial({
            size: 0.1,
            color: 0xffffff,
            transparent: true,
            opacity: 0.6
        });
        
        this.particles = new THREE.Points(partGeo, partMat);
        this.scene.add(this.particles);
        
        // 3. Ring System
        this.rings = [];
        for(let i=0; i<3; i++) {
            const ringGeo = new THREE.TorusGeometry(8 + (i*4), 0.05, 16, 100);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.3 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            this.scene.add(ring);
            this.rings.push(ring);
        }
    }

    update(audioManager, settings) {
        // Get audio data
        audioManager.update();
        const freqData = audioManager.frequencyData;
        const bands = audioManager.getLowMidHigh();
        const avg = audioManager.getAverageFrequency();

        // Settings application
        this.bloomPass.strength = settings.bloomStrength;
        this.bloomPass.radius = settings.bloomRadius;

        // 1. Animate Sphere (Bass reaction)
        const positionAttribute = this.sphere.geometry.attributes.position;
        const originalPositions = this.sphere.geometry.userData.originalPositions;
        
        // Intensity modifier
        const bassInt = Math.max(0, (bands.low - 100) / 255); 
        const displacementScale = settings.displacement * (1 + bassInt * 2);

        // Simple vertex displacement noise simulation
        const time = performance.now() * 0.001;
        
        for (let i = 0; i < positionAttribute.count; i++) {
            const ox = originalPositions.getX(i);
            const oy = originalPositions.getY(i);
            const oz = originalPositions.getZ(i);

            // Create a pseudo-noise effect using sine waves
            const noise = Math.sin(ox * 0.5 + time) * Math.cos(oy * 0.5 + time) * Math.sin(oz * 0.5 + time);
            const normalize = 1 + (noise * displacementScale * (avg/50)); // React to overall volume

            positionAttribute.setXYZ(i, ox * normalize, oy * normalize, oz * normalize);
        }
        positionAttribute.needsUpdate = true;

        // Rotate sphere
        this.sphere.rotation.y += 0.005;
        this.sphere.rotation.z += 0.002;
        
        // Color Pulse based on Mid
        const hue = (time * 0.1) % 1;
        this.sphere.material.emissive.setHSL(hue, 0.8, bands.mid / 800);
        this.sphere.material.color.setHSL(hue + 0.5, 0.5, 0.5);

        // 2. Animate Particles (Treble reaction)
        this.particles.rotation.y = -time * 0.1;
        // Pulse size on highs
        this.particles.material.size = 0.1 + (bands.high / 255) * 0.3;

        // 3. Animate Rings
        this.rings.forEach((ring, i) => {
            ring.rotation.x = (Math.PI / 2) + Math.sin(time + i) * 0.1;
            ring.rotation.y = Math.cos(time * 0.5 + i) * 0.1;
            const scale = 1 + (avg / 255) * 0.1 * (i+1);
            ring.scale.set(scale, scale, scale);
        });

        // 4. Camera Sway
        this.camera.position.x = Math.sin(time * 0.2) * 5;
        this.camera.lookAt(0, 0, 0);

        this.composer.render();
    }

    onResize() {
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
        this.composer.setSize(this.width, this.height);
    }
}