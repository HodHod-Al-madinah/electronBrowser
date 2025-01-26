
const { BrowserWindow } = require('electron');

// Function to print a window silently with specific options
function printInvoiceWindow(invoiceWindow, scaleFactor) {
  invoiceWindow.webContents.print({
    silent: true,            // Silent printing, no dialog shown
    printBackground: true,    // Include background graphics
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
    scaleFactor: scaleFactor  // Apply the user-defined scale factor
  }, (success, errorType) => {
    if (!success) {
      console.error('Print failed: ', errorType);
    } else {
      console.log('Print successful!');
    }
    invoiceWindow.close();  // Close the invoice window after printing
  });
}

module.exports = { printInvoiceWindow };
