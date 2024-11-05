require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sdk = require('microsoft-cognitiveservices-speech-sdk');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuração da API Azure Speech
const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY,
    process.env.AZURE_REGION
);
speechConfig.speechRecognitionLanguage = 'pt-BR';

// Servir arquivos estáticos da pasta 'public'
app.use(express.static('public'));

// Configurar o Socket.IO
io.on('connection', (socket) => {
    console.log('Cliente conectado');

    let audioStream;
    let pushStream;
    let recognizer;
    let lastFinalTranscript = ""; // Armazena o último trecho final reconhecido para evitar duplicação

    socket.on('startAzureStream', () => {
        console.log('Iniciando o fluxo de reconhecimento com Azure');
        pushStream = sdk.AudioInputStream.createPushStream();
        audioStream = sdk.AudioConfig.fromStreamInput(pushStream);
        recognizer = new sdk.SpeechRecognizer(speechConfig, audioStream);

        // Ignorar resultados parciais e enviar apenas os finais não duplicados
        recognizer.recognizing = () => {
            // Esta função está aqui propositalmente vazia para ignorar transcrições parciais
        };

        recognizer.recognized = (s, e) => {
            if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
                const finalTranscript = e.result.text.trim();

                // Enviar apenas transcrições finais não duplicadas
                if (finalTranscript && finalTranscript !== lastFinalTranscript) {
                    console.log('Transcrição em andamento...:', finalTranscript);
                    socket.emit('speechData', finalTranscript);
                    lastFinalTranscript = finalTranscript;
                }
            }
        };

        recognizer.canceled = (s, e) => {
            console.error('Reconhecimento cancelado:', e);
            socket.emit('error', 'Reconhecimento cancelado.');
            recognizer.stopContinuousRecognitionAsync();
        };

        recognizer.sessionStopped = (s, e) => {
            console.log('Sessão de reconhecimento encerrada.');
            recognizer.stopContinuousRecognitionAsync();
        };

        recognizer.startContinuousRecognitionAsync();
    });

    socket.on('binaryData', (data) => {
        if (pushStream) {
            pushStream.write(data);
        }
    });

    socket.on('stopAzureStream', () => {
        if (recognizer) {
            recognizer.stopContinuousRecognitionAsync();
            recognizer = null;
        }
        if (pushStream) {
            pushStream.close();
            pushStream = null;
        }
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
        if (recognizer) {
            recognizer.stopContinuousRecognitionAsync();
        }
    });
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor ouvindo na porta ${PORT}`);
});
