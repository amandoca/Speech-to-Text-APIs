// processor.js

class RecorderProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this._isPaused = false;

        this.port.onmessage = (event) => {
            if (event.data === 'pause') {
                this._isPaused = true;
            } else if (event.data === 'resume') {
                this._isPaused = false;
            }
        };
    }

    process(inputs) {
        if (!this._isPaused) {
            const input = inputs[0];
            if (input && input[0].length > 0) {
                const channelData = input[0]; // Coletar dados do canal de áudio
                this.port.postMessage(channelData); // Enviar dados ao `AudioWorkletNode`
            }
        }
        return true;
    }
}

registerProcessor('recorder-processor', RecorderProcessor);
