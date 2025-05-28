const crypto = require('crypto');
const fs = require('fs');

const algorithm = 'aes-256-cbc';
const key = crypto.createHash('sha256').update('mobi_secret_key').digest();  
const iv = Buffer.alloc(16, 0);


function encrypt(text) {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('hex');
}

function decrypt(encryptedHex) {
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function writeEncryptedDbFile(filePath, jsonObject) {
    const encrypted = encrypt(JSON.stringify(jsonObject));
    fs.writeFileSync(filePath, encrypted, 'utf8');
}

function readEncryptedDbFile(filePath) {
    const encrypted = fs.readFileSync(filePath, 'utf8');
    const decryptedJson = decrypt(encrypted);
    return JSON.parse(decryptedJson);
}

module.exports = {
    encrypt,
    decrypt,
    writeEncryptedDbFile,
    readEncryptedDbFile
};
