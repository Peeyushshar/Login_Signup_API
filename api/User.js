
const express = require('express');
const router = express.Router();
const User = require('./../models/User');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const uuid = require('node-uuid');
const OTP = require('../models/OTP');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');


AWS.config.update({
  accessKeyId: process.env.accessKeyId,
  secretAccessKey: process.env.secretAccessKey,
  region: 'ap-south-1', 
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();
router.use(bodyParser.json());


const generateRandomUserID = () => {
  return uuid.v4();
};

const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'professordixit424@gmail.com',
    pass: 'zyco loxx xeag xdsr'
  }
});



// Function to send an OTP via email
function sendEmailVerification(userEmail, otp) {
  const mailOptions = {
    from: 'professordixit424@gmail.com',
    to: userEmail,
    subject: 'Email Verification OTP',
    text: `Your verification OTP is: ${otp}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Error sending email: ' + error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}



// Function to verify OTP
async function verifyOTP(userEmail, userOTP) {
  try {
    const latestOTP = await OTP.findOne({ email: userEmail, verified: false }).sort({ created_at: -1 });

    if (!latestOTP) {
      console.log('No valid OTP found.');
      return false;
    }

    const currentTime = new Date();
    const otpTime = new Date(latestOTP.created_at);

    if (currentTime - otpTime > 10 * 60 * 1000) {
      console.log('OTP has expired.');
      return false; // OTP is expired
    }

    if (latestOTP.otp === userOTP) {
      latestOTP.verified = true;
      await latestOTP.save();
      console.log('OTP is valid.');

      const userUpdate = await User.updateOne({ email: userEmail }, { emailVerified: true });
      // console.log('User update result:', userUpdate);
      
      return true;
    }

    console.log('OTP does not match the user input.');
  } catch (err) {
    console.error('Error during OTP verification:', err);
  }

  return false;
}




// Sign-up route
router.post('/signup', async (req, res) => {
  let { name, email, password, dateOfBirth } = req.body;
  name = name.trim();
  email = email.trim();
  password = password.trim();
  dateOfBirth = dateOfBirth.trim();

  if (name === "" || email === "" || password === "" || dateOfBirth === "") {
    return res.status(400).json({
      status: "FAILED",
      message: "Empty input field"
    });
  } else if (!/^[a-zA-Z ]*$/.test(name)) {
    return res.status(400).json({
      status: "FAILED",
      message: "Invalid name entered"
    });
  } else if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
    return res.status(400).json({
      status: "FAILED",
      message: "Invalid email entered"
    });
  } else if (!new Date(dateOfBirth).getTime()) {
    return res.status(400).json({
      status: "FAILED",
      message: "Invalid date of birth entered"
    });
  } else if (password.length < 8) {
    return res.status(400).json({
      status: "FAILED",
      message: "Password is too short!"
    });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        status: "FAILED",
        message: "User with the provided email already exists"
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const userID = generateRandomUserID();

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      dateOfBirth,
      userID,
      emailVerified: false // Add this line
    });
    await newUser.save();
    return res.status(200).json({
      status: "SUCCESS",
      message: "Signup successful",
      // data: { userID: newUser.userID }
    });
  } catch (error) {
    console.error('Error during user signup:', error);
    return res.status(500).json({
      status: "FAILED",
      message: "An error occurred while saving user account!"
    });
  }
});




// Sign-in route
router.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      status: "FAILED",
      message: "Empty credentials supplied"
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        status: 'FAILED',
        message: 'User not found. Please sign up and verify your email first.',
      });
    }

    if (!user.emailVerified) {
      return res.status(401).json({
        status: 'FAILED',
        message: 'Email not verified. Please verify your email before signing in.',
      });
    }

    const hashedPassword = user.password;
    const isPasswordValid = await bcrypt.compare(password, hashedPassword);
    if (isPasswordValid) {
      return res.status(200).json({
        status: "SUCCESS",
        message: "Signin successful",
        data: {
          userID: user.userID,
          name: user.name
        }
      });
    } else {
      return res.status(401).json({
        status: "FAILED",
        message: "Invalid password entered"
      });
    }
  } catch (error) {
    console.error('Error during user sign-in:', error);
    return res.status(500).json({
      status: "FAILED",
      message: "An error occurred while checking user credentials"
    });
  }
});




// Define the route for sending OTP via email
router.post('/sendOtp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      status: 'FAILED',
      message: 'Email address is required'
    });
  }
  const userExists = await User.findOne({ email });
  if (!userExists) {
    return res.status(400).json({
      status: 'FAILED',
      message: 'User with the provided email does not exist. Please sign up first.'
    });
  }
  const otp = uuid.v4().substr(0, 6);
  console.log('Generated OTP:', otp);

  const otpDoc = new OTP({ email, otp, verified: false });

  console.log('OTP Document to be saved:', otpDoc);
  try {
    await otpDoc.save();
    sendEmailVerification(email, otp);
    return res.status(200).json({
      status: 'SUCCESS',
      message: 'OTP sent to the provided email address',
      // data: { otp }
    });
  } catch (error) {
    console.error('Error saving OTP to the database:', error);
    return res.status(500).json({
      status: 'FAILED',
      message: 'An error occurred while saving the OTP in the database'
    });
  }
});




// Define the route for verifying OTP sent via email
router.post('/verifyOtp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      status: 'FAILED',
      message: 'Email and OTP are required for verification'
    });
  }

  const isVerified = await verifyOTP(email, otp);
  if (isVerified) {
    await User.updateOne({ email }, { emailVerified: true });

    return res.status(200).json({
      status: 'SUCCESS',
      message: 'OTP is valid, email verified'
    });
  } else {
    return res.status(401).json({
      status: 'FAILED',
      message: 'Invalid or expired OTP'
    });
  }
});




//  Request Password Reset - API Endpoint
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "Email not found" });
  }

  const otp = uuid.v4().substr(0, 6);
  // console.log('Generated OTP:', otp);

  // Calculate OTP expiry time (5 minutes from now)
  const expiryTime = new Date();
  expiryTime.setMinutes(expiryTime.getMinutes() + 5);

  // console.log('OTP Expiry Time:', expiryTime);

  const otpDoc = new OTP({ email, otp, verified: false, expiry: expiryTime });

  console.log('OTP Document to be saved:', otpDoc);
  try {
    await otpDoc.save();

    sendEmailVerification(email, otp);
    return res.status(200).json({
      status: 'SUCCESS',
      message: 'OTP sent to your email address',
    });
  } catch (error) {
    console.error('Error saving OTP to the database:', error);
    return res.status(500).json({
      status: 'FAILED',
      message: 'An error occurred while saving the OTP in the database'
    });
  }
});




//  Update Password - API Endpoint
router.post('/reset-password', async (req, res) => {
  const { email, password, otp } = req.body;
  const isValidOTP = await verifyOTP(email, otp);

  if (!isValidOTP) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  await User.updateOne({ email }, { password: hashedPassword });

  return res.status(200).json({ message: "Password reset successful" });
});


router.post('/sendURL', (req, res) => {
  const userId = req.body.userId;
  const url = req.body.url;
  const title = req.body.title;
  const tags = req.body.tags;
  const category = req.body.category;
  const actorNames = req.body.actorNames;
  
  const params = {
    userId,
    url,
    title,
    tags,
    category,
    actorNames
  };

  const data = axios.post(' https://x97scyi0sl.execute-api.ap-south-1.amazonaws.com/urlDownloader', params);

  res.status(200).json({
    message: "Your video is uploaded and is in processing",
    status:"Pending"
  });
  
});




router.post('/get-dynamodb-data', (req, res) => {
  // Get the userId and url from the request body
  const { userId, url } = req.body;

  // Check if both userId and url are provided
  if (!userId || !url) {
    return res.status(400).json({ message: 'userId and url parameters are required' });
  }

  // Define the parameters for the DynamoDB scan
  const params = {
    TableName: 'videoDownloadTable',
    FilterExpression: 'userId = :uid and #url = :videoUrl',
    ExpressionAttributeValues: {
      ':uid': userId,
      ':videoUrl': url,
    },
    ExpressionAttributeNames: { '#url': 'url' },
  };

  dynamoDB.scan(params, (err, data) => {
    if (err) {
      console.error('Error fetching data from DynamoDB:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      const items = data.Items;

      if (items.length === 0) {
        res.status(404).json({ message: 'Data not found' });
      } else {
        res.status(200).json(items[0]);
      }
    }
  });
});



// router.get('/get-dynamodb-data', (req, res) => {
//   // Get the userId from the query parameters
//   const userId = req.query.userId;

//   // Check if the userId is provided
//   if (!userId) {
//     return res.status(400).json({ message: 'userId parameter is required' });
//   }

//   // Define the parameters for the DynamoDB query
//   const params = {
//     TableName: 'videoDownloadTable',
//     KeyConditionExpression: 'userId = :uid',
//     ExpressionAttributeValues: {
//       ':uid': userId,
//     },
//   };

//   dynamoDB.query(params, (err, data) => {
//     if (err) {
//       console.error('Error fetching data from DynamoDB:', err);
//       res.status(500).json({ error: 'Internal Server Error' });
//     } else {
//       const items = data.Items;

//       if (items.length === 0) {
//         res.status(404).json({ message: 'Data not found' });
//       } else {
//         res.status(200).json(items[0]);
//       }
//     }
//   });
// });




module.exports = router;
