const mongoose = require('mongoose');
// const Schema = mongoose.Schema;

// const otpSchema = mongoose.Schema({
//   email: String,
//   otp: String,
//   verified: Boolean,
//   created_at: { type: Date, default: Date.now }
// });

// const OTP = mongoose.model('OTP', otpSchema);

const otpSchema = new mongoose.Schema({
    email: String,
    otp: String,
    verified: Boolean,
    created_at: { type: Date, default: Date.now },
  });
  
  const OTP = mongoose.model('OTP', otpSchema, 'otps');
  

module.exports = OTP;
