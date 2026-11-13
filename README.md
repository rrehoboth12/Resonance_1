# Resonance

Resonance is a fully offline desktop music player with a frequency-reactive canvas visualizer. It reads local audio folders, plays the queue with standard controls, and maps FFT frequency energy to the interface palette, pulse rings, spectrum bars, and profile meters.

## Run as a desktop app

1. Install a current Node.js release.
2. In this folder, run `npm install`.
3. Start the desktop app with `npm start`.
4. Choose **Import folder** and select a local music directory.

If PowerShell blocks the `npm` script wrapper on Windows, use `npm.cmd install` and `npm.cmd start` instead.

Use **Import file** to add one or more individual audio files to the current queue. Imported files are appended without clearing tracks that are already loaded.

For album artwork, place `cover.jpg`, `folder.jpg`, `album.jpg`, or `front.jpg` beside tracks in an album folder.

## Preview in a browser

Open `index.html` directly or serve the folder with any static web server. The browser preview uses a folder input instead of the Electron folder dialog. Playback and visualizer processing stay local.

## Project structure

- `main.js`: Electron window, secure folder dialog, local track discovery, and album artwork reading.
- `preload.js`: narrow desktop bridge exposed to the interface.
- `index.html`: player layout and controls.
- `css/styles.css`: desktop UI and responsive layout.
- `js/app.js`: queue management, local import, audio controls, and metadata display.
- `js/visualizer.js`: commented FFT mapping and canvas rendering.

## Audio mapping

The visualizer uses the Web Audio API `AnalyserNode` with an FFT size of `256`. It groups the returned spectrum bins into bass, mids, and treble ranges. Bass drives large pulse rings, mids guide color palette changes, and treble drives fine details and sparkle intensity. The mapping is documented in `js/visualizer.js`.
