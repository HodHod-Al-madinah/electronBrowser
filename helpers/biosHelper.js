const si = require('systeminformation');

// Function to retrieve BIOS data
async function getBiosData() {
  try {
    const biosData = await si.bios(); // Fetch BIOS data
    return biosData;
  } catch (error) {
    console.error('Error retrieving BIOS data:', error);
    return null;
  }
}

module.exports = { getBiosData };
