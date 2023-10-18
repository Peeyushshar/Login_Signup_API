var AWS = require('aws-sdk');
require('dotenv').config();
const mongoose = require('mongoose');

AWS.config.update({
    accessKeyId: process.env.accessKeyId,
    secretAccessKey: process.env.secretAccessKey,
    region: process.env.region,
    endpoint: process.env.endpoint,
});

const db = new AWS.DynamoDB.DocumentClient({convertEmptyValues: true});

module.exports = db;


mongoose.connect(process.env.MONGODB_URI, {useNewUrlParser: true, useUnifiedTopology: true}).then(()=>{
    console.log("DB Connected");
}).catch((err)=> console.log(err));