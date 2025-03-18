const fs = require('fs');
const path = require('path');


function saveSettings(scaleFactor) {
  try {
      const settingsFile = path.join(app.getPath('userData'), 'settings.json');
      const settings = { scaleFactor };

      fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2), 'utf8');
      console.log(`✅ Scale factor saved: ${scaleFactor}%`);
  } catch (error) {
      console.error('❌ Error saving settings:', error);
  }
}

module.exports = { saveSettings };