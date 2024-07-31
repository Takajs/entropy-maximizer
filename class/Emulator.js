//libraries
const { spawn, spawnSync } = require('child_process');
const robot = require("robotjs");
const fs = require('fs');
const path = require('path');

robot.setMouseDelay(1);
robot.setKeyboardDelay(1);

//Config files
const REFERENCE_EMULATOR_PATH = path.join(__dirname, '..', 'emulator', 'emulator.exe');
const REFERENCE_GBA_ROM_PATH = path.join(__dirname, '..', 'emulator', 'roms', 'rom.gba');
const REFERENCE_INITIAL_SGM_PATH = path.join(__dirname, '..', 'emulator', 'roms', 'initial.sgm');
const REFERENCE_VBA_INI_PATH = path.join(__dirname, '..', 'emulator', 'vba.ini');

/*
function getEntropyOfFile(filePath) {
    if (!fs.existsSync(filePath)) return 0;
    let data = fs.readFileSync(filePath);
    let entropy = 0;
    let totalBytes = data.length;
    let byteCounts = Array.from({ length: 256 }, () => 0);
    for (let i = 0; i < totalBytes; i++) {
        byteCounts[data[i]]++;
    }
    byteCounts.forEach(count => {
        if (count === 0) return;
        let p = count / totalBytes;
        entropy -= p * Math.log2(p);
    });
    return entropy;
}
    */

function getEntropyOfFile(filePath) {
    const start = Date.now();

    function hyperEntropyOfData(data) {
        function simpleEntropyByChunkSize(data, chunkSizeInBits) {
            //Start time
            //This function should split the data into chunks of chunkSizeInBits
            //Then, for each chunk, calculate the probability of being observed in the whole data
            //Then, calculate the entropy of the data
            const dataInChunks = [];
            let chunk = '';
            for (let i = 0; i < data.length; i++) {
                chunk += data[i];
                if (chunk.length === chunkSizeInBits) {
                    dataInChunks.push(chunk);
                    chunk = '';
                }

            }
            let entropy = 0;

            //For each chunk, calculate the probability of being observed in dataInChunks
            const chunkCounts = {};
            dataInChunks.forEach(chunk => {
                if (!chunkCounts[chunk]) {
                    chunkCounts[chunk] = 1;
                } else {
                    chunkCounts[chunk]++;
                }
            });
            const totalChunks = dataInChunks.length;
            Object.keys(chunkCounts).forEach(chunk => {
                const count = chunkCounts[chunk];
                //console.log(`Chunk ${chunk} has ${chunkCounts[chunk]} occurrences`);

                const p = count / totalChunks;
                //console.log(`Probability of chunk ${chunk} is ${p}`);
                entropy -= p * Math.log2(p);
                //console.log(`Entropy of chunk ${chunk} ${entropy}`);
            });
            return entropy;

        }
        let hyperEntropy = 0;

        for (let i = 0; i < data.length; i++) {
            hyperEntropy += simpleEntropyByChunkSize(data, i);
        }
        const result = hyperEntropy / data.length;

        return result;
    }

    if (!fs.existsSync(filePath)) return 0;
    let data = fs.readFileSync(filePath);

    const hyperEntropy = hyperEntropyOfData(data);
    const end = Date.now();
    console.log(`Time to calculate entropy: ${end - start} ms`);
    return hyperEntropy;


}


function getuuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0,
            v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
function addToClipboard(data) {
    const command = `echo ${data} | clip`;
    //console.log(`📋 Adding to clipboard: ${data}, command to do so: ${command}`);
    var proc = spawnSync('cmd', ['/c', command]);
}

function getClipboard() {
    const command = `Get-Clipboard | Out-String`;
    const output = spawnSync('powershell', ['-command', command]);

    return output.stdout.toString().trim();
}

const DISTANCES_TO_X_FROM_ORIGIN = [210, 10];
const DISTANCES_TO_CENTER_FROM_ORIGIN = [53, 53]; //DO NOT DELETE; will be used
const toDisable = ['Joy0_L', 'Joy0_R', 'Joy0_Start', 'Joy0_Select', 'Joy0_GS'];

class Emulator {

    constructor(windowX, windowY, A_KEY, B_KEY, UP_KEY, DOWN_KEY, LEFT_KEY, RIGHT_KEY, name, baseNumberOfActionsToTakeEachGeneration, incrementIfStuck, actionsGenerationMode) {
        const AVAILABLE_ACTIONS_GENERATION_MODES = ['ALL_RANDOM', 'STILL'];
        if (!actionsGenerationMode || !AVAILABLE_ACTIONS_GENERATION_MODES.includes(actionsGenerationMode)) {
            throw new Error('Actions generation mode not recognized');
        }
        this.isActing = false;
        this.actionsGenerationMode = actionsGenerationMode;
        this.baseNumberOfActionsToTakeEachGeneration = baseNumberOfActionsToTakeEachGeneration;
        this.incrementIfStuck = incrementIfStuck;
        this.numberOfActionsForThisGeneration = baseNumberOfActionsToTakeEachGeneration;
        this.actionsForThisGeneration = [];
        this.generations = 0;
        this.isAlreadyConfigured = false;
        this.isOpenned = false;
        this.id = getuuidv4();
        this.name = name;
        this.windowX = windowX;
        this.windowY = windowY;
        this.A_KEY = A_KEY;
        this.B_KEY = B_KEY;
        this.UP_KEY = UP_KEY;
        this.DOWN_KEY = DOWN_KEY;
        this.LEFT_KEY = LEFT_KEY;
        this.RIGHT_KEY = RIGHT_KEY;
        this.keys = [A_KEY, B_KEY, UP_KEY, DOWN_KEY, LEFT_KEY, RIGHT_KEY];
        //console.log("This is the keys: ", this.keys);


        //Each emulator must create a folder for its own files (sgm, exe, ...)
        this.folderPath = path.join(__dirname, '..', 'emulator', 'agents', `${this.name}`);
        if (!fs.existsSync(this.folderPath)) fs.mkdirSync(this.folderPath);

        //Now, we must copy the REFERENCE_EMULATOR_PATH to the folderPath

        fs.copyFileSync(REFERENCE_EMULATOR_PATH, path.join(this.folderPath, 'emulator.exe'));
        this.emulatorPath = path.join(this.folderPath, 'emulator.exe');
        this.iniPath = path.join(this.folderPath, 'vba.ini');
        //Now, we must copy the REFERENCE_VBA_INI_PATH to the folderPath
        fs.copyFileSync(REFERENCE_VBA_INI_PATH, this.iniPath);

        //Now, we must copy the REFERENCE_GBA_ROM_PATH to the folderPath
        fs.copyFileSync(REFERENCE_GBA_ROM_PATH, path.join(this.folderPath, 'rom.gba'));
        this.romPath = path.join(this.folderPath, 'rom.gba');


        //Now, we must copy the REFERENCE_INITIAL_SGM_PATH to the folderPath
        fs.copyFileSync(REFERENCE_INITIAL_SGM_PATH, path.join(this.folderPath, 'initial.sgm'));
        this.initialSgmPath = path.join(this.folderPath, 'initial.sgm');
        this.entropyOfSGM = 0;
        this.previousEntropyOfSGM = this.entropyOfSGM;
        this.entropyDelta = 0;

        this.currentSgmPath = path.join(this.folderPath, 'current.sgm');

        this.configureEmulator();
    }


    async spawnVBA() {

        const VBA = spawn(this.emulatorPath, [], { detached: true, stdio: 'ignore' });
        VBA.unref();

        this.isOpenned = true;

    }
    stopVBA() {
        if (!this.isOpenned) {
            return;
        }
        if (!this.isAlreadyConfigured) {
            robot.moveMouse(0 + DISTANCES_TO_X_FROM_ORIGIN[0], 0 + DISTANCES_TO_X_FROM_ORIGIN[1]);
            setTimeout(() => {

                robot.mouseClick();
                this.isOpenned = false;

            }, 250);
        } else {
            robot.moveMouse(this.windowX + DISTANCES_TO_X_FROM_ORIGIN[0], this.windowY + DISTANCES_TO_X_FROM_ORIGIN[1]);
            setTimeout(() => {
                robot.mouseClick();
                this.isOpenned = false;

            }, 250);

        }


    }
    configureEmulator() {
        //Now we must configure the keys by editing the ini file
        if (this.isOpenned) {
            setTimeout(() => {
                this.configureEmulator();
            }, 2000);
        }
        try {

            const iniContent = fs.readFileSync(this.iniPath, 'utf8');
            const iniLines = iniContent.split('\n');
            const newIniLines = [];
            const startOfInLines = iniLines.map(line => line.split('=')[0]);

            for (let line of startOfInLines) {
                switch (line) {
                    case 'Joy0_A':
                        newIniLines.push(`Joy0_A=${this.A_KEY.value}`);
                        break;
                    case 'Joy0_B':
                        newIniLines.push(`Joy0_B=${this.B_KEY.value}`);
                        break;
                    case 'Joy0_Up':
                        newIniLines.push(`Joy0_Up=${this.UP_KEY.value}`);
                        break;
                    case 'Joy0_Down':
                        newIniLines.push(`Joy0_Down=${this.DOWN_KEY.value}`);
                        break;
                    case 'Joy0_Left':
                        newIniLines.push(`Joy0_Left=${this.LEFT_KEY.value}`);
                        break;
                    case 'Joy0_Right':
                        newIniLines.push(`Joy0_Right=${this.RIGHT_KEY.value}`);
                        break;
                    case 'windowX':
                        newIniLines.push(`windowX=${this.windowX}`);
                        break;
                    case 'windowY':
                        newIniLines.push(`windowY=${this.windowY}`);
                        break;
                    case 'soundOff':
                        newIniLines.push(`soundOff=1`);
                        break;
                    default:
                        newIniLines.push(iniLines[startOfInLines.indexOf(line)]);
                        break;
                }
            }
            //IF by any chance the file still does not have windowX and windowY, add them


            if (!startOfInLines.includes('windowX')) {
                console.log('Adding windowX : ', this.windowX);
                newIniLines.push(`windowX=${this.windowX}`);
            }
            if (!startOfInLines.includes('windowY')) {
                console.log('Adding windowY : ', this.windowY);
                newIniLines.push(`windowY=${this.windowY}`);
            }
            //do the same for the other keys
            if (!startOfInLines.includes('Joy0_A')) {
                newIniLines.push(`Joy0_A=${this.A_KEY.value}`);
            }
            if (!startOfInLines.includes('Joy0_B')) {
                newIniLines.push(`Joy0_B=${this.B_KEY.value}`);
            }
            if (!startOfInLines.includes('Joy0_Up')) {
                newIniLines.push(`Joy0_Up=${this.UP_KEY.value}`);
            }
            if (!startOfInLines.includes('Joy0_Down')) {
                newIniLines.push(`Joy0_Down=${this.DOWN_KEY.value}`);
            }
            if (!startOfInLines.includes('Joy0_Left')) {
                newIniLines.push(`Joy0_Left=${this.LEFT_KEY.value}`);
            }
            if (!startOfInLines.includes('Joy0_Right')) {
                newIniLines.push(`Joy0_Right=${this.RIGHT_KEY.value}`);
            }
            /*
            if (!startOfInLines.includes('soundOff')) {
                newIniLines.push(`soundOff=1`);
            }
*/
            fs.writeFileSync(this.iniPath, newIniLines.join('\n'));
            this.disableDisabledKeys();

        } catch (e) {
            //console.log("Retrying to configure emulator ", this.name);
            this.configureEmulator();
        }
        //If after all of this, the vba.ini ended up corrupted, we must try again
        //First we must check if the file is corrupted
        try {
            const file = fs.readFileSync(this.iniPath, 'utf8');
            //check if the file is corrupted and has been written correctly by checking if the windowX and windowY are there
            //and are the expected values
            if (!file.includes(`windowX=${this.windowX}`) || !file.includes(`windowY=${this.windowY}`)) {
                console.log("Retrying to configure emulator cause of prob bad positioning", this.name);
                this.configureEmulator();
            }

        } catch (e) {
            console.log("Retrying to configure emulator cause of prob ini corruption", this.name);
            this.configureEmulator();
        }
    }
    disableDisabledKeys() {

        if (this.isOpenned) {
            setTimeout(() => {
                this.disableDisabledKeys();
            }, 2000);
        }

        try {
            //Now we must configure the keys by editing the ini file
            const iniContent = fs.readFileSync(this.iniPath, 'utf8');
            const iniLines = iniContent.split('\n');
            const newIniLines = [];
            const startOfInLines = iniLines.map(line => line.split('=')[0]);

            for (let line of startOfInLines) {
                if (toDisable.includes(line)) {
                    newIniLines.push(`${line}=0`);
                } else {
                    newIniLines.push(iniLines[startOfInLines.indexOf(line)]);
                }
            }
            fs.writeFileSync(this.iniPath, newIniLines.join('\n'));
        } catch (e) {
            //console.log("Retrying to disable keys in emulator ", this.name);
            this.disableDisabledKeys();
        }


    }

    clickInEmulatorsCenter() {
        robot.moveMouse(this.windowX + DISTANCES_TO_CENTER_FROM_ORIGIN[0], this.windowY + DISTANCES_TO_CENTER_FROM_ORIGIN[1]);
        robot.mouseClick();
    }
    disablePauseWhenInactive() {
        this.clickInEmulatorsCenter();
        robot.keyTap('o', ['alt']);
        //Two downs
        robot.keyTap('down');
        robot.keyTap('down');
        robot.keyTap('right');
        //Five downs
        robot.keyTap('down');
        robot.keyTap('down');
        robot.keyTap('down');
        robot.keyTap('down');
        //Enter
        robot.keyTap('enter');
        this.isAlreadyConfigured = true;


    }

    ensureSaveType() {
        this.clickInEmulatorsCenter();
        robot.keyTap('o', ['alt']);
        //Two downs
        robot.keyTap('down');
        robot.keyTap('down');
        robot.keyTap('right');
        //13 downs
        for (let i = 0; i < 13; i++) {
            robot.keyTap('down');
        }
        //right
        robot.keyTap('right');
        //5 downs
        for (let i = 0; i < 7; i++) {
            robot.keyTap('down');
        }
        //Enter
        robot.keyTap('enter');
    }


    openROM() {
        const oldClipboard = this.romPath;
        let pasted = ""
        while (oldClipboard !== pasted) {
            addToClipboard(this.romPath);
            this.clickInEmulatorsCenter();

            //robot.keyTap('o', ['control']);
            //robot.keyTap('v', ['control']);
            robot.keyToggle('control', 'down');
            robot.keyTap('o');
            robot.keyToggle('control', 'up');

            robot.keyToggle('control', 'down');
            robot.keyTap('a');
            //delete all
            robot.keyToggle('control', 'up');
            robot.keyTap('delete');

            robot.keyToggle('control', 'down');
            robot.keyTap('v');
            robot.keyToggle('control', 'up');



            //robot.keyTap('a', ['control']);
            //robot.keyTap('c', ['control']);
            robot.keyToggle('control', 'down');
            robot.keyTap('a');
            robot.keyToggle('control', 'up');
            robot.keyToggle('control', 'down');
            robot.keyTap('c');
            robot.keyToggle('control', 'up');

            pasted = getClipboard();

            if (oldClipboard !== pasted) {
                robot.keyTap('escape');
                robot.keyTap('escape');
                robot.keyTap('escape');
                robot.keyTap('escape');
            }
        }
        robot.keyTap('enter');
    }

    loadSGM() {
        //If generation is 0, load initial.sgm
        //If generation is not 0, load current.sgm
        //console.log('Number of generations: ', this.generations);
        if (this.generations === 0) {
            const oldClipboard = this.initialSgmPath;
            let pasted = ""
            while (oldClipboard !== pasted) {
                addToClipboard(this.initialSgmPath);
                this.clickInEmulatorsCenter();
                //robot.keyTap('l', ['control']);
                //robot.keyTap('v', ['control']);

                robot.keyToggle('control', 'down');
                robot.keyTap('l');
                robot.keyToggle('control', 'up');


                robot.keyToggle('control', 'down');
                robot.keyTap('a');
                //delete all
                robot.keyToggle('control', 'up');
                robot.keyTap('delete');

                robot.keyToggle('control', 'down');
                robot.keyTap('v');
                robot.keyToggle('control', 'up');

                //robot.keyTap('a', ['control']);
                //robot.keyTap('c', ['control']);
                robot.keyToggle('control', 'down');
                robot.keyTap('a');
                robot.keyToggle('control', 'up');
                robot.keyToggle('control', 'down');
                robot.keyTap('c');
                robot.keyToggle('control', 'up');

                pasted = getClipboard();

                if (oldClipboard !== pasted) {
                    robot.keyTap('escape');
                    robot.keyTap('escape');
                    robot.keyTap('escape');
                    robot.keyTap('escape');
                }
            }
            robot.keyTap('enter');

        } else {
            const oldClipboard = this.currentSgmPath;
            let pasted = ""
            while (oldClipboard !== pasted) {
                addToClipboard(this.currentSgmPath);
                this.clickInEmulatorsCenter();
                //robot.keyTap('l', ['control']);
                //robot.keyTap('v', ['control']);
                robot.keyToggle('control', 'down');
                robot.keyTap('a');
                //delete all
                robot.keyTap('delete');
                robot.keyToggle('control', 'down');
                robot.keyTap('l');

                robot.keyToggle('control', 'down');
                robot.keyTap('a');
                //delete all
                robot.keyToggle('control', 'up');
                robot.keyTap('delete');

                robot.keyToggle('control', 'up');
                robot.keyToggle('control', 'down');
                robot.keyTap('v');
                robot.keyToggle('control', 'up');


                //robot.keyTap('a', ['control']);
                //robot.keyTap('c', ['control']);
                robot.keyToggle('control', 'down');
                robot.keyTap('a');
                robot.keyToggle('control', 'up');
                robot.keyToggle('control', 'down');
                robot.keyTap('c');
                robot.keyToggle('control', 'up');

                pasted = getClipboard();

                if (oldClipboard !== pasted) {
                    robot.keyTap('escape');
                    robot.keyTap('escape');
                    robot.keyTap('escape');
                    robot.keyTap('escape');
                }
            }
            robot.keyTap('enter');
        }
    }

    generateActionsForThisIteration() {

        //console.log('Generating actions for emulator: ', this.name + ' with mode: ', this.actionsGenerationMode);
        //console.log(`Emulator ${this.name} has this possible actions: `, this.keys);
        switch (this.actionsGenerationMode) {
            case 'ALL_RANDOM':
                const actions = [];
                console.log('Number of actions for this generation: ', this.numberOfActionsForThisGeneration);
                for (let j = 0; j < this.numberOfActionsForThisGeneration; j++) {
                    const randomIndex = Math.floor(Math.random() * this.keys.length);
                    const randomKey = this.keys[randomIndex];
                    const action = randomKey.name;
                    actions.push(action);
                }
                this.actionsForThisGeneration = actions;
                return actions;
            case 'STILL':
                this.actionsForThisGeneration = [];
                return [];
            default:
                throw new Error('Mode not recognized');

        }

    }

    saveSGM() {
        //console.log('Saving SGM for emulator: ', this.name + ' in path ', this.currentSgmPath);
        const oldClipboard = this.currentSgmPath;
        let pasted = ""
        while (oldClipboard !== pasted) {
            addToClipboard(this.currentSgmPath);
            this.clickInEmulatorsCenter();
            //robot.keyTap('s', ['control']);

            //robot.keyTap('v', ['control']);

            robot.keyToggle('control', 'down');
            robot.keyTap('a');
            //delete all
            robot.keyTap('delete');


            robot.keyToggle('control', 'down');
            robot.keyTap('s');
            robot.keyToggle('control', 'up');


            robot.keyToggle('control', 'down');
            robot.keyTap('a');
            //delete all
            robot.keyToggle('control', 'up');
            robot.keyTap('delete');

            robot.keyToggle('control', 'down');
            robot.keyTap('v');
            robot.keyToggle('control', 'up');


            //robot.keyTap('a', ['control']);
            //robot.keyTap('c', ['control']);
            robot.keyToggle('control', 'down');
            robot.keyTap('a');
            robot.keyToggle('control', 'up');
            robot.keyToggle('control', 'down');
            robot.keyTap('c');
            robot.keyToggle('control', 'up');
            pasted = getClipboard();

            if (oldClipboard !== pasted) {
                robot.keyTap('escape');
                robot.keyTap('escape');
                robot.keyTap('escape');
                robot.keyTap('escape');
            }
        }
        robot.keyTap('enter');
        //Press escape to ensure the save is done
        robot.keyTap('escape');
        robot.keyTap('escape');
        robot.keyTap('escape');
        robot.keyTap('escape');
    }

    calculateEntropyOfCurrentSGM() {
        this.previousEntropyOfSGM = this.entropyOfSGM;
        this.entropyOfSGM = getEntropyOfFile(this.currentSgmPath);
        this.entropyDelta = Math.abs(this.entropyOfSGM - this.previousEntropyOfSGM);
    }

}

module.exports = Emulator;