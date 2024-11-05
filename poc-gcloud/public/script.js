let socket;
let audioContext;
let globalStream;
let recordedChunks = [];
let mediaRecorder;
let startButton = document.getElementById("startRecButton");
let pauseButton = document.getElementById("pauseRecButton");
let resumeButton = document.getElementById("resumeRecButton");
let stopButton = document.getElementById("stopRecButton");
let transcriptArea = document.getElementById("transcript");
let statusElement = document.getElementById("status");
let audioPlayerContainer = document.getElementById("audioPlayerContainer"); // Container para o player de áudio
let finalTranscript = "";

startButton.addEventListener("click", startRecording);
pauseButton.addEventListener("click", pauseRecording);
resumeButton.addEventListener("click", resumeRecording);
stopButton.addEventListener("click", stopRecording);

function initSocket() {
  socket = io.connect();

  socket.on("connect", function () {
    socket.emit("startGoogleCloudStream", "");
  });

  socket.on("speechData", function (data) {
    finalTranscript += ` ${data}`; // Acumula apenas novos trechos finais
    transcriptArea.value = finalTranscript.trim();
    statusElement.innerHTML = "Transcrição em andamento...";
  });

  socket.on("error", function (err) {
    console.error("Erro:", err);
    statusElement.innerHTML = "Erro: " + err;
  });
}

async function startRecording() {
  startButton.disabled = true;
  pauseButton.disabled = false;
  stopButton.disabled = false;
  statusElement.innerHTML = "Gravando...";

  initSocket();

  try {
    globalStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });

    // Configurar MediaRecorder para gravar o áudio
    mediaRecorder = new MediaRecorder(globalStream);
    mediaRecorder.ondataavailable = (event) => recordedChunks.push(event.data);
    mediaRecorder.start();

    await audioContext.audioWorklet.addModule("processor.js");

    const input = audioContext.createMediaStreamSource(globalStream);
    const audioWorkletNode = new AudioWorkletNode(audioContext, "recorder-processor", {
      processorOptions: { bufferSize: 512 },
    });

    audioWorkletNode.port.onmessage = (event) => {
      const channelData = event.data;
      if (channelData) {
        const left16 = downsampleBuffer(channelData, audioContext.sampleRate, 16000);
        socket.emit("binaryData", left16); // Enviar imediatamente
      }
    };

    input.connect(audioWorkletNode);
    audioWorkletNode.connect(audioContext.destination);

    window.audioWorkletNode = audioWorkletNode;
  } catch (err) {
    console.error("Erro ao acessar o microfone:", err);
    statusElement.innerHTML = "Erro ao acessar o microfone.";
    startButton.disabled = false;
    pauseButton.disabled = true;
    stopButton.disabled = true;
  }
}

function pauseRecording() {
  pauseButton.disabled = true;
  resumeButton.disabled = false;
  statusElement.innerHTML = "Gravação pausada.";

  if (window.audioWorkletNode) {
    window.audioWorkletNode.port.postMessage("pause");
  }
  mediaRecorder.pause();
}

function resumeRecording() {
  pauseButton.disabled = false;
  resumeButton.disabled = true;
  statusElement.innerHTML = "Gravando...";

  if (window.audioWorkletNode) {
    window.audioWorkletNode.port.postMessage("resume");
  }
  mediaRecorder.resume();
}

function stopRecording() {
  startButton.disabled = false;
  pauseButton.disabled = true;
  resumeButton.disabled = true;
  stopButton.disabled = true;
  statusElement.innerHTML = "Parado.";

  socket.emit("endGoogleCloudStream", "");
  socket.disconnect();

  if (window.audioWorkletNode) {
    window.audioWorkletNode.disconnect();
    window.audioWorkletNode = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (globalStream) {
    globalStream.getTracks().forEach((track) => track.stop());
    globalStream = null;
  }

  // Parar a gravação e processar o áudio
  mediaRecorder.stop();
  mediaRecorder.onstop = () => {
    const audioBlob = new Blob(recordedChunks, { type: "audio/wav" });
    const audioURL = URL.createObjectURL(audioBlob);

    // Criar o player de áudio e exibir na interface
    const audioElement = document.createElement("audio");
    audioElement.controls = true;
    audioElement.src = audioURL;
    audioPlayerContainer.innerHTML = ""; // Limpar players anteriores
    audioPlayerContainer.appendChild(audioElement);

    recordedChunks = []; // Limpar os chunks gravados para nova gravação
  };

  finalTranscript = "";
}

// Função para converter o buffer de áudio para Int16
function downsampleBuffer(buffer, sampleRate, outSampleRate) {
  if (!buffer || !sampleRate || !outSampleRate) return;
  if (outSampleRate === sampleRate) {
    return convertFloat32ToInt16(buffer);
  }
  let sampleRateRatio = sampleRate / outSampleRate;
  let newLength = Math.round(buffer.length / sampleRateRatio);
  let result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    let nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0,
      count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = accum / count;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return convertFloat32ToInt16(result);
}

function convertFloat32ToInt16(buffer) {
  let l = buffer.length;
  let buf = new Int16Array(l);
  while (l--) {
    buf[l] = Math.min(1, buffer[l]) * 0x7fff;
  }
  return buf.buffer;
}
