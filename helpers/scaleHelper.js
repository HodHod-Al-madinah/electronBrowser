const { dialog } = require('electron');
const { saveSettings } = require('../utils/settings');

// Function to prompt the user for a scale factor
async function promptForScaleFactor(mainWindow, scaleFactor) {
  const options = {
    type: 'info',
    buttons: ['100%','92%', '90%', '88%', '85%', '83%', 'Cancel'],
    defaultId: getScaleFactorButtonIndex(scaleFactor),  // Use current scaleFactor as default
    title: 'Set Scale Factor',
    message: `Current scale factor: ${scaleFactor}%`,
    detail: 'Select a scale factor to apply.',
  };

  const response = await dialog.showMessageBox(mainWindow, options);

  // Update scaleFactor based on user selection
  switch (response.response) {
    case 0:
      scaleFactor = 100;
      break;
    case 1:
      scaleFactor = 92;
      break;
    case 2:   
      scaleFactor = 90;
      break;
    case 3:
      scaleFactor = 88;
      break;
    case 4:
      scaleFactor = 85;
      break;
      case 5:
        scaleFactor = 83;
        break;
    default :
      return;  // Do nothing if Cancel is selected
  }

  // Save the updated scaleFactor to settings.json
  saveSettings(scaleFactor);

  // Confirm the update
  dialog.showMessageBox(mainWindow, {
    message: `Scale factor set to ${scaleFactor}%`
  });

  return scaleFactor;  // Return the updated scaleFactor
}

// Function to return the correct button index based on the current scale factor
function getScaleFactorButtonIndex(scaleFactor) {
  switch (scaleFactor) {
    case 100: return 0;
    case 92: return 1;
    case 90: return 2;
    case 88: return 3;
    case 85: return 4;
    case 83: return 5;
    default: return 0;  // Default to 100%
  }
}

module.exports = { promptForScaleFactor };
