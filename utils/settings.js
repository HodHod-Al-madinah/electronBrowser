const fs = require('fs');
const path = require('path');

let settingsFile = path.join(__dirname, '../settings.json');

// Function to load settings from the settings.json file
function loadSettings() {
  try {
    const data = fs.readFileSync(settingsFile);
    const settings = JSON.parse(data);
    console.log('Settings loaded:', settings);
    return settings.scaleFactor || 88;  // Return scaleFactor or default value
  } catch (error) {
    console.log('No settings file found, using defaults.');
    return 88;  // Default scale factor
  }
}

// Function to save the current scaleFactor to the settings.json file
function saveSettings(scaleFactor) {  // Pass scaleFactor as a parameter
  const settings = {
    scaleFactor: scaleFactor,
  };
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  console.log('Settings saved:', settings);
}

module.exports = { loadSettings, saveSettings };
