const fs = require('fs');
const path = require('path');

let settingsFile = path.join(__dirname, '../settings.json');

function loadSettings() {
  try {
    const data = fs.readFileSync(settingsFile);
    const settings = JSON.parse(data);
    console.log('Settings loaded:', settings);
    return settings.scaleFactor || 88;  
  } catch (error) {
    console.log('No settings file found, using defaults.');
    return 88;  
  }
}

function saveSettings(scaleFactor) {
  const settings = {
    scaleFactor: scaleFactor,
  };
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  console.log('Settings saved:', settings);
}

module.exports = { loadSettings, saveSettings };
