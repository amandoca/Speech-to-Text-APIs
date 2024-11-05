let socket;
let globalStream;
let audioContext;
let audioInput;
let processor;
let startButton = document.getElementById("startRecButton");
let pauseButton = document.getElementById("pauseRecButton");
let resumeButton = document.getElementById("resumeRecButton");
let stopButton = document.getElementById("stopRecButton");
let transcriptionArea = document.getElementById("transcript");
let statusElement = document.getElementById("status");
let finalTranscript = "";
let recordedChunks = [];

startButton.addEventListener("click", startRecording);
pauseButton.addEventListener("click", pauseRecording);
resumeButton.addEventListener("click", resumeRecording);
stopButton.addEventListener("click", stopRecording);

function initSocket() {
    socket = io.connect();

    socket.on("connect", function () {
        socket.emit("startAWSStream");
    });

    socket.on("speechData", function (data) {
        finalTranscript += ` ${data}`;
        transcriptionArea.value = finalTranscript.trim();
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

    globalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioInput = audioContext.createMediaStreamSource(globalStream);
    processor = audioContext.createScriptProcessor(2048, 1, 1);

    processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0);
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
            int16Data[i] = inputData[i] * 32767;
        }
        socket.emit("binaryData", int16Data.buffer);
    };

    audioInput.connect(processor);
    processor.connect(audioContext.destination);

    recordedChunks = [];
    const mediaRecorder = new MediaRecorder(globalStream);
    mediaRecorder.ondataavailable = (event) => recordedChunks.push(event.data);
    mediaRecorder.start();
    processor.mediaRecorder = mediaRecorder;  // Armazena o MediaRecorder para pausar/retomar
}

function pauseRecording() {
    pauseButton.disabled = true;
    resumeButton.disabled = false;
    statusElement.innerHTML = "Gravação pausada.";
    
    // Pausa o processador de áudio
    if (processor) {
        audioInput.disconnect(processor);
        processor.disconnect(audioContext.destination);
    }

    socket.emit("pause"); // Informa ao servidor para pausar
    processor.mediaRecorder.pause(); // Pausa a gravação do áudio
}

function resumeRecording() {
    pauseButton.disabled = false;
    resumeButton.disabled = true;
    statusElement.innerHTML = "Gravando...";

    // Retoma o processador de áudio
    audioInput.connect(processor);
    processor.connect(audioContext.destination);

    socket.emit("resume"); // Informa ao servidor para retomar
    processor.mediaRecorder.resume(); // Continua a gravação do áudio
}

function stopRecording() {
    startButton.disabled = false;
    pauseButton.disabled = true;
    resumeButton.disabled = true;
    stopButton.disabled = true;
    statusElement.innerHTML = "Parado.";

    socket.emit("stopAWSStream");
    socket.disconnect();

    // Parar gravação e exibir o áudio
    processor.mediaRecorder.stop();
    processor.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(recordedChunks, { type: "audio/wav" });
        const audioURL = URL.createObjectURL(audioBlob);
        const audioElement = document.createElement("audio");
        audioElement.controls = true;
        audioElement.src = audioURL;
        const audioPlayerContainer = document.getElementById("audioPlayerContainer");
        audioPlayerContainer.innerHTML = "";
        audioPlayerContainer.appendChild(audioElement);
        recordedChunks = [];
    };
}
