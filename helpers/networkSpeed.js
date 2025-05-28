const FastSpeedtest = require("fast-speedtest-api");

const speedtest = new FastSpeedtest({
    token: "YXNkZmFzZGxmbnNkYWZoYXNkZmhrYWxm",  
    verbose: false,
    timeout: 10000,
    https: true,
    urlCount: 5,
    bufferSize: 8,
    unit: FastSpeedtest.UNITS.Mbps
});

async function checkNetworkSpeed() {
    try {
        const download = await speedtest.getSpeed();
        return { download, upload: 'N/A', ping: 'N/A' };
    } catch (err) {
        console.error("❌ Speed test failed:", err.message);
        return null;
    }
}

module.exports = { checkNetworkSpeed };
