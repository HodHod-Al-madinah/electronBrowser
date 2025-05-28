const { dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');


function convertToPDF(mainWindow) {
  const pdfPath = path.join(__dirname, '../output.pdf'); 
  
  mainWindow.webContents.printToPDF({
    marginsType: 0,  
    printBackground: true,
    pageSize: 'A4',
  }).then(data => {
    fs.writeFileSync(pdfPath, data);

    dialog.showMessageBox(mainWindow, {
      message: 'PDF created successfully!',
      detail: `PDF saved to: ${pdfPath}`
    });
    
  }).catch(error => {
    console.error('Failed to generate PDF:', error);
  });
}

module.exports = { convertToPDF };
