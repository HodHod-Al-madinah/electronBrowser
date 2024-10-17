const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');

// Function to convert the current page to JPG
function convertToJPG(window) {
  const jpgPath = path.join(__dirname, '../../output.jpg');  // Path to save the JPG file

  window.webContents.capturePage().then(image => {
    fs.writeFileSync(jpgPath, image.toJPEG(100));  // Save image as JPEG

    dialog.showMessageBox(window, {
      message: 'JPG created successfully!',
      detail: `JPG saved to: ${jpgPath}`
    });

  }).catch(error => {
    console.error('Failed to generate JPG:', error);
  });
}

module.exports = { convertToJPG };
