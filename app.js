// Global variable declarations
let audioContext;
const audioBuffers = {};
const sources = {};
const gainNodes = {};
const bpm = 140; // Beats per minute, change as necessary
const beatsPerBar = 4; // Common time
const secondsPerBeat = 60 / bpm;

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
        audioContext.resume().then(() => {
            updateBeatIndicator(); // Start the beat indicator when audio is resumed
        });
    }

    // Load files only if they have not been loaded yet
    if (Object.keys(audioBuffers).length === 0) {
        loadAudio('kick.wav', 'kick');
        loadAudio('bass.wav', 'bass');
        loadAudio('ukulele.wav', 'ukulele');
        loadAudio('synth.wav', 'synth');
    }
}

function toggleTrackPlayback(trackKey) {
    console.log(`Toggling playback for ${trackKey}: ${sources[trackKey] ? 'stopping' : 'starting'}`);
    if (sources[trackKey]) {
        scheduleTrackStop(trackKey);
    } else {
        scheduleTrackStart(trackKey);
    }
}
function scheduleTrackStart(trackKey) {
    let currentTime = audioContext.currentTime;
    let timeToNextBar = secondsPerBeat * beatsPerBar - (currentTime % (secondsPerBeat * beatsPerBar));
    let startTime = currentTime + timeToNextBar;
    console.log(`Scheduled start for ${trackKey} at ${startTime} (in ${timeToNextBar}s)`);
    playTrack(trackKey, startTime);
}

function playTrack(trackKey, startTime) {
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffers[trackKey];
    source.loop = true;

    // Check if the GainNode already exists, if not, create it
    if (!gainNodes[trackKey]) {
        gainNodes[trackKey] = audioContext.createGain(); // Create a new GainNode
        gainNodes[trackKey].connect(audioContext.destination);
    }

    // Get the current volume setting from the slider
    let volumeSlider = document.getElementById(trackKey + '-volume');
    gainNodes[trackKey].gain.value = volumeSlider.value;

    // Connect the source to the GainNode
    source.connect(gainNodes[trackKey]);

    // Start the source at the scheduled time
    source.start(startTime);
    sources[trackKey] = source;
}


function scheduleTrackStop(trackKey) {
    let currentTime = audioContext.currentTime;
    let timeToEndOfBar = secondsPerBeat * beatsPerBar - (currentTime % (secondsPerBeat * beatsPerBar));
    let stopTime = currentTime + timeToEndOfBar;
    console.log(`Scheduled stop for ${trackKey} at ${stopTime} (in ${timeToEndOfBar + (secondsPerBeat * beatsPerBar)}s)`);
    stopTrack(trackKey, stopTime);
}


function stopTrack(trackKey, stopTime) {
    if (sources[trackKey]) {
        // Calculate the delay needed before disconnecting, based on stopTime
        let disconnectDelay = (stopTime - audioContext.currentTime) * 1000; // Convert to milliseconds
        sources[trackKey].stop(stopTime);
        
        // Set a timeout to disconnect the node after audio has stopped
        setTimeout(() => {
            sources[trackKey].disconnect(); // Disconnect after playback has stopped
            sources[trackKey] = null; // Optionally clear the source
        }, disconnectDelay);
    }
}


function setVolume(track, volume) {
    if (gainNodes[track]) {
        gainNodes[track].gain.value = volume;
    }
}


function updateBeatIndicator() {
    let currentTime = audioContext.currentTime;
    let currentBeat = Math.floor(currentTime / secondsPerBeat) % beatsPerBar + 1;
    document.getElementById('beatIndicator').innerText = `Beat: ${currentBeat}`;

    // Correct calculation for the next update to precisely align with the next beat
    let nextUpdateDelay = secondsPerBeat - (currentTime % secondsPerBeat);
    setTimeout(updateBeatIndicator, nextUpdateDelay * 1000);
}


// Initialize the beat indicator after user interaction
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    startBtn.addEventListener('click', () => {
        initAudio();
    });
});
