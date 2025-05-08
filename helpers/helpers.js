module.exports = {
    getWMICInfo: require('./biosHelper').getWMICInfo,
    convertToPDF: require('./pdfHelper').convertToPDF,
    convertToJPG: require('./jpgHelper').convertToJPG,
    promptForScaleFactor: require('./scaleHelper').promptForScaleFactor,
    printInvoiceWindow: require('./printHelper').printInvoiceWindow,
    printInvoiceWindowA4: require('./printHelper').printInvoiceWindowA4,
    buildInvoiceMenu: require('./menuHelper').buildInvoiceMenu,
};
