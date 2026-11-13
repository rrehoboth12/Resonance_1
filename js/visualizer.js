(function () {
  "use strict";

  class ResonanceVisualizer {
    constructor(canvas, audioElement, onUpdate) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.audio = audioElement;
      this.onUpdate = onUpdate;
      this.audioContext = null;
      this.analyser = null;
      this.source = null;
      this.data = new Uint8Array(128);
      this.demoTime = 0;
      this.palette = { hue: 252, secondary: 192, bass: 0, mids: 0, treble: 0 };
      this.resize = this.resize.bind(this);
      this.draw = this.draw.bind(this);
      window.addEventListener("resize", this.resize);
      this.resize();
      requestAnimationFrame(this.draw);
    }

    connect() {
      if (this.audioContext) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.82;
      this.source = this.audioContext.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }

    resume() {
      this.connect();
      if (this.audioContext && this.audioContext.state === "suspended") this.audioContext.resume();
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      this.canvas.width = Math.floor(rect.width * ratio);
      this.canvas.height = Math.floor(rect.height * ratio);
      this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      this.width = rect.width;
      this.height = rect.height;
    }

    average(start, end) {
      let total = 0;
      for (let index = start; index < end; index += 1) total += this.data[index] || 0;
      return total / Math.max(1, end - start) / 255;
    }

    readFrequencies() {
      if (this.analyser && !this.audio.paused) {
        this.analyser.getByteFrequencyData(this.data);
      } else {
        // An idle signal keeps the visualizer alive before the first local track is imported.
        this.demoTime += 0.022;
        for (let index = 0; index < this.data.length; index += 1) {
          const wave = Math.sin(this.demoTime * 2.1 + index * 0.29) + Math.sin(this.demoTime * 0.7 + index * 0.11);
          const taper = Math.max(0.1, 1 - index / 170);
          this.data[index] = (22 + (wave + 2) * 13) * taper;
        }
      }

      /*
       * FFT MAPPING
       * With fftSize=256, the analyzer returns 128 bins from low to high frequency.
       * The low bins create the large beat pulse. Middle bins steer the palette.
       * Upper bins control the fine sparks and narrow bars. This keeps each visual
       * response tied to measured frequency energy instead of a random animation.
       */
      const bass = this.average(1, 12);
      const mids = this.average(12, 48);
      const treble = this.average(48, 105);
      const hueTarget = 220 + mids * 115 + treble * 38;

      this.palette.bass += (bass - this.palette.bass) * 0.24;
      this.palette.mids += (mids - this.palette.mids) * 0.14;
      this.palette.treble += (treble - this.palette.treble) * 0.18;
      this.palette.hue += (hueTarget - this.palette.hue) * 0.035;
      this.palette.secondary = (this.palette.hue + 77 + bass * 35) % 360;
      return this.palette;
    }

    drawGlow(x, y, radius, color) {
      const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, "transparent");
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    draw() {
      const { width, height, ctx } = this;
      const signal = this.readFrequencies();
      const bassPulse = 1 + signal.bass * 0.48;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = `hsl(${signal.hue}, 39%, 8%)`;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "screen";
      this.drawGlow(width * 0.18, height * 0.36, 210 * bassPulse, `hsla(${signal.secondary}, 84%, 52%, ${0.17 + signal.bass * 0.24})`);
      this.drawGlow(width * 0.76, height * 0.48, 290 * bassPulse, `hsla(${signal.hue}, 84%, 55%, ${0.18 + signal.mids * 0.24})`);
      this.drawGlow(width * 0.52, height * 0.96, 220, `hsla(${(signal.hue + 130) % 360}, 90%, 56%, ${0.1 + signal.treble * 0.2})`);

      const barCount = 58;
      const gap = 5;
      const barWidth = Math.max(2, (width - gap * (barCount - 1)) / barCount);
      const baseline = height - 34;
      ctx.globalCompositeOperation = "lighter";

      for (let index = 0; index < barCount; index += 1) {
        const value = this.data[Math.floor(index * this.data.length / barCount)] / 255;
        const barHeight = 9 + value * height * 0.38;
        const x = index * (barWidth + gap);
        const gradient = ctx.createLinearGradient(0, baseline - barHeight, 0, baseline);
        gradient.addColorStop(0, `hsla(${signal.secondary}, 90%, 70%, ${0.42 + value})`);
        gradient.addColorStop(1, `hsla(${signal.hue}, 85%, 55%, ${0.14 + value * 0.42})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(x, baseline - barHeight, barWidth, barHeight);
      }

      const ringRadius = 62 + signal.bass * 88;
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `hsla(${signal.secondary}, 100%, 77%, ${0.18 + signal.bass * .52})`;
      ctx.beginPath();
      ctx.arc(width * .5, height * .48, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = `hsla(${signal.hue}, 100%, 82%, ${0.11 + signal.treble * .34})`;
      ctx.beginPath();
      ctx.arc(width * .5, height * .48, ringRadius + 16 + signal.treble * 55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalCompositeOperation = "source-over";

      if (this.onUpdate) this.onUpdate(signal);
      requestAnimationFrame(this.draw);
    }
  }

  window.ResonanceVisualizer = ResonanceVisualizer;
})();
