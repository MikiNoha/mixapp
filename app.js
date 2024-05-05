let audioContext;
let analyser 
const audioBuffers = {};
const sources = {};
const gainNodes = {};
const panNodes = {};
const bpm = 140;  // Beats per minute, change as necessary
const beatsPerBar = 4;  // Common time
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
        // Create the AudioContext now
        audioContext = new AudioContext();
    }
    if (!window.analyser) {
        window.analyser = audioContext.createAnalyser();
        window.analyser.fftSize = 2048;  // Set the FFT size
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

    if (!gainNodes[trackKey]) {
        gainNodes[trackKey] = audioContext.createGain();
        // The panner should be connected before the gain node to the destination
        if (!panNodes[trackKey]) {
            panNodes[trackKey] = new StereoPannerNode(audioContext);
            gainNodes[trackKey].connect(panNodes[trackKey]);
            panNodes[trackKey].connect(window.analyser);
            window.analyser.connect(audioContext.destination);
        }
    }

    // Connect the source to the GainNode, not directly to the PanNode
    source.connect(gainNodes[trackKey]);

    // Set initial volume and panning from sliders
    let volumeSlider = document.getElementById(trackKey + '-volume');
    gainNodes[trackKey].gain.value = volumeSlider.value;

    let panSlider = document.getElementById(trackKey + '-pan');
    panNodes[trackKey].pan.value = parseFloat(panSlider.value);

    source.start(startTime);
    sources[trackKey] = source;
}

function setPan(track, panValue) {
    if (panNodes[track]) {
        panNodes[track].pan.value = panValue;
    }
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

function setupVisualizer() {
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    const bufferLength = window.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        requestAnimationFrame(draw);
        window.analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let barWidth = (canvas.width / bufferLength) * 2.5;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i]*2;
            ctx.fillStyle = 'rgb(' + (barHeight + 100) + ', 50, 50)';
            ctx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);

            x += barWidth + 1;
        }
    }

    draw();
}


// Initialize the beat indicator after user interaction
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    startBtn.addEventListener('click', () => {
        initAudio();
        setupVisualizer();
    });
});
