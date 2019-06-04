'use strict'
const express = require('express');
const app = express();
const exec = require('child_process').exec;
const nodemailer = require('nodemailer');
const authConfig = require(__dirname + '/.data/auth.json');
const cron = require('cron');
const prettyBytes = require('pretty-bytes');

// function for running cli command on server
function execute(command, callback){
  exec(command, function(error, stdout, stderr){ callback(stdout); });
};

// function for setting up nodemailer and sending notification via gmail
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
    to: process.env.TO_EMAIL,
    cc: process.env.CC_EMAIL,
    subject: 'Islandora Storage Availability',
    text: message
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if(error) return console.log(error);
    console.log('Message sent: %s', info.messageId);
  });
}

// set up cron job to send M-F at 10am
let storageNotify = new cron.CronJob({
  cronTime: '00 00 10 * * 1-5',
  onTick: function() {

  // cli command to ssh into remote server and get storage info for specific mountpoint
  execute('ssh islandora "df -B1 | grep -oP \'/dev/nvme1n1.*\'"', function(output) {
    function subtractReserved(amount) {
      return amount - (amount * .05);
    }

    // split output into array for setting up email message
    let storage = output.split(/[ ]+/);
    let totalConvert = subtractReserved(parseInt(storage[1]));
    let usedConvert = subtractReserved(parseInt(storage[2]));
    let availableConvert = subtractReserved(parseInt(storage[3]));

    let total = prettyBytes(totalConvert);
    let used = prettyBytes(usedConvert);
    let available = prettyBytes(availableConvert);
    let percentage = storage[10]; 
    let uploadAvailable = prettyBytes(availableConvert / 2);
    // construct message string
    let message = `Total storage: ${total}\nUsed: ${used}\nAvailable: ${available}\nUpload Limit: ${uploadAvailable}`;
    sendMail(message);
  });
  },
  start: false,
  timeZone: 'America/New_York'
});
  
 storageNotify.start();
 console.log('storage notification running', storageNotify.running);
// });

const listener = app.listen(process.env.PORT, function() {
  console.log('Listening on port: ' + listener.address().port);
});
