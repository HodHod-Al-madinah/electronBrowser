const si = require('systeminformation');

async function getWMICInfo() {
    try {
        const [system, baseboard, cpu] = await Promise.all([
            si.system(),
            si.baseboard(),
            si.cpu()
        ]);

        return {
            processorId: cpu?.vendor + "-" + cpu?.brand || 'unknown',
            uuid: system?.uuid || 'unknown',
            motherboardSerial: baseboard?.serial || 'unknown'
        };
    } catch (error) {
        console.error('❌ Failed to get system info:', error);
        return {
            processorId: 'unknown',
            uuid: 'unknown',
            motherboardSerial: 'unknown'
        };
    }
}

module.exports = { getWMICInfo };




// const si = require('systeminformation');

// async function getSystemInfo() {
//     try {
//         const cpuData = await si.cpu();
//         const systemData = await si.system();

//         return {
//             processorId: cpuData.cpuId, // ✅ Get Processor ID
//             uuid: systemData.uuid       // ✅ Get UUID
//         };
//     } catch (error) {
//         console.error('Error retrieving system information:', error);
//         return {
//             processorId: 'default-processorId',
//             uuid: 'default-uuid'
//         };
//     }
// }

// module.exports = { getSystemInfo };





// const si = require('systeminformation');

// // Function to retrieve BIOS data
// async function getBiosData() {
//   try {
//     const biosData = await si.bios(); // Fetch BIOS data
//     return biosData;
//   } catch (error) {
//     console.error('Error retrieving BIOS data:', error);
//     return null;
//   }
// }

// module.exports = { getBiosData };
