import { AudioManager } from './AudioManager.js';
import { SceneManager } from './SceneManager.js';
import GUI from 'lil-gui';

class App {
    constructor() {
        this.audioManager = new AudioManager();
        this.sceneManager = new SceneManager(document.getElementById('canvas-container'));
        
        this.settings = {
            bloomStrength: 1.5,
            bloomRadius: 0.4,
            displacement: 0.2,
            rotateSpeed: 1.0
        };

        this.setupUI();
        this.setupGUI();
        this.animate();
    }

    setupUI() {
        const fileInput = document.getElementById('file-input');
        const playBtn = document.getElementById('play-btn');
        const stopBtn = document.getElementById('stop-btn');
        const statusText = document.getElementById('status-text');
        const playbackControls = document.getElementById('playback-controls');

        fileInput.addEventListener('change', async (e) => {
            if (e.target.files.length === 0) return;
            
            statusText.innerText = "Decoding audio...";
            statusText.style.color = "#ffff00";

            try {
                const count = await this.audioManager.loadFiles(e.target.files);
                statusText.innerText = `Ready! Loaded ${count} tracks.`;
                statusText.style.color = "#00ff88";
                playbackControls.classList.remove('hidden');
                
                // Auto play on load for convenience
                this.audioManager.play();
            } catch (err) {
                console.error(err);
                statusText.innerText = "Error loading audio.";
                statusText.style.color = "#ff0000";
            }
        });

        playBtn.addEventListener('click', () => this.audioManager.play());
        stopBtn.addEventListener('click', () => this.audioManager.stop());
    }

    setupGUI() {
        const gui = new GUI({ title: 'Visualizer Settings' });
        // Start closed on mobile to save space
        if(window.innerWidth < 600) gui.close();

        const folder = gui.addFolder('Effects');
        folder.add(this.settings, 'bloomStrength', 0, 3).name('Glow Strength');
        folder.add(this.settings, 'bloomRadius', 0, 1).name('Glow Radius');
        folder.add(this.settings, 'displacement', 0, 1).name('Distortion');
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        // Pass audio data to visualizer
        this.sceneManager.update(this.audioManager, this.settings);
    }
}

// Start the app when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    new App();
});