'use strict'
const express = require('express');
const app = express();
const exec = require('child_process').exec;
const nodemailer = require('nodemailer');
const authConfig = require(__dirname + '/.data/auth.json');
const cron = require('cron');

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

// set up cron job to send M-F at 10am
let storageNotify = new cron.CronJob({
  cronTime: '00 00 10 * * 1-5',
  onTick: function() {

    // cli command to ssh into remote server and get storage info for specific mountpoint
    execute('ssh islandora "df -h | grep -oP \'/dev/nvme1n1.*\'"', function(output) {

      // split output into array for setting up email message
      let storage = output.split(' ');
      let total = storage[4];
      let used = storage[6];
      let available = storage[8];
      let percentage = storage[10]; 

      // convert available storage to number and divide by two to get approximate upload availability
      // regex to extract numbers only and divide by two
      let uploadRaw = parseInt(available.replace(/\D+/g, '')) / 2;
      // round result to two places
      let uploadAvailable = Number(Math.round(uploadRaw + 'e2') + 'e-2');
      // regex to extract storage units
      let uploadAppend = available.replace(/[0-9]/g, '');
      // construct message string
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
