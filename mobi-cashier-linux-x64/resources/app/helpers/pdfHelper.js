const { dialog, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

// Function to convert the current page to PDF
function convertToPDF(mainWindow) {
  const pdfPath = path.join(__dirname, '../output.pdf');  // Path to save the PDF file
  
  mainWindow.webContents.printToPDF({
    marginsType: 1,  // 1 = Custom margins
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
