import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} from "@aws-sdk/client-transcribe-streaming";
import MicrophoneStream from "microphone-stream";
import { Buffer } from "buffer";

const AWS_REGION = process.env.AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

const startButton = document.getElementById("startRecButton");
const pauseButton = document.getElementById("pauseRecButton");
const resumeButton = document.getElementById("resumeRecButton");
const stopButton = document.getElementById("stopRecButton");
const transcriptionTextarea = document.getElementById("transcription");
const statusDiv = document.getElementById("status");
const audioPlayerContainer = document.createElement("audio");
audioPlayerContainer.controls = true;
audioPlayerContainer.style.display = "none";
document.getElementById("audioPlayerContainer").appendChild(audioPlayerContainer);

let microphoneStream;
let globalStream;
const SAMPLE_RATE = 44100;
let transcribeClient;
let transcription = "";
let isRecording = false;
let mediaRecorder;
let recordedChunks = [];
let isPaused = false; // Controla o status da pausa

const updateStatus = (message) => {
  statusDiv.textContent = message;
};

const toggleButtons = (isRecording) => {
  startButton.disabled = isRecording;
  stopButton.disabled = !isRecording;
  pauseButton.disabled = !isRecording;
  resumeButton.disabled = true;
};

const createMicrophoneStream = async () => {
  globalStream = await window.navigator.mediaDevices.getUserMedia({
    video: false,
    audio: true,
  });
  
  microphoneStream = new MicrophoneStream();
  microphoneStream.setStream(globalStream);

  mediaRecorder = new MediaRecorder(globalStream);
  mediaRecorder.ondataavailable = (event) => recordedChunks.push(event.data);
};

const createTranscribeClient = () => {
  if (transcribeClient) {
    transcribeClient.destroy();
    transcribeClient = null;
  }

  transcribeClient = new TranscribeStreamingClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
    },
  });
};

const startStreaming = async (language, callback) => {
  const command = new StartStreamTranscriptionCommand({
    LanguageCode: language,
    MediaEncoding: "pcm",
    MediaSampleRateHertz: SAMPLE_RATE,
    AudioStream: getAudioStream(),
  });

  try {
    const data = await transcribeClient.send(command);
    updateStatus("Gravando...");

    for await (const event of data.TranscriptResultStream) {
      if (isPaused) continue; // Se pausado, ignora transcrição

      const results = event.TranscriptEvent.Transcript.Results;
      if (results.length && !results[0].IsPartial) {
        const newTranscript = results[0].Alternatives[0].Transcript;
        callback(newTranscript + " ");
      }
    }
  } catch (error) {
    updateStatus("Erro na transcrição.");
  }
};

const getAudioStream = async function* () {
  for await (const chunk of microphoneStream) {
    if (isPaused) continue; // Se pausado, ignora o envio de chunks
    if (chunk.length <= SAMPLE_RATE) {
      yield { AudioEvent: { AudioChunk: encodePCMChunk(chunk) } };
    }
  }
};

const encodePCMChunk = (chunk) => {
  const input = MicrophoneStream.toRaw(chunk);
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return Buffer.from(buffer);
};

const startRecording = async (callback) => {
  if (isRecording) stopRecording();

  createTranscribeClient();
  await createMicrophoneStream();
  transcription = "";
  isRecording = true;
  isPaused = false; // Inicializa a gravação como ativa
  toggleButtons(true);

  mediaRecorder.start();
  audioPlayerContainer.style.display = "none";

  await startStreaming("pt-BR", (text) => {
    transcription += text;
    transcriptionTextarea.value = transcription;
  });
};

const pauseRecording = () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.pause();
    isPaused = true; // Define como pausado
    updateStatus("Gravação pausada.");
    pauseButton.disabled = true;
    resumeButton.disabled = false;
  }
};

const resumeRecording = () => {
  if (mediaRecorder && mediaRecorder.state === "paused") {
    mediaRecorder.resume();
    isPaused = false; // Retoma a transcrição
    updateStatus("Gravando...");
    pauseButton.disabled = false;
    resumeButton.disabled = true;
  }
};

const stopRecording = () => {
  if (!isRecording) return;

  if (microphoneStream) {
    microphoneStream.stop();
    microphoneStream = null;
  }
  if (transcribeClient) {
    transcribeClient.destroy();
    transcribeClient = null;
  }

  isRecording = false;
  isPaused = false; // Parar a transcrição
  updateStatus("Gravação parada.");
  toggleButtons(false);

  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(recordedChunks, { type: "audio/wav" });
      const audioURL = URL.createObjectURL(audioBlob);
      audioPlayerContainer.src = audioURL;
      audioPlayerContainer.style.display = "block";
      recordedChunks = [];
    };
  }
};

startButton.addEventListener("click", async () => {
  updateStatus("Iniciando a gravação...");
  await startRecording((text) => {
    transcription += text;
    transcriptionTextarea.value = transcription;
  });
});

pauseButton.addEventListener("click", () => {
  pauseRecording();
});

resumeButton.addEventListener("click", () => {
  resumeRecording();
});

stopButton.addEventListener("click", () => {
  stopRecording();
});
