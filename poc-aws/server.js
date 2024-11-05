require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const { TranscribeStreamingClient, StartStreamTranscriptionCommand } = require("@aws-sdk/client-transcribe-streaming");
const { Buffer } = require("buffer");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static("public"));

const transcribeClient = new TranscribeStreamingClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

io.on("connection", (socket) => {
  console.log("Cliente conectado");

  let recognizeStream;
  let audioStreamQueue = [];
  let isStreaming = false;

  async function startRecognition() {
    isStreaming = true;

    async function* getAudioStream() {
      const silenceChunk = Buffer.alloc(320);
      while (isStreaming) {
        if (audioStreamQueue.length > 0) {
          const audioChunk = audioStreamQueue.shift();
          yield { AudioEvent: { AudioChunk: audioChunk } };
        } else {
          yield { AudioEvent: { AudioChunk: silenceChunk } };
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }

    try {
      recognizeStream = await transcribeClient.send(
        new StartStreamTranscriptionCommand({
          LanguageCode: "pt-BR",
          MediaEncoding: "pcm",
          MediaSampleRateHertz: 44100,
          AudioStream: getAudioStream(),
        })
      );

      for await (const event of recognizeStream.TranscriptResultStream) {
        const results = event.TranscriptEvent.Transcript.Results;
        if (results.length && !results[0].IsPartial) {
          const finalTranscript = results[0].Alternatives[0].Transcript;
          console.log("Transcrição em andamento...:", finalTranscript);
          socket.emit("speechData", finalTranscript);
        }
      }
    } catch (error) {
      console.error("Erro durante a transcrição:", error);
      socket.emit("error", "Erro durante a transcrição");
    }
  }

  socket.on("startAWSStream", () => {
    console.log("Iniciando o fluxo de reconhecimento com AWS Transcribe");
    audioStreamQueue = [];
    startRecognition();
  });

  socket.on("binaryData", (data) => {
    const bufferData = Buffer.from(data);
    if (bufferData.length > 0) {
      audioStreamQueue.push(bufferData);
    }
  });

  socket.on("stopAWSStream", () => {
    console.log("Parando o fluxo de reconhecimento");
    isStreaming = false;
    audioStreamQueue = [];
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado");
    isStreaming = false;
    audioStreamQueue = [];
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor ouvindo na porta ${PORT}`);
});
