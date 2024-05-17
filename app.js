let audioContext;
let analyser;

let masterGainNode;
let masterLowPass;
let masterHighPass;

const audioBuffers = {};
const sources = {};
const gainNodes = {};
const panNodes = {};

const bpm = 140;
const beatsPerBar = 4; 
const secondsPerBeat = 60 / bpm;


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


function initAudio() {
    if (!audioContext) {

        audioContext = new AudioContext();
    }
    if (!window.analysers) {
        window.analysers = {}; 
    }

    if (audioContext.state === "suspended") {
        audioContext.resume().then(() => {
            updateBeatIndicator(); 
        });
    }


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
    lowPass.frequency.setValueAtTime(22050, audioContext.currentTime);
    lowPass.Q.setValueAtTime(1, audioContext.currentTime);

    const highPass = audioContext.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.setValueAtTime(0, audioContext.currentTime);
    highPass.Q.setValueAtTime(1, audioContext.currentTime);

    lowPassNodes[trackKey] = lowPass;
    highPassNodes[trackKey] = highPass;

    return { lowPass, highPass };
}


function playTrack(trackKey, startTime) {
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffers[trackKey];
    source.loop = true;


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

    source.connect(lowPass);
    lowPass.connect(highPass);
    highPass.connect(gainNodes[trackKey]);
    gainNodes[trackKey].connect(panNodes[trackKey]);

 
    panNodes[trackKey].connect(window.analysers[trackKey]);
    window.analysers[trackKey].connect(masterHighPass); 


    masterHighPass.connect(masterLowPass);
    masterLowPass.connect(masterGainNode);
    masterGainNode.connect(audioContext.destination);


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
        
        let disconnectDelay = (stopTime - audioContext.currentTime) * 1000; 
        sources[trackKey].stop(stopTime);
        

        setTimeout(() => {
            sources[trackKey].disconnect(); 
            sources[trackKey] = null; 
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

    
    let nextUpdateDelay = secondsPerBeat - (currentTime % secondsPerBeat);
    setTimeout(updateBeatIndicator, nextUpdateDelay * 1000);
}

function setupVisualizer() {
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');
    const trackKeys = Object.keys(audioBuffers); 
    const colors = ['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(0, 0, 255)', 'rgb(255, 255, 0)']; 

    trackKeys.forEach(key => {
        if (!window.analysers[key]) {
            window.analysers[key] = audioContext.createAnalyser();
            window.analysers[key].fftSize = 2048;
          
            if (panNodes[key]) {
                panNodes[key].connect(window.analysers[key]);
            }
            
        }
    });

    function draw() {
        requestAnimationFrame(draw);
        ctx.clearRect(0, 0, canvas.width, canvas.height);  
    
        trackKeys.forEach((key, index) => {
            if (!window.analysers[key]) {
                console.error(`Analyser for track ${key} is not defined.`);
                return; 
            }
            
            const analyser = window.analysers[key];
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            analyser.getByteFrequencyData(dataArray);  
            

            let barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0; 
    
            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i]) / 1,5   ;  
                ctx.fillStyle = colors[index % colors.length]; 
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);  
    
                x += barWidth + 1; 
            }
        });
    }
    

    draw();
}

function setupMasterVisualizer() {
    const canvas = document.getElementById('master-visualizer');
    const ctx = canvas.getContext('2d');
    const mAnalyser = window.masterAnalyser;
    const mBufferLength = mAnalyser.frequencyBinCount;
    const mDataArray = new Uint8Array(mBufferLength);

    function draw() {
        requestAnimationFrame(draw);
        ctx.clearRect(0, 0, canvas.width, canvas.height); 

        mAnalyser.getByteFrequencyData(mDataArray);


        ctx.save();
        ctx.scale(1, -1); 
        ctx.translate(0, -canvas.height);  
        let barWidth = (canvas.width / mBufferLength) * 2.5;
        let barHeight;
        let x = 0; 

        for (let i = 0; i < mBufferLength; i++) {
            barHeight = mDataArray[i];  
            ctx.fillStyle = 'rgb(100, 100, 100)';  
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);  
            x += barWidth + 1;
        }

        ctx.restore();
    }

    draw(); 
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

        masterAnalyser = audioContext.createAnalyser();  
        masterGainNode.connect(masterAnalyser);
        masterAnalyser.connect(audioContext.destination);


       
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
    

    const currentFreq = filterNode.frequency.value;


    let newFreq;
    if (type === 'lowpass') {
        newFreq = currentFreq === 22050 ? 500 : 22050; 
    } else {
        newFreq = currentFreq === 0 ? 1000 : 0; 
    }

    console.log("AudioContext State:", audioContext.state);
    console.log(`Master ${type} Filter Frequency before: ${currentFreq}`);


    filterNode.frequency.linearRampToValueAtTime(newFreq, audioContext.currentTime + 1);


    console.log(`Toggled master ${type} filter to frequency: ${newFreq}`);
    console.log(`Master ${type} Filter Frequency after setting command: ${filterNode.frequency.value}`);
}







document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    startBtn.addEventListener('click', () => {
        document.getElementById('intro-modal').style.display = 'none';
        initAudio();
        setupMasterControls();
        setupVisualizer();
        setupMasterVisualizer();
        
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const filterButtons = document.querySelectorAll('button.filter-button');
    const toggleTrackButtons = document.querySelectorAll('button.toggle-track');
    const sliders = document.querySelectorAll('input[type="range"]');

    filterButtons.forEach(button => {
        button.addEventListener('click', function () {
            this.classList.toggle('active');
        });
    });

    toggleTrackButtons.forEach(button => {
        button.addEventListener('click', function () {
            this.classList.toggle('active');
        });
    });

    document.getElementById('reset-btn').addEventListener('click', function () {

        sliders.forEach(slider => {
            if (slider.classList.contains('vertical')) {
                slider.value = 1; 
            } else if (slider.classList.contains('horizontal')) {
                slider.value = 0; 
            }
          
            slider.dispatchEvent(new Event('input'));
        });

 
        filterButtons.forEach(button => {
            if (button.classList.contains('active')) {
                button.classList.remove('active');
               
                const filterInfo = button.getAttribute('onclick').match(/toggleFilter\('(\w+)', '(\w+)'\)/);
                if (filterInfo) {
                    const filterType = filterInfo[1];
                    const trackId = filterInfo[2];
                    toggleFilter(filterType, trackId);
                } else {
                  
                    const masterFilterInfo = button.getAttribute('onclick').match(/toggleMasterFilter\('(\w+)'\)/);
                    if (masterFilterInfo) {
                        const masterFilterType = masterFilterInfo[1];
                        toggleMasterFilter(masterFilterType);
                    }
                }
            }
        });
    });

    document.getElementById('turn-off-tracks-btn').addEventListener('click', function () {
       
        toggleTrackButtons.forEach(button => {
            if (button.classList.contains('active')) {
                button.classList.remove('active');
                const trackId = button.getAttribute('onclick').match(/toggleTrackPlayback\('(\w+)'\)/)[1];
                toggleTrackPlayback(trackId);
            }
        });
    });
});





