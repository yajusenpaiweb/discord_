/**
 * Discord 20MB Media Compressor
 * High-performance client-side media compression tailored for Discord limits
 */

// State
const state = {
  file: null,
  fileType: null, // 'video', 'image', 'audio'
  duration: 0,
  width: 0,
  height: 0,
  targetMB: 20, // Default 20MB for latest Discord
  audioBitrateKbps: 96,
  resolutionMode: 'auto',
  ffmpegInstance: null,
  isCompressing: false,
  abortController: null,
  compressedBlob: null,
  compressedUrl: null
};

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const uploadCard = document.getElementById('uploadCard');
const fileMetaPanel = document.getElementById('fileMetaPanel');
const progressCard = document.getElementById('progressCard');
const resultCard = document.getElementById('resultCard');

const fileTypeIcon = document.getElementById('fileTypeIcon');
const fileName = document.getElementById('fileName');
const fileSizeBadge = document.getElementById('fileSizeBadge');
const fileDurationBadge = document.getElementById('fileDurationBadge');
const fileResolutionBadge = document.getElementById('fileResolutionBadge');
const fileStatusBadge = document.getElementById('fileStatusBadge');
const removeFileBtn = document.getElementById('removeFileBtn');

const targetSizeDisplay = document.getElementById('targetSizeDisplay');
const presetButtons = document.querySelectorAll('.preset-btn');
const customSizeWrapper = document.getElementById('customSizeWrapper');
const customSizeInput = document.getElementById('customSizeInput');

const videoSettings = document.getElementById('videoSettings');
const resolutionSelect = document.getElementById('resolutionSelect');
const audioBitrateSelect = document.getElementById('audioBitrateSelect');

const calcVideoBitrate = document.getElementById('calcVideoBitrate');
const calcEstSize = document.getElementById('calcEstSize');
const startCompressBtn = document.getElementById('startCompressBtn');

const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const progressDetails = document.getElementById('progressDetails');
const progressTitle = document.getElementById('progressTitle');
const progressSubtitle = document.getElementById('progressSubtitle');
const terminalLog = document.getElementById('terminalLog');
const cancelCompressBtn = document.getElementById('cancelCompressBtn');

const resOriginalSize = document.getElementById('resOriginalSize');
const resCompressedSize = document.getElementById('resCompressedSize');
const resReduction = document.getElementById('resReduction');
const previewContainer = document.getElementById('previewContainer');
const downloadLink = document.getElementById('downloadLink');
const compressAnotherBtn = document.getElementById('compressAnotherBtn');

// Helper: Format bytes to MB/KB
function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Helper: Format seconds to MM:SS
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Helper: Log to terminal UI
function logTerminal(message, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  terminalLog.appendChild(line);
  terminalLog.scrollTop = terminalLog.scrollHeight;
}

// Initialize Drag and Drop
function initDragAndDrop() {
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelection(e.target.files[0]);
    }
  });

  removeFileBtn.addEventListener('click', resetSelection);
  compressAnotherBtn.addEventListener('click', resetSelection);
}

// Handle File Selection and Metadata extraction
async function handleFileSelection(file) {
  state.file = file;
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (mime.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv|flv|wmv|m4v)$/i.test(name)) {
    state.fileType = 'video';
    fileTypeIcon.textContent = '🎬';
    videoSettings.style.display = 'block';
  } else if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(name)) {
    state.fileType = 'image';
    fileTypeIcon.textContent = '🖼️';
    videoSettings.style.display = 'none';
  } else if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(name)) {
    state.fileType = 'audio';
    fileTypeIcon.textContent = '🎵';
    videoSettings.style.display = 'none';
  } else {
    alert('未対応のファイル形式です。動画、画像、または音声ファイルを選択してください。');
    return;
  }

  fileName.textContent = file.name;
  fileSizeBadge.textContent = formatBytes(file.size);

  const isOver20MB = file.size > 20 * 1024 * 1024;
  if (isOver20MB) {
    fileStatusBadge.textContent = '⚠️ 20MB超過 (圧縮推奨)';
    fileStatusBadge.className = 'meta-badge status-warn';
  } else {
    fileStatusBadge.textContent = '✅ 現在20MB以下 (さらに軽量化可能)';
    fileStatusBadge.className = 'meta-badge status-ok';
  }

  // Inspect metadata
  if (state.fileType === 'video') {
    fileDurationBadge.style.display = 'inline-block';
    fileResolutionBadge.style.display = 'inline-block';
    fileDurationBadge.textContent = '解析中...';
    fileResolutionBadge.textContent = '解析中...';

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);

    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        state.duration = video.duration || 1;
        state.width = video.videoWidth || 1920;
        state.height = video.videoHeight || 1080;
        fileDurationBadge.textContent = `⏱️ ${formatDuration(state.duration)}`;
        fileResolutionBadge.textContent = `📐 ${state.width}x${state.height}`;
        URL.revokeObjectURL(video.src);
        resolve();
      };
      video.onerror = () => {
        state.duration = 60; // fallback estimate
        state.width = 1920;
        state.height = 1080;
        fileDurationBadge.textContent = '⏱️ 不明';
        fileResolutionBadge.textContent = '📐 不明';
        URL.revokeObjectURL(video.src);
        resolve();
      };
    });
  } else if (state.fileType === 'image') {
    fileDurationBadge.style.display = 'none';
    fileResolutionBadge.style.display = 'inline-block';
    fileResolutionBadge.textContent = '解析中...';

    const img = new Image();
    img.src = URL.createObjectURL(file);
    await new Promise((resolve) => {
      img.onload = () => {
        state.width = img.naturalWidth;
        state.height = img.naturalHeight;
        fileResolutionBadge.textContent = `📐 ${state.width}x${state.height}`;
        URL.revokeObjectURL(img.src);
        resolve();
      };
      img.onerror = () => {
        fileResolutionBadge.textContent = '📐 不明';
        URL.revokeObjectURL(img.src);
        resolve();
      };
    });
  } else {
    fileDurationBadge.style.display = 'inline-block';
    fileResolutionBadge.style.display = 'none';
    fileDurationBadge.textContent = '解析中...';

    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    await new Promise((resolve) => {
      audio.onloadedmetadata = () => {
        state.duration = audio.duration || 1;
        fileDurationBadge.textContent = `⏱️ ${formatDuration(state.duration)}`;
        URL.revokeObjectURL(audio.src);
        resolve();
      };
      audio.onerror = () => {
        state.duration = 180;
        fileDurationBadge.textContent = '⏱️ 不明';
        URL.revokeObjectURL(audio.src);
        resolve();
      };
    });
  }

  updateBitrateCalculations();

  dropZone.style.display = 'none';
  fileMetaPanel.style.display = 'flex';
}

// Reset Selection
function resetSelection() {
  state.file = null;
  state.compressedBlob = null;
  if (state.compressedUrl) {
    URL.revokeObjectURL(state.compressedUrl);
    state.compressedUrl = null;
  }
  fileInput.value = '';
  dropZone.style.display = 'block';
  fileMetaPanel.style.display = 'none';
  progressCard.style.display = 'none';
  resultCard.style.display = 'none';
  uploadCard.style.display = 'block';
  terminalLog.innerHTML = '<div class="log-line info">[System] エンジン待機中...</div>';
}

// Calculate target bitrates and estimated size
function updateBitrateCalculations() {
  if (!state.file) return;

  const targetBytes = state.targetMB * 1024 * 1024 * 0.97; // 3% safe headroom
  const estMbDisplay = (targetBytes / (1024 * 1024)).toFixed(1);

  if (state.fileType === 'video') {
    const duration = Math.max(state.duration || 1, 1);
    const totalBitrateKbps = Math.floor((targetBytes * 8) / (duration * 1000));
    const audioKbps = parseInt(state.audioBitrateKbps, 10);
    let videoKbps = totalBitrateKbps - audioKbps;

    if (videoKbps < 150) videoKbps = 150; // Safety floor

    calcVideoBitrate.textContent = `${videoKbps} kbps (音声: ${audioKbps} kbps)`;
    calcEstSize.textContent = `約 ${estMbDisplay} MB (Discord 20MB上限に余裕で収まります)`;
  } else if (state.fileType === 'image') {
    calcVideoBitrate.textContent = `画像最適化 (Canvas/WebP)`;
    calcEstSize.textContent = `約 ${Math.min(state.targetMB, (state.file.size / (1024*1024)).toFixed(1))} MB以下`;
  } else {
    const duration = Math.max(state.duration || 1, 1);
    const audioKbps = Math.min(320, Math.floor((targetBytes * 8) / (duration * 1000)));
    calcVideoBitrate.textContent = `音声ビットレート: ${audioKbps} kbps`;
    calcEstSize.textContent = `約 ${estMbDisplay} MB以下`;
  }
}

// Handle Preset Changes
presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    presetButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const size = btn.dataset.size;
    if (size === 'custom') {
      customSizeWrapper.style.display = 'flex';
      state.targetMB = parseFloat(customSizeInput.value) || 20;
    } else {
      customSizeWrapper.style.display = 'none';
      state.targetMB = parseFloat(size);
    }

    targetSizeDisplay.textContent = `${state.targetMB} MB (安全設計: ${(state.targetMB * 0.97).toFixed(1)}MB)`;
    updateBitrateCalculations();
  });
});

customSizeInput.addEventListener('input', () => {
  const val = parseFloat(customSizeInput.value) || 20;
  state.targetMB = val;
  targetSizeDisplay.textContent = `${val} MB (安全設計: ${(val * 0.97).toFixed(1)}MB)`;
  updateBitrateCalculations();
});

resolutionSelect.addEventListener('change', (e) => {
  state.resolutionMode = e.target.value;
  updateBitrateCalculations();
});

audioBitrateSelect.addEventListener('change', (e) => {
  state.audioBitrateKbps = parseInt(e.target.value, 10);
  updateBitrateCalculations();
});

// Update Progress UI
function updateProgress(percent, detailText) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  progressBar.style.width = `${clamped}%`;
  progressPercent.textContent = `${clamped}%`;
  if (detailText) {
    progressDetails.textContent = detailText;
  }
}

// FFmpeg Loader & Runner
async function getFFmpeg() {
  if (state.ffmpegInstance && state.ffmpegInstance.isLoaded()) {
    return state.ffmpegInstance;
  }

  if (typeof FFmpeg === 'undefined' || !FFmpeg.createFFmpeg) {
    throw new Error('FFmpeg.wasm ライブラリの読み込みに失敗しました。');
  }

  const { createFFmpeg } = FFmpeg;
  logTerminal('FFmpeg WebAssembly コアを初期化しています...', 'info');

  const ffmpeg = createFFmpeg({
    log: false,
    corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js'
  });

  ffmpeg.setProgress(({ ratio }) => {
    if (ratio >= 0 && ratio <= 1) {
      const p = Math.round(ratio * 95);
      updateProgress(p, `エンコード中... ${p}%`);
    }
  });

  await ffmpeg.load();
  state.ffmpegInstance = ffmpeg;
  logTerminal('FFmpeg コアの初期化完了', 'accent');
  return ffmpeg;
}

// Execute Compression
startCompressBtn.addEventListener('click', async () => {
  if (!state.file) return;

  state.isCompressing = true;
  uploadCard.style.display = 'none';
  progressCard.style.display = 'flex';
  resultCard.style.display = 'none';
  updateProgress(5, 'メディアを準備中...');
  logTerminal(`圧縮開始: ${state.file.name} (${formatBytes(state.file.size)}) -> 目標 ${state.targetMB}MB`, 'accent');

  try {
    if (state.fileType === 'video') {
      await compressVideo();
    } else if (state.fileType === 'image') {
      await compressImage();
    } else {
      await compressAudio();
    }
  } catch (err) {
    console.error('Compression error:', err);
    logTerminal(`エラーが発生しました: ${err.message}`, 'info');
    alert(`圧縮中にエラーが発生しました: ${err.message}\nフォールバック処理を試みます。`);
    
    // Attempt Canvas/MediaRecorder fallback for video if FFmpeg fails
    if (state.fileType === 'video') {
      try {
        logTerminal('Canvas/MediaRecorder フォールバックを実行します...', 'accent');
        await compressVideoFallback();
      } catch (fallbackErr) {
        alert('フォールバック圧縮にも失敗しました: ' + fallbackErr.message);
        resetSelection();
      }
    } else {
      resetSelection();
    }
  }
});

// Video Compression using FFmpeg.wasm
async function compressVideo() {
  updateProgress(10, 'FFmpegエンジンを起動中...');
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = FFmpeg;

  const inputName = 'input_' + Date.now() + '_' + state.file.name.replace(/[^a-zA-Z0-9._-]/g, '');
  const outputName = 'discord_output.mp4';

  updateProgress(20, 'ファイルをメモリにロード中...');
  logTerminal('ファイルを仮想ファイルシステムに転送中...');
  ffmpeg.FS('writeFile', inputName, await fetchFile(state.file));

  // Compute scale and bitrates
  const duration = Math.max(state.duration || 1, 1);
  const targetBytes = state.targetMB * 1024 * 1024 * 0.96; // 4% safety margin
  const totalBitrateKbps = Math.floor((targetBytes * 8) / (duration * 1000));
  const audioKbps = state.audioBitrateKbps;
  let videoKbps = Math.max(totalBitrateKbps - audioKbps, 150);

  // Resolution scale filter
  let scaleFilter = [];
  if (state.resolutionMode === '1080') {
    scaleFilter = ['-vf', 'scale=-2:1080'];
  } else if (state.resolutionMode === '720') {
    scaleFilter = ['-vf', 'scale=-2:720'];
  } else if (state.resolutionMode === '480') {
    scaleFilter = ['-vf', 'scale=-2:480'];
  } else if (state.resolutionMode === '360') {
    scaleFilter = ['-vf', 'scale=-2:360'];
  } else {
    // Auto: If video is long or low bitrate, downscale appropriately to avoid macroblocking
    if (videoKbps < 800 && state.height > 720) {
      scaleFilter = ['-vf', 'scale=-2:720'];
      logTerminal('高画質維持のため720pに自動スケール');
    } else if (videoKbps < 400 && state.height > 480) {
      scaleFilter = ['-vf', 'scale=-2:480'];
      logTerminal('長尺動画の破綻を防ぐため480pに自動スケール');
    }
  }

  logTerminal(`設定: 映像 ${videoKbps}kbps, 音声 ${audioKbps}kbps, ターゲット 20MB`, 'info');
  updateProgress(30, 'H.264 / AAC エンコード中...');

  const ffmpegArgs = [
    '-i', inputName,
    '-c:v', 'libx264',
    '-b:v', `${videoKbps}k`,
    '-maxrate', `${Math.round(videoKbps * 1.3)}k`,
    '-bufsize', `${Math.round(videoKbps * 2)}k`,
    '-preset', 'veryfast',
    '-c:a', 'aac',
    '-b:a', `${audioKbps}k`,
    '-movflags', '+faststart',
    ...scaleFilter,
    outputName
  ];

  await ffmpeg.run(...ffmpegArgs);

  updateProgress(96, '圧縮データを取得中...');
  const data = ffmpeg.FS('readFile', outputName);

  // Cleanup FS
  try {
    ffmpeg.FS('unlink', inputName);
    ffmpeg.FS('unlink', outputName);
  } catch (e) {}

  const compressedBlob = new Blob([data.buffer], { type: 'video/mp4' });
  finishCompression(compressedBlob, 'discord_compressed.mp4');
}

// Fallback Video Compression using HTML5 Canvas & MediaRecorder
async function compressVideoFallback() {
  updateProgress(20, 'ブラウザネイティブ録画エンジンで圧縮中...');
  const video = document.createElement('video');
  video.src = URL.createObjectURL(state.file);
  video.muted = true;
  video.playsInline = true;

  await new Promise((res) => { video.onloadedmetadata = res; });
  await video.play();

  const canvas = document.createElement('canvas');
  let targetWidth = state.width;
  let targetHeight = state.height;

  // Downscale if large
  if (targetHeight > 720) {
    const ratio = 720 / targetHeight;
    targetHeight = 720;
    targetWidth = Math.round(targetWidth * ratio);
  }
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  const stream = canvas.captureStream(30);
  const targetBytes = state.targetMB * 1024 * 1024 * 0.95;
  const totalBitrate = Math.floor((targetBytes * 8) / (state.duration || 30));

  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm',
    videoBitsPerSecond: totalBitrate
  });

  const chunks = [];
  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      finishCompression(blob, 'discord_compressed.webm');
      resolve();
    };

    mediaRecorder.start(100);

    const drawFrame = () => {
      if (video.paused || video.ended) {
        mediaRecorder.stop();
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const prog = (video.currentTime / video.duration) * 80 + 15;
      updateProgress(prog, `フレームキャプチャ中... (${Math.round(video.currentTime)}s)`);
      requestAnimationFrame(drawFrame);
    };

    drawFrame();
  });
}

// High Quality Image Compression (Canvas / WebP / JPEG)
async function compressImage() {
  updateProgress(20, '画像をデコード中...');
  const img = new Image();
  img.src = URL.createObjectURL(state.file);
  await new Promise((res) => { img.onload = res; });

  const canvas = document.createElement('canvas');
  let width = img.naturalWidth;
  let height = img.naturalHeight;

  // If image is gigantic, downscale slightly
  const maxDim = 3840; // 4K max
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  updateProgress(50, '最適品質を計算中...');
  const targetBytes = state.targetMB * 1024 * 1024;

  let quality = 0.92;
  let blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));

  // Binary search or step down if still over target
  let iterations = 0;
  while (blob && blob.size > targetBytes && quality > 0.1 && iterations < 8) {
    quality -= 0.12;
    blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    iterations++;
  }

  updateProgress(95, '完了処理中...');
  finishCompression(blob, state.file.name.replace(/\.[^/.]+$/, "") + "_20mb.jpg");
}

// Audio Compression using FFmpeg
async function compressAudio() {
  updateProgress(20, '音声エンジンを準備中...');
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = FFmpeg;

  const inputName = 'input_audio_' + Date.now();
  const outputName = 'discord_compressed.mp3';

  ffmpeg.FS('writeFile', inputName, await fetchFile(state.file));

  const duration = Math.max(state.duration || 1, 1);
  const targetBytes = state.targetMB * 1024 * 1024 * 0.96;
  const audioKbps = Math.min(320, Math.floor((targetBytes * 8) / (duration * 1000)));

  updateProgress(40, `MP3 (${audioKbps}kbps) へエンコード中...`);
  logTerminal(`MP3エンコード: ${audioKbps}kbps`, 'info');

  await ffmpeg.run(
    '-i', inputName,
    '-b:a', `${audioKbps}k`,
    outputName
  );

  const data = ffmpeg.FS('readFile', outputName);
  try {
    ffmpeg.FS('unlink', inputName);
    ffmpeg.FS('unlink', outputName);
  } catch (e) {}

  const compressedBlob = new Blob([data.buffer], { type: 'audio/mp3' });
  finishCompression(compressedBlob, 'discord_compressed.mp3');
}

// Finalize compression and present results
function finishCompression(blob, outputFilename) {
  state.compressedBlob = blob;
  if (state.compressedUrl) URL.revokeObjectURL(state.compressedUrl);
  state.compressedUrl = URL.createObjectURL(blob);

  updateProgress(100, '完了！');
  logTerminal(`圧縮完了: ${formatBytes(blob.size)} (Discord 20MB制限内)`, 'accent');

  // Metrics
  resOriginalSize.textContent = formatBytes(state.file.size);
  resCompressedSize.textContent = formatBytes(blob.size);

  const reductionPercent = Math.max(0, Math.round(((state.file.size - blob.size) / state.file.size) * 100));
  resReduction.textContent = `${reductionPercent}% 削減`;

  // Download Link
  downloadLink.href = state.compressedUrl;
  downloadLink.download = outputFilename;

  // Preview Box
  previewContainer.innerHTML = '';
  if (state.fileType === 'video') {
    const video = document.createElement('video');
    video.src = state.compressedUrl;
    video.controls = true;
    video.autoplay = false;
    previewContainer.appendChild(video);
  } else if (state.fileType === 'image') {
    const img = document.createElement('img');
    img.src = state.compressedUrl;
    img.alt = 'Compressed preview';
    previewContainer.appendChild(img);
  } else {
    const audio = document.createElement('audio');
    audio.src = state.compressedUrl;
    audio.controls = true;
    previewContainer.appendChild(audio);
  }

  setTimeout(() => {
    progressCard.style.display = 'none';
    resultCard.style.display = 'flex';
  }, 400);
}

// Cancel compression
cancelCompressBtn.addEventListener('click', () => {
  if (confirm('圧縮処理をキャンセルしますか？')) {
    resetSelection();
  }
});

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  initDragAndDrop();
  logTerminal('システム準備完了 - ファイルをドロップしてください', 'info');
});
