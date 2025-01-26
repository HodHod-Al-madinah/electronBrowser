// helpers/menuHelper.js

// Function to build the invoice menu with options to convert to PDF, JPG, and set scale factor
function buildInvoiceMenu(convertToPDF, convertToJPG, promptForScaleFactor, window) {
    return [
      {
        label: '📄 Convert to PDF',
        click: () => convertToPDF(window)
      },
      {
        label: '🖼️ Convert to JPG',
        click: () => convertToJPG(window)
      },
      {
        label: '📏 Set Scale Factor',
        click: () => promptForScaleFactor(window)
      }
    ];
  }
  
  module.exports = { buildInvoiceMenu };
  