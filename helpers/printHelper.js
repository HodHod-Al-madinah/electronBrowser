
const { BrowserWindow } = require('electron');

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
  console.log("A4");
  invoiceWindow.webContents.print({
    silent: true,
    printBackground: true,
    margins: {
      marginType: 'custom',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    },
    landscape: false,
    pageSize: 'A4',   
    scaleFactor: scaleFactor
  }, (success, errorType) => {
    if (!success) {
      console.error('A4 Print failed: ', errorType);
    } else {
      console.log('A4 Print successful!');
    }
    invoiceWindow.close();
  });
}

 module.exports = { printInvoiceWindow, printInvoiceWindowA4 };

