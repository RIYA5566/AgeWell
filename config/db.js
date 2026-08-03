const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agewell');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.error('Please ensure MongoDB is running locally on 127.0.0.1:27017 or provide a valid MONGODB_URI in your .env file.');
    // Exit process with failure
    process.exit(1);
  }
};

module.exports = connectDB;
