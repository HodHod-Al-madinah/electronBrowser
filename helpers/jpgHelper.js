const fs = require('fs');
const path = require('path');
const { dialog, shell } = require('electron');

// Function to convert the current page to JPG only
function convertToJPG(window) {
  const timestamp = Date.now(); 
  const jpgPath = path.join(__dirname, `../attachment/invoice_${timestamp}.jpg`);

  window.webContents.capturePage().then(image => {
    // Save the image as JPEG with 100% quality
    fs.writeFileSync(jpgPath, image.toJPEG(100));

    // Inform the user that the JPG is created
    dialog.showMessageBox(window, {
      message: 'JPG created successfully!',
      detail: `JPG saved to: ${jpgPath}`,
      defaultId: 0
    });

    console.log(`Invoice saved as JPG: ${jpgPath}`);
  }).catch(error => {
    console.error('Failed to generate JPG:', error);
  });
}


// Function to convert the current page to JPG and open WhatsApp
function convertToJPGAndOpenWhatsApp(window) {
  const timestamp = Date.now(); 
  const jpgPath = path.join(__dirname, `../attachment/invoice_${timestamp}.jpg`);

  window.webContents.capturePage().then(image => {
    // Save the image as JPEG with 100% quality
    fs.writeFileSync(jpgPath, image.toJPEG(100));

    // Retrieve the saved WhatsApp number from local storage
    window.webContents.executeJavaScript(`
      localStorage.getItem('whatsapp_number');
    `).then(phoneNumber => {
      if (!phoneNumber) {
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
        // Open WhatsApp with the saved phone number and a message
        const message = encodeURIComponent('Please find the attached invoice.');
        shell.openExternal(`https://wa.me/${phoneNumber}?text=${message}`);
      });

      console.log(`Invoice saved as JPG: ${jpgPath}`);
    }).catch(error => {
      console.error('Failed to retrieve WhatsApp number:', error);
    });
  }).catch(error => {
    console.error('Failed to generate JPG:', error);
  });
}


module.exports = {convertToJPGAndOpenWhatsApp, convertToJPG};
