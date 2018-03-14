'use strict'
const express = require('express');
const app = express();
const exec = require('child_process').exec;
const nodemailer = require('nodemailer');
const authConfig = require(__dirname + '/.data/auth.json');
const cron = require('cron');

function execute(command, callback){
  exec(command, function(error, stdout, stderr){ callback(stdout); });
};

function sendMail(message) {
  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      type: 'OAuth2',
      user: authConfig.EMAIL, 
      clientId: authConfig.CLIENT_ID,
      clientSecret: authConfig.CLIENT_SECRET,
      refreshToken: authConfig.REFRESH_TOKEN,
      accessToken: authConfig.ACCESS_TOKEN,
      expires: authConfig.EXPIRES
    }
  });


  let mailOptions = {
    from: process.env.FROM_EMAIL, 
    to: process.env.TO_EMAIL1, 
    cc: `${process.env.CC_EMAIL1},${process.env.CC_EMAIL2}`, 
    subject: 'Islandora Storage Availability',
    text: message
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if(error) return console.log(error);
    console.log('Message sent: %s', info.messageId);
  });
}

let storageNotify = new cron.CronJob({
  cronTime: '00 00 10 * * 1-5',
  onTick: function() {
  execute('ssh islandora "df -h | grep -oP \'/dev/nvme1n1.*\'"', function(output) {
    let storage = output.split(' ');
    let total = storage[4];
    let used = storage[6];
    let available = storage[8];
    let percentage = storage[10]; 
    let uploadRaw = parseInt(available.replace(/\D+/g, '')) / 2;
    let uploadAvailable = Number(Math.round(uploadRaw + 'e2') + 'e-2');
    let uploadAppend = available.replace(/[0-9]/g, '');
    let message = `Total storage: ${total}\nUsed: ${used}\nAvailable: ${available}\nUpload Limit: ${uploadAvailable}${uploadAppend}`;
    sendMail(message);
  });
  },
  start: false,
  timeZone: 'America/New_York'
});
  
 storageNotify.start();
 console.log('storage notification running', storageNotify.running);

const listener = app.listen(process.env.PORT, function() {
  console.log('Listening on port: ' + listener.address().port);
});
