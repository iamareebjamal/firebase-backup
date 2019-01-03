const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
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

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://amu-roboclub.firebaseio.com"
    });
    
    const db = admin.database();
    const ref = db.ref("/");
    return ref.once("value");
}

async function saveDatabase() {
    const database = (await downloadDatabase()).val();
    const serialized = JSON.stringify(database);

    return writeFileAsync(path.resolve(__dirname, 'backups/backup.json'), serialized);
}

saveDatabase()
    .then(process.exit)
    .catch(console.error);
