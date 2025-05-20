// helpers/menuHelper.js

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
  