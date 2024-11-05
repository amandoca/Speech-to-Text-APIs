let startButton = document.getElementById("startRecButton");
let pauseButton = document.getElementById("pauseRecButton");
let resumeButton = document.getElementById("resumeRecButton");
let stopButton = document.getElementById("stopRecButton");
let transcriptArea = document.getElementById("transcript");
let statusElement = document.getElementById("status");
let finalTranscript = ""; // Armazena a transcrição acumulada

startButton.addEventListener("click", startRecording);
pauseButton.addEventListener("click", pauseRecording);
resumeButton.addEventListener("click", resumeRecording);
stopButton.addEventListener("click", stopRecording);

async function startRecording() {
  startButton.disabled = true;
  pauseButton.disabled = false;
  stopButton.disabled = false;
  statusElement.innerHTML = "Gravando...";

  try {
    window.globalStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    window.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)({ sampleRate: 16000 });

    window.mediaRecorder = new MediaRecorder(window.globalStream);
    window.recordedChunks = [];

    window.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        window.recordedChunks.push(event.data);
      }
    };

    window.mediaRecorder.start();

    statusElement.innerHTML = "Gravando...";
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

  if (window.mediaRecorder && window.mediaRecorder.state === "recording") {
    window.mediaRecorder.pause();
  }
}

function resumeRecording() {
  pauseButton.disabled = false;
  resumeButton.disabled = true;
  statusElement.innerHTML = "Gravando...";

  if (window.mediaRecorder && window.mediaRecorder.state === "paused") {
    window.mediaRecorder.resume();
  }
}

function stopRecording() {
  startButton.disabled = false;
  pauseButton.disabled = true;
  resumeButton.disabled = true;
  stopButton.disabled = true;
  statusElement.innerHTML = "Processando gravação...";

  if (
    window.mediaRecorder &&
    (window.mediaRecorder.state === "recording" ||
      window.mediaRecorder.state === "paused")
  ) {
    window.mediaRecorder.stop();
  }

  if (window.globalStream) {
    window.globalStream.getTracks().forEach((track) => track.stop());
    window.globalStream = null;
  }

  window.mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(window.recordedChunks, { type: "audio/wav" });
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");

    try {
      const response = await fetch("/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (data.transcript) {
        finalTranscript = data.transcript;
        transcriptArea.value = finalTranscript;
        statusElement.innerHTML = "Transcrição concluída.";
      } else {
        statusElement.innerHTML = "Erro na transcrição.";
      }
    } catch (err) {
      console.error("Erro ao enviar o áudio para transcrição:", err);
      statusElement.innerHTML = "Erro na transcrição.";
    }

    // Reproduzir o áudio gravado
    const audioURL = URL.createObjectURL(audioBlob);
    const audioElement = document.createElement("audio");
    audioElement.controls = true;
    audioElement.src = audioURL;
    const audioPlayerContainer = document.getElementById(
      "audioPlayerContainer"
    );
    audioPlayerContainer.innerHTML = ""; // Limpa qualquer áudio anterior
    audioPlayerContainer.appendChild(audioElement);
  };

  finalTranscript = ""; // Limpar a transcrição para a próxima gravação
}
