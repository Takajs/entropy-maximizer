const EmulatorSwarm = require('./class/EmulatorSwarm');
const fs = require('fs');
const path = require('path');
async function main() {

    const dirname = path.join(__dirname, 'emulator', 'agents');
    if (fs.existsSync(dirname)) {
        fs.rmSync(dirname, { recursive: true });
    }
    fs.mkdirSync(dirname);


    const emulatorSwarm = new EmulatorSwarm('ALL_RANDOM', null, false, 'max');
    async function startSwarm() {
        console.log("⚙️  Preparing Emulators...");
        await emulatorSwarm.spawnEmulators();

        //emulatorSwarm.ensureSaveType();
        emulatorSwarm.openROM();
        emulatorSwarm.loadSGM();
        emulatorSwarm.disablePauseWhenInactive();
    }
    function maximizeEntropy() {
        const generatedActions = emulatorSwarm.generateActionsForThisIteration();
        //console.log("Generated actions: ", generatedActions);
        emulatorSwarm.takeActions();
    }


    await startSwarm();
    setInterval(() => {
        maximizeEntropy();
    }, 2000);
}

main();