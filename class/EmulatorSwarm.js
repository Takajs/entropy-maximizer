const { spawn } = require('child_process');
const robot = require("robotjs");
const fs = require('fs');
const path = require('path');
const ks = require('node-key-sender');
robot.setMouseDelay(1);
robot.setKeyboardDelay(1);
const Emulator = require('./Emulator');


const MY_SCREEN_SIZE = [500, 500];

const DISTANCES_BETWEEN_EMULATORS = [245, 215];
//const DISTANCES_BETWEEN_EMULATORS = [242, 215]; //NEVER CHANGE WITHOUT TAKING INTO ACCOUNT THE REST OF THE THINGS THAT DEPEND ON THIS VALUE

const MAX_EMULATOR_PER_ROW = Math.floor(MY_SCREEN_SIZE[0] / DISTANCES_BETWEEN_EMULATORS[0]);
const MAX_EMULATOR_PER_COLUMN = Math.floor(MY_SCREEN_SIZE[1] / DISTANCES_BETWEEN_EMULATORS[1]);


const VBA_KEY_BINDINGS_JSON_PATH = path.join(__dirname, '..', 'emulator', 'get-bindings', 'vba-key-bindings.json');

const AVAILABLE_KEYS = JSON.parse(fs.readFileSync(VBA_KEY_BINDINGS_JSON_PATH, 'utf8'));
const AVAILABLE_GBA_ACTIONS = ['A', 'B', 'Up', 'Down', 'Left', 'Right'];
const NO_KEY = { value: 0, name: 'No key' };

const BASE_STEPS = 100;
const INCREMENT_STEPS = 50;


class EmulatorSwarm {

    constructor(mode, limit, shouldStillEmulatorBeIncluded, entropyMode) {

        const IMPLEMENTED_MODES = ['ALL_RANDOM', 'ALL_RANDOM_NO_INNER_REPEAT', 'RANDOM_AND_ITS_REVERSE'];
        if (!mode || !IMPLEMENTED_MODES.includes(mode)) {
            throw new Error('Mode not recognized');
        }

        const IMPLEMENTED_ENTROPY_MODES = ['min', 'max', 'delta'];
        if (!entropyMode || !IMPLEMENTED_ENTROPY_MODES.includes(entropyMode)) {
            throw new Error('Entropy mode not recognized');
        }

        this.entropyMode = entropyMode;

        this.mode = mode;
        this.limit = limit ? limit : null;
        this.bestEntropy = (this.entropyMode === 'max' || this.entropyMode === 'delta') ? 0 : Infinity;
        this.numberOfEmulatorsPerRow = 0;
        this.numberOfEmulatorsPerColumn = 0;
        if (!this.limit) {
            this.numberOfEmulatorsPerRow = MAX_EMULATOR_PER_ROW;
            this.numberOfEmulatorsPerColumn = MAX_EMULATOR_PER_COLUMN;
        } else {
            this.numberOfEmulatorsPerRow = Math.floor(this.limit / 2);
            this.numberOfEmulatorsPerColumn = Math.floor(this.limit / 2);
        }
        this.emulatorsPool = [];

        this.shouldStillEmulatorBeIncluded = shouldStillEmulatorBeIncluded;
        //console.log(this.numberOfEmulatorsPerRow, this.numberOfEmulatorsPerColumn);

        //Add emulators to the pool
        this.createEmulatorsPool();
    }

    createEmulatorsPool() {
        for (let i = 0; i < this.numberOfEmulatorsPerRow; i++) {
            for (let j = 0; j < this.numberOfEmulatorsPerColumn; j++) {
                if (this.shouldStillEmulatorBeIncluded && i === this.numberOfEmulatorsPerRow - 1 && j === this.numberOfEmulatorsPerColumn - 1) {
                    //console.log("Adding still emulator", `STILL_EMULATOR_${i}_${j}`);
                    this.emulatorsPool.push(new Emulator(i * DISTANCES_BETWEEN_EMULATORS[0], j * DISTANCES_BETWEEN_EMULATORS[1], NO_KEY, NO_KEY, NO_KEY, NO_KEY, NO_KEY, NO_KEY, `STILL_EMULATOR_${i}_${j}`, 0, 0, 'STILL'));


                } else {
                    const keysBindings = this.shouldStillEmulatorBeIncluded ? this.getKeysBindings(this.numberOfEmulatorsPerRow * this.numberOfEmulatorsPerColumn) : this.getKeysBindings((this.numberOfEmulatorsPerRow * this.numberOfEmulatorsPerColumn) - 1)

                    const A_KEY = { value: keysBindings[i * j][0].value, name: keysBindings[i * j][0].key };
                    const B_KEY = { value: keysBindings[i * j][1].value, name: keysBindings[i * j][1].key };
                    const UP_KEY = { value: keysBindings[i * j][2].value, name: keysBindings[i * j][2].key };
                    const DOWN_KEY = { value: keysBindings[i * j][3].value, name: keysBindings[i * j][3].key };
                    const LEFT_KEY = { value: keysBindings[i * j][4].value, name: keysBindings[i * j][4].key };
                    const RIGHT_KEY = { value: keysBindings[i * j][5].value, name: keysBindings[i * j][5].key };
                    //console.log("Adding emulator", `EMULATOR_${i}_${j}`);
                    this.emulatorsPool.push(new Emulator(i * DISTANCES_BETWEEN_EMULATORS[0], j * DISTANCES_BETWEEN_EMULATORS[1], A_KEY, B_KEY, UP_KEY, DOWN_KEY, LEFT_KEY, RIGHT_KEY, `EMULATOR_${i}_${j}`, BASE_STEPS, INCREMENT_STEPS, 'ALL_RANDOM'));
                }

            }
        }


    }

    getKeysBindings(numberOfConfigurationsNeeded) {

        switch (this.mode) {
            case 'ALL_RANDOM':
                //This should return an array of arrays where each subarray has AVAILABLE_GBA_ACTIONS.length random objects from AVAILABLE_KEYS
                const keysBindings = [];
                for (let i = 0; i < numberOfConfigurationsNeeded; i++) {
                    const keysBinding = [];
                    for (let j = 0; j < AVAILABLE_GBA_ACTIONS.length; j++) {
                        keysBinding.push(AVAILABLE_KEYS[Math.floor(Math.random() * AVAILABLE_KEYS.length)]);
                    }
                    keysBindings.push(keysBinding);
                }
                return keysBindings;
            case 'ALL_RANDOM_NO_INNER_REPEAT':
                //This should return an array of arrays where each subarray has AVAILABLE_GBA_ACTIONS.length random objects from AVAILABLE_KEYS, each subarray is granted to not have any repeated key inside itself (other emulators can have the same key)
                const keysBindingsNoInnerRepeat = [];
                for (let i = 0; i < numberOfConfigurationsNeeded; i++) {
                    const keysBinding = [];
                    for (let j = 0; j < AVAILABLE_GBA_ACTIONS.length; j++) {
                        let randomKey = AVAILABLE_KEYS[Math.floor(Math.random() * AVAILABLE_KEYS.length)];
                        while (keysBinding.includes(randomKey)) {
                            randomKey = AVAILABLE_KEYS[Math.floor(Math.random() * AVAILABLE_KEYS.length)];
                        }
                        keysBinding.push(randomKey);
                    }
                    keysBindingsNoInnerRepeat.push(keysBinding);
                }
                return keysBindingsNoInnerRepeat;
            case 'RANDOM_AND_ITS_REVERSE':
                //This should return an array of arrays where each 2 subarrays are created each time, the first subarray has AVAILABLE_GBA_ACTIONS.length random objects from AVAILABLE_KEYS, the second subarray has the reverse of the first subarray
                //we do this until we reach the numberOfConfigurationsNeeded
                const keysBindingsRandomAndItsReverse = [];
                while (keysBindingsRandomAndItsReverse.length < numberOfConfigurationsNeeded) {
                    const keysBinding = [];
                    for (let j = 0; j < AVAILABLE_GBA_ACTIONS.length; j++) {
                        keysBinding.push(AVAILABLE_KEYS[Math.floor(Math.random() * AVAILABLE_KEYS.length)]);
                    }
                    keysBindingsRandomAndItsReverse.push(keysBinding);
                    if (keysBindingsRandomAndItsReverse.length < numberOfConfigurationsNeeded) {
                        keysBindingsRandomAndItsReverse.push(keysBinding.reverse());
                    }
                }
                return keysBindingsRandomAndItsReverse;
            default:
                throw new Error('Mode not recognized');

        }


    }

    async spawnEmulators() {
        //promise.all this.emulatorsPool[i].spawnVBA();
        const promises = this.emulatorsPool.map(emulator => emulator.spawnVBA())
        return await Promise.all(promises);
    }
    disablePauseWhenInactive() {
        console.log("♻️ Changing pause when inactive status...");
        for (let i = 0; i < this.emulatorsPool.length; i++) {
            this.emulatorsPool[i].disablePauseWhenInactive();
        }
    }
    generateActionsForThisIteration() {
        const allActions = [];
        for (let i = 0; i < this.emulatorsPool.length; i++) {
            const actions = this.emulatorsPool[i].generateActionsForThisIteration();
            //console.log("Actions for emulator ", this.emulatorsPool[i].name, " are: ", actions);
            allActions.push(actions);
        }
        //console.log("------> All actions: ", allActions);
        return allActions;
    }
    takeActions() {

        this.generateActionsForThisIteration();

        let indexOfEmulatorWithLargestActions = 0;
        let largestActions = this.emulatorsPool[0].numberOfActionsForThisGeneration;
        for (let i = 0; i < this.emulatorsPool.length; i++) {
            if (this.emulatorsPool[i].numberOfActionsForThisGeneration > largestActions) {
                //console.log("New largest actions: ", this.emulatorsPool[i].actionsForThisGeneration, " from emulator ", this.emulatorsPool[i].name);
                largestActions = this.emulatorsPool[i].numberOfActionsForThisGeneration
                indexOfEmulatorWithLargestActions = i;
            }
        }
        //console.log("Largest actions are from emulator ", this.emulatorsPool[indexOfEmulatorWithLargestActions].name, " with index ", indexOfEmulatorWithLargestActions);
        console.log(`🕹️   About to perform ${this.emulatorsPool[indexOfEmulatorWithLargestActions].actionsForThisGeneration.length} actions with each emulator...`);
        //Now from 0 to actionsForThisGeneration, we will take the ith action from each emulator (if it has it)
        //Treat progress as a percentage of this.emulatorsPool[indexOfEmulatorWithLargestActions].actionsForThisGeneration?.length taking into account i value
        let progress = 0;
        for (let i = 0; i < this.emulatorsPool[indexOfEmulatorWithLargestActions].actionsForThisGeneration?.length; i++) {
            progress = (i / this.emulatorsPool[indexOfEmulatorWithLargestActions].actionsForThisGeneration?.length) * 100;
            //console.log("Taking actions for turn ", i, " from a pool of ", this.emulatorsPool.length, " emulators");
            const actionsToPerformThisTurn = [];
            for (let j = 0; j < this.emulatorsPool.length; j++) {
                if (this.emulatorsPool[j].actionsForThisGeneration?.length > i) {
                    //console.log(+i + ", " + j + "  --> Adding action ", this.emulatorsPool[j].actionsForThisGeneration[i], " from emulator ", this.emulatorsPool[j].name);
                    actionsToPerformThisTurn.push(this.emulatorsPool[j].actionsForThisGeneration[i]);
                } else {
                    //console.log("Emulator ", this.emulatorsPool[j].name, " has no action for turn ", i);
                }
            }
            //remove repeated actions
            //Perform the actions at the same time
            const uniqueActions = [...new Set(actionsToPerformThisTurn)];

            //console.log("Unique actions: ", uniqueActions, " for turn ", i);
            for (let k = 0; k < uniqueActions.length; k++) {
                robot.keyTap(uniqueActions[k]);
                if (k === 0) {
                    //console.log(`🕹️  Pressing keys ${i + 1}/${this.emulatorsPool[indexOfEmulatorWithLargestActions].actionsForThisGeneration?.length}`);
                    //Show it as a percentage
                    console.log(`🕹️   Pressing keys: (Progress ${progress.toFixed(2)}%)`);
                }
            }


        }

        console.log(`🕹️   Pressing keys: (Progress 100%)`);

        //Disable the actions to save quicker the sgms


        //disable by looping
        /*
        for (let i = 0; i < this.emulatorsPool.length; i++) {
            this.emulatorsPool[i].disablePauseWhenInactive();
        }
            */
        this.disablePauseWhenInactive();

        this.saveSGM();

        //Now, we will choose the emulator with the largest entropyOfSGM and we will replace the save file of every other emulator with the save file of this one
        let indexOfEmulatorWithLargestEntropy = this.emulatorsPool.length - 1;
        console.log("🔢 Calculating entropy of each emulator ...");
        //Calculate the entropy of each emulator
        for (let i = 0; i < this.emulatorsPool.length; i++) {
            this.emulatorsPool[i].calculateEntropyOfCurrentSGM();
        }

        let bestEntropy = this.emulatorsPool[0].entropyOfSGM;
        for (let i = 0; i < this.emulatorsPool.length; i++) {
            //Recalculate entropy
            if (this.entropyMode === 'max') {
                if (this.emulatorsPool[i].entropyOfSGM >= bestEntropy) {
                    //console.log("New largest entropy: ", this.emulatorsPool[i].entropyOfSGM, " from emulator ", this.emulatorsPool[i].name);
                    bestEntropy = this.emulatorsPool[i].entropyOfSGM;
                    indexOfEmulatorWithLargestEntropy = i;
                } else {
                    //console.log("Entropy of emulator ", this.emulatorsPool[i].name, " is ", this.emulatorsPool[i].entropyOfSGM, " which is lower than the largest entropy ", bestEntropy, " from emulator ", this.emulatorsPool[indexOfEmulatorWithLargestEntropy].name);
                }
            }
            if (this.entropyMode === 'min') {
                if (this.emulatorsPool[i].entropyOfSGM <= bestEntropy) {
                    console.log("New smallest local entropy: ", this.emulatorsPool[i].entropyOfSGM, " from emulator ", this.emulatorsPool[i].name);
                    bestEntropy = this.emulatorsPool[i].entropyOfSGM;
                    indexOfEmulatorWithLargestEntropy = i;
                } else {
                    console.log("Entropy of emulator ", this.emulatorsPool[i].name, " is ", this.emulatorsPool[i].entropyOfSGM, " which is higher or equal than the smallest local entropy ", bestEntropy, " from emulator ", this.emulatorsPool[indexOfEmulatorWithLargestEntropy].name);
                }
            }
            if (this.entropyMode === 'delta') {
                //Calculate largest local .entropyDelta
                if (this.emulatorsPool[i].entropyDelta >= bestEntropy) {
                    //console.log("New largest local entropyDelta: ", this.emulatorsPool[i].entropyDelta, " from emulator ", this.emulatorsPool[i].name);
                    bestEntropy = this.emulatorsPool[i].entropyDelta;
                    indexOfEmulatorWithLargestEntropy = i;
                } else {
                    //console.log("Entropy of emulator ", this.emulatorsPool[i].name, " is ", this.emulatorsPool[i].entropyDelta, " which is lower than the largest entropyDelta ", bestEntropy, " from emulator ", this.emulatorsPool[indexOfEmulatorWithLargestEntropy].name);
                }
            }
        }


        //print the entropy of each emulator

        for (let i = 0; i < this.emulatorsPool.length; i++) {
            console.log("🔢 Emulator " + this.emulatorsPool[i].name + " (" + i + ")  got ", this.emulatorsPool[i].entropyOfSGM);
            if (this.entropyMode === 'delta') {
                console.log("🔢 Emulator " + this.emulatorsPool[i].name + " (" + i + ")  got ", this.emulatorsPool[i].previousEntropyOfSGM, " last round, which results in delta =  ", this.emulatorsPool[i].entropyDelta);
            }
        }


        //IMPORTANT: We could make that if we are not making a new record in highst entropy (TODO DEVELOP TO BE ABLE TO TRACK IT)
        //Then we can repeat actions part until we have a new record in entropy

        if (this.entropyMode === 'max') {
            if (this.emulatorsPool[indexOfEmulatorWithLargestEntropy].entropyOfSGM > this.bestEntropy) {
                console.log("🏆  We have a new high entropy point. It was discovered by ", this.emulatorsPool[indexOfEmulatorWithLargestEntropy].name, " (" + indexOfEmulatorWithLargestEntropy + ") with entropy ", this.emulatorsPool[indexOfEmulatorWithLargestEntropy].entropyOfSGM + " > " + this.bestEntropy);

                this.bestEntropy = this.emulatorsPool[indexOfEmulatorWithLargestEntropy].entropyOfSGM;
                for (let i = 0; i < this.emulatorsPool.length; i++) {
                    this.emulatorsPool[i].numberOfActionsForThisGeneration = BASE_STEPS;
                }

            } else {
                console.log("🚫  No new record in entropy yet: " + this.bestEntropy + " >= " + this.emulatorsPool[indexOfEmulatorWithLargestEntropy].entropyOfSGM + " (Best score) (" + indexOfEmulatorWithLargestEntropy + ").");
                console.log("🤗  We will increase the number of actions in the next iteration.");
                for (let i = 0; i < this.emulatorsPool.length; i++) {
                    //this.emulatorsPool[i].baseSteps += this.emulatorsPool[i].incrementIfStuck;
                    console.log("Increasing number of actions for this generation for emulator ", this.emulatorsPool[i].name, " from ", this.emulatorsPool[i].numberOfActionsForThisGeneration, " to ", this.emulatorsPool[i].numberOfActionsForThisGeneration * 2);

                    this.emulatorsPool[i].numberOfActionsForThisGeneration *= 2;
                }
                //reenable by looping again
                /*
                for (let i = 0; i < this.emulatorsPool.length; i++) {
                    this.emulatorsPool[i].disablePauseWhenInactive();
                }
                    */
                this.disablePauseWhenInactive();

                this.takeActions();
            }
        }
        if (this.entropyMode === 'min') {
            if (this.emulatorsPool[indexOfEmulatorWithLargestEntropy].entropyOfSGM < this.bestEntropy) {
                console.log("🏆  We have a new low entropy point. It was discovered by ", this.emulatorsPool[indexOfEmulatorWithLargestEntropy].name, " (with entropy ", this.emulatorsPool[indexOfEmulatorWithLargestEntropy].entropyOfSGM + " < " + this.bestEntropy);

                this.bestEntropy = this.emulatorsPool[indexOfEmulatorWithLargestEntropy].entropyOfSGM;
                for (let i = 0; i < this.emulatorsPool.length; i++) {
                    this.emulatorsPool[i].numberOfActionsForThisGeneration = BASE_STEPS;
                }

            } else {
                console.log("🚫  No new record in entropy yet: " + this.bestEntropy + " <= " + this.emulatorsPool[indexOfEmulatorWithLargestEntropy].entropyOfSGM + ". We will keep moving forward.");
                for (let i = 0; i < this.emulatorsPool.length; i++) {
                    //this.emulatorsPool[i].baseSteps += this.emulatorsPool[i].incrementIfStuck;
                    console.log("Increasing number of actions for this generation for emulator ", this.emulatorsPool[i].name, " from ", this.emulatorsPool[i].numberOfActionsForThisGeneration, " to ", this.emulatorsPool[i].numberOfActionsForThisGeneration * 2);
                    this.emulatorsPool[i].numberOfActionsForThisGeneration = this.emulatorsPool[i].numberOfActionsForThisGeneration * 2;


                }
                //reenable by looping again
                /*
                for (let i = 0; i < this.emulatorsPool.length; i++) {
                    this.emulatorsPool[i].disablePauseWhenInactive();
                }
                    */
                this.disablePauseWhenInactive();

                this.takeActions();
            }
        }
        if (this.entropyMode === 'delta') {
            if (this.emulatorsPool[indexOfEmulatorWithLargestEntropy].entropyDelta > this.bestEntropy) {
                console.log("🏆  We have a new high entropy delta point. It was discovered by ", this.emulatorsPool[indexOfEmulatorWithLargestEntropy].name, " (with entropy delta ", this.emulatorsPool[indexOfEmulatorWithLargestEntropy].entropyDelta + " > " + this.bestEntropy);

                this.bestEntropy = this.emulatorsPool[indexOfEmulatorWithLargestEntropy].entropyDelta;
                for (let i = 0; i < this.emulatorsPool.length; i++) {
                    this.emulatorsPool[i].numberOfActionsForThisGeneration = BASE_STEPS;
                }

            } else {
                console.log("🚫  No new record in entropy delta yet: " + this.bestEntropy + " >= " + this.emulatorsPool[indexOfEmulatorWithLargestEntropy].entropyDelta + ". We will keep moving forward.");
                for (let i = 0; i < this.emulatorsPool.length; i++) {
                    //this.emulatorsPool[i].baseSteps += this.emulatorsPool[i].incrementIfStuck;
                    this.emulatorsPool[i].numberOfActionsForThisGeneration += INCREMENT_STEPS;
                }
                //reenable by looping again
                /*
                for (let i = 0; i < this.emulatorsPool.length; i++) {
                    this.emulatorsPool[i].disablePauseWhenInactive();
                }
                    */
                this.disablePauseWhenInactive();

                this.takeActions();
            }
        }

        //Increment generations for all emulators
        this.incrementGenerations();

        //if the index of the winner is the last one and we have a still emulator, we need to increment the base steps by increment steps
        if (indexOfEmulatorWithLargestEntropy === this.emulatorsPool.length - 1 && this.shouldStillEmulatorBeIncluded) {
            for (let i = 0; i < this.emulatorsPool.length; i++) {
                this.emulatorsPool[i].baseSteps += this.emulatorsPool[i].incrementIfStuck;
            }
        } else {
            for (let i = 0; i < this.emulatorsPool.length; i++) {
                this.emulatorsPool[i].baseSteps = BASE_STEPS;
            }
        }


        for (let i = 0; i < this.emulatorsPool.length; i++) {
            if (i !== indexOfEmulatorWithLargestEntropy) {
                //console.log("Copying save file from ", this.emulatorsPool[indexOfEmulatorWithLargestEntropy].currentSgmPath, " to ", this.emulatorsPool[i].currentSgmPath);
                fs.copyFileSync(this.emulatorsPool[indexOfEmulatorWithLargestEntropy].currentSgmPath, this.emulatorsPool[i].currentSgmPath);

            }
        }

        //load by looping
        for (let i = 0; i < this.emulatorsPool.length; i++) {
            this.emulatorsPool[i].loadSGM();
        }
        //reenable by looping again
        /*
        for (let i = 0; i < this.emulatorsPool.length; i++) {
            this.emulatorsPool[i].disablePauseWhenInactive();
        }
            */
        this.disablePauseWhenInactive();

    }

    incrementGenerations() {
        for (let i = 0; i < this.emulatorsPool.length; i++) {
            this.emulatorsPool[i].generations++;
        }
    }

    openROM() {
        for (let i = 0; i < this.emulatorsPool.length; i++) {
            this.emulatorsPool[i].openROM();
        }
    }
    loadSGM() {
        console.log("🔄 Loading SGMs ...");
        for (let i = 0; i < this.emulatorsPool.length; i++) {
            this.emulatorsPool[i].loadSGM();
            //this.emulatorsPool[i].loadSGM();
        }
    }

    saveSGM() {
        console.log("💾 Saving SGMs ...");
        for (let i = 0; i < this.emulatorsPool.length; i++) {
            this.emulatorsPool[i].saveSGM();
            //this.emulatorsPool[i].saveSGM();
        }

    }

    ensureSaveType() {
        for (let i = 0; i < this.emulatorsPool.length; i++) {
            setTimeout(() => {
                this.emulatorsPool[i].ensureSaveType();
            }, 50);
        }
    }
}

module.exports = EmulatorSwarm;