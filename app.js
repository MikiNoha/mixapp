let audioContext;
let analyser;

let masterGainNode;
let masterLowPass;
let masterHighPass;

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
    if (!window.analysers) {
        window.analysers = {}; // Create an empty object to store analysers for each track
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
    setupVisualizer();

}
function scheduleTrackStart(trackKey) {
    let currentTime = audioContext.currentTime;
    let timeToNextBar = secondsPerBeat * beatsPerBar - (currentTime % (secondsPerBeat * beatsPerBar));
    let startTime = currentTime + timeToNextBar;
    console.log(`Scheduled start for ${trackKey} at ${startTime} (in ${timeToNextBar}s)`);
    playTrack(trackKey, startTime);
}

const lowPassNodes = {};
const highPassNodes = {};

function setupFilters(trackKey) {
    const lowPass = audioContext.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.setValueAtTime(22050, audioContext.currentTime); // Start fully open
    lowPass.Q.setValueAtTime(1, audioContext.currentTime);

    const highPass = audioContext.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.setValueAtTime(0, audioContext.currentTime); // Start fully open
    highPass.Q.setValueAtTime(1, audioContext.currentTime);

    lowPassNodes[trackKey] = lowPass;
    highPassNodes[trackKey] = highPass;

    return { lowPass, highPass };
}


function playTrack(trackKey, startTime) {
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffers[trackKey];
    source.loop = true;

    // Set up filters and nodes for each track
    const { lowPass, highPass } = setupFilters(trackKey);

    if (!gainNodes[trackKey]) {
        gainNodes[trackKey] = audioContext.createGain();
    }
    if (!panNodes[trackKey]) {
        panNodes[trackKey] = new StereoPannerNode(audioContext);
    }
    if (!window.analysers[trackKey]) {
        window.analysers[trackKey] = audioContext.createAnalyser();
    }

    // Connect source through track-specific processing
    source.connect(lowPass);
    lowPass.connect(highPass);
    highPass.connect(gainNodes[trackKey]);
    gainNodes[trackKey].connect(panNodes[trackKey]);

    // Connect each track's pan node to its analyser BEFORE master processing
    panNodes[trackKey].connect(window.analysers[trackKey]);
    window.analysers[trackKey].connect(masterHighPass); // Now the analyser will capture individual track data

    // Continue with master processing
    masterHighPass.connect(masterLowPass);
    masterLowPass.connect(masterGainNode);
    masterGainNode.connect(audioContext.destination);

    // Start the source
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
    const trackKeys = Object.keys(audioBuffers); // Assuming you have an equivalent list of track keys
    const colors = ['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(0, 0, 255)', 'rgb(255, 255, 0)']; // Colors for each track

    trackKeys.forEach(key => {
        if (!window.analysers[key]) {
            window.analysers[key] = audioContext.createAnalyser();
            window.analysers[key].fftSize = 2048;
            // Assuming that panNodes[key] properly exists and connects here
            if (panNodes[key]) {
                panNodes[key].connect(window.analysers[key]);
            }
            // window.analysers[key].connect(audioContext.destination);  // This should only be for visualizing, not audio output
        }
    });

    function draw() {
        requestAnimationFrame(draw);
        ctx.clearRect(0, 0, canvas.width, canvas.height);  // Clear the canvas before drawing new frame
    
        trackKeys.forEach((key, index) => {
            if (!window.analysers[key]) {
                console.error(`Analyser for track ${key} is not defined.`);
                return;  // Skip this iteration if the analyser is not defined
            }
            
            const analyser = window.analysers[key];
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);  // Get frequency data
            

            let barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;  // Initial x position for bars
    
            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i]) / 1,5   ;  // Scale the bar height * masterGainNode.gain.value
                ctx.fillStyle = colors[index % colors.length];  // Choose color based on track
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);  // Draw the bar
    
                x += barWidth + 1;  // Move to the next bar position
            }
        });
    }
    

    draw(); // Start the visualization loop
}

function setupMasterVisualizer() {
    const canvas = document.getElementById('master-visualizer');
    const ctx = canvas.getContext('2d');
    const mAnalyser = window.masterAnalyser;
    const mBufferLength = mAnalyser.frequencyBinCount;
    const mDataArray = new Uint8Array(mBufferLength);

    function draw() {
        requestAnimationFrame(draw);
        ctx.clearRect(0, 0, canvas.width, canvas.height);  // Clear the entire canvas before drawing new frame

        // Fetch the frequency data
        mAnalyser.getByteFrequencyData(mDataArray);

        // Save the current context state and apply transformations
        ctx.save();
        ctx.scale(1, -1);  // Flip the y-axis
        ctx.translate(0, -canvas.height);  // Translate to mirror the drawing

        let barWidth = (canvas.width / mBufferLength) * 2.5;
        let barHeight;
        let x = 0;  // Initial x position for bars

        for (let i = 0; i < mBufferLength; i++) {
            barHeight = mDataArray[i];  // Get bar height from frequency data
            ctx.fillStyle = 'rgb(100, 100, 100)';  // Red color for visualization
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);  // Draw each bar
            x += barWidth + 1;
        }

        // Restore the context to its original state after drawing
        ctx.restore();
    }

    draw(); // Start the visualization loop
}





function toggleFilter(type, trackKey) {
    const filterNode = (type === 'lowpass') ? lowPassNodes[trackKey] : highPassNodes[trackKey];

    if (type === 'lowpass') {
        const currentFreq = filterNode.frequency.value;
        filterNode.frequency.setValueAtTime(currentFreq === 22050 ? 500 : 22050, audioContext.currentTime);
    } else {
        const currentFreq = filterNode.frequency.value;
        filterNode.frequency.setValueAtTime(currentFreq === 0 ? 1000 : 0, audioContext.currentTime);
    }
}



function setupMasterControls() {
    if (!masterGainNode) {
        masterGainNode = audioContext.createGain();
        

        masterLowPass = audioContext.createBiquadFilter();
        masterLowPass.type = 'lowpass';
        masterLowPass.frequency.setValueAtTime(22050, audioContext.currentTime);
        masterLowPass.Q.setValueAtTime(1, audioContext.currentTime);

        masterHighPass = audioContext.createBiquadFilter();
        masterHighPass.type = 'highpass';
        masterHighPass.frequency.setValueAtTime(0, audioContext.currentTime);
        masterHighPass.Q.setValueAtTime(1, audioContext.currentTime);

        masterAnalyser = audioContext.createAnalyser();  // Create a global analyser
        masterGainNode.connect(masterAnalyser);
        masterAnalyser.connect(audioContext.destination);


        // Connect filters in this order: high pass -> low pass -> gain -> destination
        // masterHighPass.connect(masterLowPass);
        // masterLowPass.connect(masterGainNode);
        // // masterHighPass.connect(masterGainNode);
        // masterGainNode.connect(audioContext.destination);
    }
 
}



function setMasterVolume(volume) {
    console.log("Attempting to set master volume to:", volume);
    masterGainNode.gain.value = parseFloat(volume);
    console.log("Master volume now set to:", masterGainNode.gain.value);
}

function toggleMasterFilter(type) {
    const filterNode = (type === 'lowpass') ? masterLowPass : masterHighPass;
    
    // Directly retrieve the current frequency value from the filterNode.
    const currentFreq = filterNode.frequency.value;

    // Determine the new frequency based on the current frequency.
    let newFreq;
    if (type === 'lowpass') {
        newFreq = currentFreq === 22050 ? 500 : 22050; // Toggle between 22050 and 500
    } else {
        newFreq = currentFreq === 0 ? 1000 : 0; // Toggle between 0 and 1000 for high pass
    }

    // Log the current state before changing
    console.log("AudioContext State:", audioContext.state);
    console.log(`Master ${type} Filter Frequency before: ${currentFreq}`);

    // Set the new frequency at the current time.
    filterNode.frequency.linearRampToValueAtTime(newFreq, audioContext.currentTime + 1);


    // Log the new settings.
    console.log(`Toggled master ${type} filter to frequency: ${newFreq}`);
    console.log(`Master ${type} Filter Frequency after setting command: ${filterNode.frequency.value}`);
}







// Initialize the beat indicator after user interaction
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    startBtn.addEventListener('click', () => {
        initAudio();
        setupMasterControls();
        setupVisualizer();
        setupMasterVisualizer();
        
    });
});
