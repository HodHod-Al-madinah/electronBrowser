const { exec } = require('child_process');
const { dialog } = require('electron');
const util = require('util');

const execPromise = util.promisify(exec);

async function showAndSetDefaultPrinter(mainWindow) {
    try {

        const listCommand = 'powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"';
        const { stdout: allPrintersOut } = await execPromise(listCommand, { encoding: 'utf8' });

        const printers = allPrintersOut
            .split('\n')
            .map(printer => printer.trim())
            .filter(printer =>
                printer.length > 0 &&
                !printer.toLowerCase().includes('onenote') &&
                !printer.toLowerCase().includes('fax') &&
                !printer.toLowerCase().includes('xps')
            );



        if (printers.length === 0) {
            await dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'لم يتم العثور على طابعات',
                message: 'لا يوجد طابعات في الجهاز.',
                buttons: ['موافق'],
            });
            return 'No printers found';
        }


        const defaultCommand = `powershell -Command "(Get-CimInstance -ClassName Win32_Printer | Where-Object { $_.Default -eq $true }).Name"`;
        const { stdout: defaultOut } = await execPromise(defaultCommand, { encoding: 'utf8' });
        const defaultPrinter = defaultOut.trim();
        console.log("🖨️ Current default printer:", defaultPrinter);


        const labeledPrinters = printers.map(p =>
            p === defaultPrinter ? `✅ ${p}` : `🔲 ${p}`
        );

        const response = await dialog.showMessageBox(mainWindow, {
            type: 'question',
            title: 'اختيار الطابعة الافتراضية',
            message: 'اختر الطابعة التي تريد تعيينها كافتراضية',
            buttons: [...labeledPrinters, 'إلغاء'],
            cancelId: printers.length,
            defaultId: printers.indexOf(defaultPrinter),
        });

        const selectedIndex = response.response;
        if (selectedIndex === printers.length) {
            return 'تم الإلغاء';
        }

        const selectedPrinter = printers[selectedIndex];
        console.log("📋 Selected printer:", selectedPrinter);


        const setDefaultCommand = `powershell -Command "(New-Object -ComObject WScript.Network).SetDefaultPrinter('${selectedPrinter}')"`;
        console.log("🖨️ Running command:", setDefaultCommand);

        const { stdout: setOut, stderr: setErr } = await execPromise(setDefaultCommand);
        console.log("✅ Set printer stdout:", setOut);
        if (setErr) console.error("⚠️ Set printer stderr:", setErr);

        await dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'تم بنجاح',
            message: `تم تعيين الطابعة "${selectedPrinter}" كافتراضية.`,
            buttons: ['موافق'],
        });

        return selectedPrinter;
    } catch (error) {
        console.error('❌ خطأ في تعيين الطابعة:', error.message);
        await dialog.showMessageBox(mainWindow, {
            type: 'error',
            title: 'خطأ',
            message: 'حدث خطأ أثناء تعيين الطابعة. تأكد من تشغيل التطبيق كمسؤول والطابعة متاحة.',
            buttons: ['موافق'],
        });
        throw error;
    }
}

module.exports = {
    showAndSetDefaultPrinter,
};
