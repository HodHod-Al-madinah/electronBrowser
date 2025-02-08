const si = require('systeminformation');

// Function to retrieve BIOS data
async function getBiosData() {
  try {
    const networkData = await si.networkInterfaces();
    const macAddress = networkData.find(interface => interface.interface === 'eth0').mac;
    return macAddress;
  } catch (error) {
    console.error('Error retrieving BIOS data:', error);
    return null;
  }
}

module.exports = { getBiosData };
