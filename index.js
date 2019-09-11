const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const Readable = require('stream').Readable;
const uuid = require('uuid');
const admin = require("firebase-admin");

require('dotenv').config();

async function getConfig() {
    const directJson = process.env.SERVICE_ACCOUNT_JSON;
    if (directJson) {
        return directJson;
    }

    const jsonPath = process.env.SERVICE_ACCOUNT_JSON_PATH || path.resolve(__dirname, 'service-account.json');

    return readFileAsync(jsonPath, 'utf-8');
}

async function downloadDatabase() {
    const serviceAccount = JSON.parse(await getConfig());

    const databaseURL = `https://${serviceAccount.project_id}.firebaseio.com`;
    const storageBucket = `${serviceAccount.project_id}.appspot.com`;

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL,
      storageBucket
    });
    
    const db = admin.database();
    const ref = db.ref("/");
    return (await ref.once("value")).val();
}

async function saveOnDisk(fileName, content) {
    return await writeFileAsync(path.resolve(__dirname, fileName), content);
}

async function saveOnCloud(fileName, content) {
    const bucket = admin.storage().bucket();

    await new Promise((resolve, reject) => {
        const writeStream = bucket
          .file(fileName)
          .createWriteStream({
            private: true,
            metadata: {
              contentType: 'text/plain',
            },
          })
  
        writeStream.on('finish', resolve).on('error', reject);
  
        const readStream = new Readable();
        readStream._read = () => {}; // Workaround https://stackoverflow.com/a/22085851/3309666
        readStream.push(content);
        readStream.push(null);
  
        readStream.on('error', reject);
        readStream.pipe(writeStream);
      });
}

async function saveDatabase() {
    const database = await downloadDatabase();
    const serialized = JSON.stringify(database, null, 2);

    const date = new Date().toISOString();
    const backupFile = `backups/backup_${ date }_${ uuid.v4() }.json`;

    return await (process.env.STORE_ON_CLOUD ? saveOnCloud : saveOnDisk)(backupFile, serialized);
}

saveDatabase()
    .then(process.exit)
    .catch(console.error);
