const { BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

function printInvoiceWindow(invoiceWindow, scaleFactor) {
  console.log("small");
  invoiceWindow.webContents.print({
    silent: true,            
    printBackground: true,   
    margins: {
      marginType: 'custom',
      top: 0,
      bottom: 0,
      left: 30,
      right: 0
    },
    landscape: false,
    pageSize: {
      width: 80 * 1000,
      height: 297000
    },
    scaleFactor: scaleFactor  
  }, (success, errorType) => {
    if (!success) {
      console.error('Print failed: ', errorType);
    } else {
      console.log('Print successful!');
    }
    invoiceWindow.close();  
  });
}

function printInvoiceWindowA4(invoiceWindow, scaleFactor) {
  console.log("A4 - Generating PDF");

  // Define the path to save the PDF file
  const pdfPath = path.join(__dirname, '../output.pdf'); // Adjust this path as needed

  // Generate the PDF
  invoiceWindow.webContents.printToPDF({
    marginsType: 0, // No margins
    printBackground: true,
    pageSize: 'A4',
    landscape: false,
    scaleFactor: scaleFactor
  })
    .then((data) => {
      // Save the PDF file
      fs.writeFileSync(pdfPath, data);

      // Show success dialog
      dialog.showMessageBox(invoiceWindow, {
        type: 'info',
        title: 'PDF Created',
        message: 'PDF created successfully!',
        detail: `PDF saved to: ${pdfPath}`,
        buttons: ['OK']
      }).then(() => {
        console.log(`PDF successfully saved to: ${pdfPath}`);
        invoiceWindow.close(); // Close the window after the dialog is dismissed
      });
    })
    .catch((error) => {
      console.error('Failed to generate PDF: ', error);
      dialog.showErrorBox('PDF Generation Failed', `An error occurred: ${error.message}`);
      invoiceWindow.close(); // Close the window even if there's an error
    });
}

module.exports = { printInvoiceWindow, printInvoiceWindowA4 };