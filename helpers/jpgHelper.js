const fs = require('fs');
const path = require('path');
const { dialog, shell } = require('electron');


function convertToJPGAndOpenWhatsApp(window, whatsappNumber) {
  const timestamp = Date.now();
  const jpgPath = path.join(__dirname, `../attachment/invoice_${timestamp}.jpg`);

  window.webContents.capturePage().then(image => {
    // Save the image as JPEG with 100% quality
    fs.writeFileSync(jpgPath, image.toJPEG(100));

    if (!whatsappNumber) {
      dialog.showMessageBox(window, {
        message: 'No WhatsApp number saved. Please save the number first.',
        buttons: ['OK']
      });
      return;
    }

    // Inform the user that the JPG is created
    dialog.showMessageBox(window, {
      message: 'JPG created successfully!',
      detail: `JPG saved to: ${jpgPath}\nNow opening WhatsApp...`,
      buttons: ['OK'],
      defaultId: 0
    }).then(() => {
      // Create a message including the JPG file location
      const message = encodeURIComponent(`Please find the attached invoice at this location on your system:\n${jpgPath}`);
      // shell.openExternal(`https://wa.me/${whatsappNumber}?text=${message}`);
      shell.openExternal(`https://web.whatsapp.com/send?phone=${whatsappNumber}&text=${message}`);    });

    console.log(`Invoice saved as JPG: ${jpgPath}`);
  }).catch(error => {
    console.error('Failed to generate JPG:', error);
  });
}



// Function to convert the current page to JPG only
function convertToJPG(window) {
  const timestamp = Date.now(); 
  const jpgPath = path.join(__dirname, `../attachment/invoice_${timestamp}.jpg`);

  window.webContents.capturePage().then(image => {
    fs.writeFileSync(jpgPath, image.toJPEG(100));

    dialog.showMessageBox(window, {
      message: 'JPG created successfully!',
      detail: `JPG saved to: ${jpgPath}`,
      buttons: ['OK']
    });

    console.log(`Invoice saved as JPG: ${jpgPath}`);
  }).catch(error => {
    console.error('Failed to generate JPG:', error);
  });
}


module.exports = { convertToJPG, convertToJPGAndOpenWhatsApp };
