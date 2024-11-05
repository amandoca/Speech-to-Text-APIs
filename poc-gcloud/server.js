require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const speech = require("@google-cloud/speech").v1p1beta1;
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const client = new speech.SpeechClient();

// Configuração do Google Cloud Speech-to-Text
const requestConfig = {
  config: {
    encoding: "LINEAR16",
    sampleRateHertz: 16000,
    languageCode: "pt-BR",
    enableAutomaticPunctuation: true, // Pontuação automática para melhorar clareza
  },
  interimResults: false, // Apenas resultados finais
};

// Servir arquivos estáticos da pasta 'public'
app.use(express.static("public"));

io.on("connection", (socket) => {
  console.log("Cliente conectado");

  let recognizeStream;
  let lastFinalTranscript = ""; // Armazena a última transcrição final para evitar duplicação

  socket.on("startGoogleCloudStream", () => {
    console.log("Iniciando o fluxo de reconhecimento com Google Cloud");

    recognizeStream = client
      .streamingRecognize(requestConfig)
      .on("data", (data) => {
        if (data.results[0] && data.results[0].isFinal) {
          const finalTranscript = data.results[0].alternatives[0].transcript;

          if (finalTranscript !== lastFinalTranscript) {
            console.log("Transcrição em andamento...:", finalTranscript);
            socket.emit("speechData", finalTranscript); // Envia apenas se for diferente do último
            lastFinalTranscript = finalTranscript; // Atualiza a última transcrição enviada
          }
        }
      })
      .on("error", (error) => {
        console.error("Erro de transcrição:", error);
        socket.emit("error", "Erro de transcrição");
      })
      .on("end", () => {
        console.log("Fluxo de reconhecimento finalizado");
      });
  });

  socket.on("binaryData", (data) => {
    if (recognizeStream) {
      recognizeStream.write(data);
    }
  });

  socket.on("stopGoogleCloudStream", () => {
    console.log("Parando o fluxo de reconhecimento");
    if (recognizeStream) {
      recognizeStream.end();
      recognizeStream = null;
    }
  });

  socket.on("disconnect", () => {
    console.log("Cliente desconectado");
    if (recognizeStream) {
      recognizeStream.end();
    }
  });
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor ouvindo na porta ${PORT}`);
});
