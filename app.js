// Global variable declarations
let audioContext;
const audioBuffers = {};
const sources = {};

// Function to load an audio file and store it in audioBuffers
function loadAudio(filename, key) {
    fetch(`audio/${filename}`)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
            if (!audioContext) {
                audioContext = new AudioContext();
            }
            return audioContext.decodeAudioData(arrayBuffer);
        })
        .then(audioBuffer => {
            audioBuffers[key] = audioBuffer;
        })
        .catch(e => console.error(e));
}

// Initialize audio files and context on user interaction
function initAudio() {
    if (!audioContext) {
        audioContext = new AudioContext();
    }

    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    // Load files only if they have not been loaded yet
    if (Object.keys(audioBuffers).length === 0) {
        loadAudio('kick.wav', 'kick');
        loadAudio('bass.wav', 'bass');
        loadAudio('ukulele.wav', 'ukulele');
        loadAudio('synth.wav', 'synth');
    }
}

// Play all loaded audio tracks
function playAudio() {
    if (!audioContext) return; // Ensure audioContext exists

    Object.keys(audioBuffers).forEach(key => {
        if (!sources[key]) {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffers[key];
            source.loop = true;
            source.connect(audioContext.destination);
            source.start();
            sources[key] = source;
        }
    });
}

// Stop all playing audio tracks
function stopAudio() {
    Object.keys(sources).forEach(key => {
        if (sources[key]) {
            sources[key].stop();
            sources[key] = null; // Clear the source after stopping
        }
    });
}


// Assuming your existing code is in place, we add the following:

const gainNodes = {};

function playAudio() {
    Object.keys(audioBuffers).forEach(key => {
        if (!sources[key]) {
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffers[key];
            source.loop = true;

            // Create a GainNode for each source
            gainNodes[key] = audioContext.createGain();
            source.connect(gainNodes[key]);
            gainNodes[key].connect(audioContext.destination);

            source.start();
            sources[key] = source;
        }
    });
}

function setVolume(track, volume) {
    if (gainNodes[track]) {
        gainNodes[track].gain.value = volume;
    }
}

// Make sure to stop sources properly and clear GainNodes
function stopAudio() {
    Object.keys(sources).forEach(key => {
        if (sources[key]) {
            sources[key].stop();
            sources[key] = null;
            // Optionally disconnect gainNodes if you plan to recreate them
            gainNodes[key].disconnect();
            gainNodes[key] = null;
        }
    });
}
