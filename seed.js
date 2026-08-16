const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const HelpRequest = require('./models/HelpRequest');

dotenv.config();

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agewell');
    console.log('Database connected for seeding...');

    // Delete all users except riya, avdhut, soham, and admin
    await User.deleteMany({
      $and: [
        { name: { $nin: [/riya/i, /avdhut/i, /soham/i, /admin/i] } },
        { email: { $nin: [/riya/i, /avdhut/i, /soham/i, /admin/i] } }
      ]
    });
    
    // Clear all help requests since they belong to deleted test users
    await HelpRequest.deleteMany();
    console.log('Cleared all other test users and help requests.');

    // Ensure Admin User exists
    let admin = await User.findOne({ email: 'admin@agewell.com' });
    if (!admin) {
      admin = await User.create({
        name: "Admin User",
        email: "admin@agewell.com",
        password: "adminpassword",
        role: "admin",
        phone: "555-0100",
        address: "AgeWell Headquarters, Suite 1"
      });
      console.log('Created Admin User.');
    } else {
      console.log('Admin User already exists.');
    }

    // Ensure Senior Avdhut Giri exists
    let avdhut = await User.findOne({ email: 'avdhut@gmail.com' });
    if (!avdhut) {
      avdhut = await User.create({
        name: 'Avdhut Giri',
        email: 'avdhut@gmail.com',
        password: 'seniorpassword',
        role: 'senior',
        phone: '1111111111',
        address: 'Shaniwarwada',
        emergencyContact: 'Soham Giri- 9999999999'
      });
      console.log('Created Senior Avdhut Giri.');
    } else {
      console.log('Senior Avdhut Giri already exists.');
    }

    // Ensure Caregiver Soham Giri exists
    let soham = await User.findOne({ email: 'soham@gmail.com' });
    if (!soham) {
      soham = await User.create({
        name: 'Soham Giri',
        email: 'soham@gmail.com',
        password: 'familypassword',
        role: 'family',
        phone: '9999999999',
        address: 'Shaniwarwada',
        relationship: 'Son',
        linkedSenior: avdhut._id
      });
      console.log('Created Caregiver Soham Giri.');
    } else {
      console.log('Caregiver Soham Giri already exists.');
    }

    // Ensure Volunteer Riya Gandhi exists
    let riya = await User.findOne({ email: 'riya@gmail.com' });
    if (!riya) {
      riya = await User.create({
        name: 'Riya Gandhi',
        email: 'riya@gmail.com',
        password: 'volunteerpassword',
        role: 'volunteer',
        phone: '5555555555',
        address: 'Satara Road',
        skills: ['Grocery Shopping', 'Medical Escort', 'Housekeeping', 'Companionship'],
        aadhaarNumber: '1234 5678 9012',
        isIdVerified: true,
        isPoliceVerified: true,
        verificationStatus: 'verified'
      });
      console.log('Created Volunteer Riya Gandhi.');
    } else {
      console.log('Volunteer Riya Gandhi already exists.');
    }

    console.log('\n=== Seeding Completed Successfully! ===');
    console.log('\nPreserved Accounts:');
    console.log('  🛡️  Admin:     admin@agewell.com / adminpassword');
    console.log('  👵  Senior:    avdhut@gmail.com / seniorpassword');
    console.log('  ❤️  Caregiver: soham@gmail.com / familypassword');
    console.log('  🙋  Volunteer: riya@gmail.com / volunteerpassword');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDB();
