const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');

// Function to convert the current page to PDF
function convertToPDF(window) {

  const timestamp = Date.now(); 
    const pdfPath = path.join(__dirname, `../attachment/${timestamp}.pdf`);
    
  window.webContents.printToPDF({
    marginsType: 50,  // 1 = Custom margins
    printBackground: true,
    pageSize: 'A4',
  }).then(data => {
    fs.writeFileSync(pdfPath, data);
    dialog.showMessageBox(window, {
      message: 'PDF created successfully!',
      // detail: `PDF saved to: ${pdfPath}`
    });
  }).catch(error => {
    console.error('Failed to generate PDF:', error);
  });
}

module.exports = { convertToPDF };
