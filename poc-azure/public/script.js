let socket;
let audioContext;
let globalStream;
let mediaRecorder;
let recordedChunks = [];
let startButton = document.getElementById('startRecButton');
let pauseButton = document.getElementById('pauseRecButton');
let resumeButton = document.getElementById('resumeRecButton');
let stopButton = document.getElementById('stopRecButton');
let transcriptArea = document.getElementById('transcript');
let statusElement = document.getElementById('status');
let finalTranscript = ""; // Armazena a transcrição acumulada

startButton.addEventListener('click', startRecording);
pauseButton.addEventListener('click', pauseRecording);
resumeButton.addEventListener('click', resumeRecording);
stopButton.addEventListener('click', stopRecording);

function initSocket() {
    socket = io.connect();

    socket.on('connect', function() {
        socket.emit('startAzureStream');
    });

    // Renderizar apenas transcrições finais únicas
    socket.on('speechData', function(data) {
        finalTranscript += ` ${data}`; // Acumula apenas novos trechos finais
        transcriptArea.value = finalTranscript.trim(); // Exibe o texto completo atualizado
        statusElement.innerHTML = 'Transcrição em andamento...';
    });

    socket.on('error', function(err) {
        console.error('Erro:', err);
        statusElement.innerHTML = 'Erro: ' + err;
    });
}

async function startRecording() {
    startButton.disabled = true;
    pauseButton.disabled = false;
    stopButton.disabled = false;
    statusElement.innerHTML = 'Gravando...';

    initSocket();

    try {
        globalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });

        mediaRecorder = new MediaRecorder(globalStream);
        mediaRecorder.ondataavailable = event => recordedChunks.push(event.data);

        mediaRecorder.start();

        await audioContext.audioWorklet.addModule('processor.js');

        const input = audioContext.createMediaStreamSource(globalStream);
        const audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor');

        audioWorkletNode.port.onmessage = (event) => {
            const int16Array = new Int16Array(event.data);
            socket.emit('binaryData', int16Array);
        };

        input.connect(audioWorkletNode);
        audioWorkletNode.connect(audioContext.destination);

        window.audioWorkletNode = audioWorkletNode;
    } catch (err) {
        console.error('Erro ao acessar o microfone:', err);
        statusElement.innerHTML = 'Erro ao acessar o microfone.';
        startButton.disabled = false;
        pauseButton.disabled = true;
        stopButton.disabled = true;
    }
}

function pauseRecording() {
    pauseButton.disabled = true;
    resumeButton.disabled = false;
    statusElement.innerHTML = 'Gravação pausada.';

    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.pause();
    }

    if (window.audioWorkletNode) {
        window.audioWorkletNode.port.postMessage('pause');
    }
}

function resumeRecording() {
    pauseButton.disabled = false;
    resumeButton.disabled = true;
    statusElement.innerHTML = 'Gravando...';

    if (mediaRecorder && mediaRecorder.state === "paused") {
        mediaRecorder.resume();
    }

    if (window.audioWorkletNode) {
        window.audioWorkletNode.port.postMessage('resume');
    }
}

function stopRecording() {
    startButton.disabled = false;
    pauseButton.disabled = true;
    resumeButton.disabled = true;
    stopButton.disabled = true;
    statusElement.innerHTML = 'Parado.';

    socket.emit('stopAzureStream');
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
        globalStream.getTracks().forEach(track => track.stop());
        globalStream = null;
    }

    // Parar e processar o áudio gravado para reproduzir
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(recordedChunks, { type: 'audio/wav' });
            const audioURL = URL.createObjectURL(audioBlob);
            const audioElement = document.createElement('audio');
            audioElement.controls = true;
            audioElement.src = audioURL;
            const audioPlayerContainer = document.getElementById('audioPlayerContainer');
            audioPlayerContainer.innerHTML = ''; // Limpa qualquer áudio anterior
            audioPlayerContainer.appendChild(audioElement);
            recordedChunks = []; // Limpar os chunks gravados para a próxima gravação
        };
    }

    finalTranscript = ""; // Limpar a transcrição para a próxima gravação
}
