// utils/mailer.js

const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `HousePlanFiles <${process.env.SMTP_FROM_EMAIL}>`,
    to: options.to, 
    subject: options.subject, 
    html: options.html, 
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendEmail };
