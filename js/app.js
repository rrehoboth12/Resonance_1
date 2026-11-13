(function () {
  "use strict";

  const audio = document.getElementById("audio");
  const filePicker = document.getElementById("filePicker");
  const singleFilePicker = document.getElementById("singleFilePicker");
  const desktopImport = document.getElementById("desktopImport");
  const desktopFileImport = document.getElementById("desktopFileImport");
  const trackList = document.getElementById("trackList");
  const playButton = document.getElementById("playButton");
  const progress = document.getElementById("progress");
  const volume = document.getElementById("volume");
  const state = { tracks: [], index: -1, shuffle: false, repeat: false };

  const $ = (id) => document.getElementById(id);
  const clampPercent = (value) => `${Math.max(0, Math.min(100, value * 100)).toFixed(0)}%`;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[character]);
  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return "0:00";
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  };

  function updateSignal(signal) {
    const values = {
      bass: Math.round(signal.bass * 100),
      mid: Math.round(signal.mids * 100),
      treble: Math.round(signal.treble * 100)
    };
    $("bassValue").textContent = String(values.bass).padStart(2, "0");
    $("midValue").textContent = String(values.mid).padStart(2, "0");
    $("trebleValue").textContent = String(values.treble).padStart(2, "0");
    $("bassMeter").style.width = clampPercent(signal.bass);
    $("midMeter").style.width = clampPercent(signal.mids);
    $("trebleMeter").style.width = clampPercent(signal.treble);
    $("frequencyValue").textContent = 44 + Math.round(signal.bass * 32);

    const accentHue = Math.round((signal.hue + 105) % 360);
    document.documentElement.style.setProperty("--accent", `hsl(${accentHue}, 92%, 66%)`);
    document.documentElement.style.setProperty("--accent-rgb", "181, 255, 82");
  }

  const visualizer = new window.ResonanceVisualizer($("visualizer"), audio, updateSignal);

  function normalizeBrowserTracks(files) {
    return Array.from(files)
      .filter((file) => file.type.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|flac|aac)$/i.test(file.name))
      .map((file, index) => {
        const parts = file.webkitRelativePath.split("/");
        return {
          id: `${file.name}-${file.size}-${index}`,
          name: file.name.replace(/\.[^.]+$/, ""),
          fileName: file.name,
          album: parts.length > 1 ? parts[parts.length - 2] : "Local files",
          artist: parts.length > 2 ? parts[parts.length - 3] : "Local library",
          url: URL.createObjectURL(file),
          cover: ""
        };
      });
  }

  function desktopTrack(track) {
    return { ...track, url: window.resonanceDesktop.toFileUrl(track.path) };
  }

  function setTracks(tracks) {
    state.tracks.forEach((track) => {
      if (track.url && track.url.startsWith("blob:")) URL.revokeObjectURL(track.url);
    });
    state.tracks = tracks;
    state.index = tracks.length ? 0 : -1;
    $("trackCount").textContent = `${tracks.length} track${tracks.length === 1 ? "" : "s"}`;
    $("queueCount").textContent = tracks.length;
    $("emptyState").classList.toggle("hidden", tracks.length > 0);
    $("trackTable").classList.toggle("hidden", tracks.length === 0);
    renderTracks();
    if (tracks.length) loadTrack(0, false);
    else resetPlayer();
  }

  function addTracks(tracks) {
    const existingIds = new Set(state.tracks.map((track) => track.id));
    const newTracks = tracks.filter((track) => !existingIds.has(track.id));
    if (!newTracks.length) return;
    if (!state.tracks.length) return setTracks(newTracks);
    state.tracks.push(...newTracks);
    $("trackCount").textContent = `${state.tracks.length} tracks`;
    $("queueCount").textContent = state.tracks.length;
    renderTracks();
    const next = state.tracks[(state.index + 1) % state.tracks.length];
    $("nextTitle").textContent = next.name;
    $("nextArtist").textContent = next.artist;
  }

  function resetPlayer() {
    audio.pause();
    audio.removeAttribute("src");
    $("heroTitle").textContent = "Import your frequencies";
    $("heroArtist").textContent = "Choose a local music folder to begin";
    $("sideTitle").textContent = "No track selected";
    $("sideArtist").textContent = "Import a folder to start";
    $("footerTitle").textContent = "Nothing playing yet";
    $("footerArtist").textContent = "Resonance offline player";
    $("nextTitle").textContent = "Waiting for local tracks";
    $("nextArtist").textContent = "Your queue is empty";
    $("visualStatus").textContent = "LIVE ANALYZER";
    applyCover({ cover: "" });
  }

  function removeTrack(index) {
    const wasCurrent = index === state.index;
    const [removed] = state.tracks.splice(index, 1);
    if (removed.url && removed.url.startsWith("blob:")) URL.revokeObjectURL(removed.url);
    $("trackCount").textContent = `${state.tracks.length} track${state.tracks.length === 1 ? "" : "s"}`;
    $("queueCount").textContent = state.tracks.length;
    $("emptyState").classList.toggle("hidden", state.tracks.length > 0);
    $("trackTable").classList.toggle("hidden", state.tracks.length === 0);
    if (!state.tracks.length) {
      state.index = -1;
      resetPlayer();
    } else if (wasCurrent) {
      loadTrack(Math.min(index, state.tracks.length - 1), false);
    } else {
      if (index < state.index) state.index -= 1;
      renderTracks();
    }
  }

  function renderTracks() {
    trackList.replaceChildren(...state.tracks.map((track, index) => {
      const row = document.createElement("div");
      row.className = `track-row${index === state.index ? " current" : ""}`;
      row.dataset.index = index;
      const thumb = track.cover
        ? `<img class="track-thumbnail" alt="" src="${escapeHtml(track.cover)}">`
        : `<span class="track-thumbnail">${escapeHtml(track.name.slice(0, 1).toUpperCase())}</span>`;
      row.innerHTML = `
        <span class="track-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="track-name">${thumb}<span><b>${escapeHtml(track.name)}</b><small>${escapeHtml(track.artist)}</small></span></span>
        <span>${escapeHtml(track.album)}</span>
        <span>LOCAL</span>
        <button class="track-menu" type="button" aria-label="Remove from queue">×</button>`;
      row.addEventListener("dblclick", () => loadTrack(index, true));
      row.addEventListener("click", (event) => {
        if (event.target.closest(".track-menu")) removeTrack(index);
        else loadTrack(index, true);
      });
      return row;
    }));
  }

  function applyCover(track) {
    const cover = track.cover || "";
    $("recordArt").classList.toggle("has-cover", Boolean(cover));
    $("recordArt").style.backgroundImage = cover ? `url("${cover}")` : "";
    $("miniCover").style.backgroundImage = cover ? `url("${cover}")` : "";
    $("miniCover").querySelector("span").style.display = cover ? "none" : "";
  }

  function loadTrack(index, autoplay) {
    if (!state.tracks.length) return;
    state.index = (index + state.tracks.length) % state.tracks.length;
    const track = state.tracks[state.index];
    audio.src = track.url;
    $("heroTitle").textContent = track.name;
    $("heroArtist").textContent = `${track.artist} · ${track.album}`;
    $("sideTitle").textContent = track.name;
    $("sideArtist").textContent = track.artist;
    $("footerTitle").textContent = track.name;
    $("footerArtist").textContent = track.artist;
    $("nextTitle").textContent = state.tracks[(state.index + 1) % state.tracks.length].name;
    $("nextArtist").textContent = state.tracks[(state.index + 1) % state.tracks.length].artist;
    $("visualStatus").textContent = autoplay ? "ANALYZING AUDIO" : "READY TO PLAY";
    applyCover(track);
    renderTracks();
    if (autoplay) play();
  }

  async function play() {
    if (!audio.src && state.tracks.length) loadTrack(0, false);
    if (!audio.src) return;
    visualizer.resume();
    try {
      await audio.play();
    } catch {
      $("visualStatus").textContent = "PRESS PLAY TO BEGIN";
    }
  }

  function next() {
    if (!state.tracks.length) return;
    if (state.shuffle) return loadTrack(Math.floor(Math.random() * state.tracks.length), true);
    loadTrack(state.index + 1, true);
  }

  function toggleShuffle() {
    state.shuffle = !state.shuffle;
    $("shuffleControl").style.color = state.shuffle ? "var(--accent)" : "";
    $("shuffleButton").textContent = state.shuffle ? "Shuffle active" : "Shuffle queue";
  }

  filePicker.addEventListener("change", (event) => setTracks(normalizeBrowserTracks(event.target.files)));
  singleFilePicker.addEventListener("change", (event) => {
    addTracks(normalizeBrowserTracks(event.target.files));
    event.target.value = "";
  });
  desktopImport.addEventListener("click", async () => {
    const tracks = await window.resonanceDesktop.chooseFolder();
    if (tracks.length) setTracks(tracks.map(desktopTrack));
  });
  desktopFileImport.addEventListener("click", async () => {
    const tracks = await window.resonanceDesktop.chooseFiles();
    if (tracks.length) addTracks(tracks.map(desktopTrack));
  });
  playButton.addEventListener("click", () => audio.paused ? play() : audio.pause());
  $("previousButton").addEventListener("click", () => loadTrack(state.index - 1, true));
  $("nextButton").addEventListener("click", next);
  $("shuffleButton").addEventListener("click", toggleShuffle);
  $("shuffleControl").addEventListener("click", toggleShuffle);
  $("clearButton").addEventListener("click", () => setTracks([]));
  $("repeatButton").addEventListener("click", () => {
    state.repeat = !state.repeat;
    $("repeatButton").style.color = state.repeat ? "var(--accent)" : "";
  });
  volume.addEventListener("input", () => {
    audio.volume = volume.value / 100;
    volume.style.setProperty("--range-fill", `${volume.value}%`);
  });
  progress.addEventListener("input", () => {
    if (audio.duration) audio.currentTime = audio.duration * progress.value / 100;
  });
  audio.addEventListener("play", () => {
    playButton.classList.add("playing");
    $("recordArt").classList.add("spinning");
    $("visualStatus").textContent = "ANALYZING AUDIO";
  });
  audio.addEventListener("pause", () => {
    playButton.classList.remove("playing");
    $("recordArt").classList.remove("spinning");
    if (audio.src) $("visualStatus").textContent = "PLAYBACK PAUSED";
  });
  audio.addEventListener("timeupdate", () => {
    const percent = audio.duration ? audio.currentTime / audio.duration * 100 : 0;
    progress.value = percent;
    progress.style.setProperty("--range-fill", `${percent}%`);
    $("elapsed").textContent = formatTime(audio.currentTime);
    $("duration").textContent = formatTime(audio.duration);
  });
  audio.addEventListener("ended", () => state.repeat ? loadTrack(state.index, true) : next());

  if (window.resonanceDesktop) {
    document.body.classList.add("is-desktop");
    document.querySelectorAll(".browser-import").forEach((element) => {
      element.style.display = "none";
    });
    desktopImport.style.display = "flex";
    desktopFileImport.style.display = "flex";
  }
  audio.volume = 0.78;
})();
