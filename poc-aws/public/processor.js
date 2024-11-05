class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input && input[0]) {
            const channelData = input[0];
            const int16Data = new Int16Array(channelData.length);
            for (let i = 0; i < channelData.length; i++) {
                int16Data[i] = channelData[i] * 32767;
            }
            this.port.postMessage(int16Data.buffer, [int16Data.buffer]);
        }
        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
