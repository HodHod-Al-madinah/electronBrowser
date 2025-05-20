const { dialog } = require('electron');
const { saveSettings } = require('../utils/settings');

async function promptForScaleFactor(mainWindow, scaleFactor) {
  const options = {
    type: 'info',
    buttons: ['100%', '92%', '90%', '88%', '85%', '83%', 'Cancel'],
    defaultId: getScaleFactorButtonIndex(scaleFactor), 
    title: 'Set Scale Factor',
    message: `Current scale factor: ${scaleFactor}%`,
    detail: 'Select a scale factor to apply.',
  };

  const response = await dialog.showMessageBox(mainWindow, options);

  switch (response.response) {
    case 0: scaleFactor = 100; break;
    case 1: scaleFactor = 92; break;
    case 2: scaleFactor = 90; break;
    case 3: scaleFactor = 88; break;
    case 4: scaleFactor = 85; break;
    case 5: scaleFactor = 83; break;
    default: return scaleFactor;
  }

  await saveSettings(scaleFactor);


  await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Scale Factor Updated',
    message: `Scale factor set to ${scaleFactor}%`
  });

  return scaleFactor; 
}


function getScaleFactorButtonIndex(scaleFactor) {
  switch (scaleFactor) {
    case 100: return 0;
    case 92: return 1;
    case 90: return 2;
    case 88: return 3;
    case 85: return 4;
    case 83: return 5;
    default: return 0; 
  }
}

module.exports = { promptForScaleFactor };
