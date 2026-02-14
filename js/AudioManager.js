export class AudioManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 512; // Controls resolution of frequency data
        this.analyser.smoothingTimeConstant = 0.85;
        
        // Connect analyser to master output
        this.analyser.connect(this.ctx.destination);
        
        this.sources = [];
        this.buffers = [];
        this.isPlaying = false;
        
        // Data arrays
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    async loadFiles(fileList) {
        this.stop();
        this.buffers = [];
        
        // Ensure AudioContext is running (browser autoplay policy)
        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        const promises = Array.from(fileList).map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const buffer = await this.ctx.decodeAudioData(e.target.result);
                        this.buffers.push(buffer);
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(file);
            });
        });

        await Promise.all(promises);
        return this.buffers.length;
    }

    play() {
        if (this.isPlaying) return;
        
        // Clear previous sources
        this.sources = [];
        const startTime = this.ctx.currentTime + 0.1; // Slight delay for sync

        this.buffers.forEach(buffer => {
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            // Connect every source to the master analyser
            source.connect(this.analyser);
            source.start(startTime);
            this.sources.push(source);
            
            source.onended = () => {
                // Simple check: if the longest track ends, stop state
                if(this.sources.indexOf(source) === 0) {
                   // callback could go here
                }
            };
        });

        this.isPlaying = true;
    }

    stop() {
        this.sources.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        this.sources = [];
        this.isPlaying = false;
    }

    update() {
        this.analyser.getByteFrequencyData(this.frequencyData);
        this.analyser.getByteTimeDomainData(this.timeData);
    }

    getAverageFrequency() {
        let value = 0;
        const data = this.frequencyData;
        for (let i = 0; i < data.length; i++) {
            value += data[i];
        }
        return value / data.length;
    }

    getLowMidHigh() {
        // Simple band separation
        const data = this.frequencyData;
        const len = data.length;
        
        let low = 0, mid = 0, high = 0;
        // Low: bottom 10%
        // Mid: 10% - 50%
        // High: 50% - 100%
        
        const lowBound = Math.floor(len * 0.1);
        const midBound = Math.floor(len * 0.5);

        for(let i=0; i<len; i++) {
            if (i < lowBound) low += data[i];
            else if (i < midBound) mid += data[i];
            else high += data[i];
        }

        return {
            low: low / lowBound,
            mid: mid / (midBound - lowBound),
            high: high / (len - midBound)
        };
    }
}