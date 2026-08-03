const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const HelpRequest = require('./models/HelpRequest');

dotenv.config();

// ─── Demo Users ────────────────────────────────────────────────────────────
const usersData = [
  {
    name: "Admin User",
    email: "admin@agewell.com",
    password: "adminpassword",
    role: "admin",
    phone: "555-0100",
    address: "AgeWell Headquarters, Suite 1"
  },
  {
    name: "Eleanor Vance",
    email: "eleanor@agewell.com",
    password: "seniorpassword",
    role: "senior",
    phone: "555-0155",
    address: "Apartment 4B, Pinecrest Retirement Village",
    emergencyContact: "Daughter: Clara Vance - 555-0199"
  },
  {
    name: "Arthur Pendelton",
    email: "arthur@agewell.com",
    password: "seniorpassword",
    role: "senior",
    phone: "555-0122",
    address: "88 Maple Avenue, Sunnyvale",
    emergencyContact: "Neighbor: Mark - 555-0211"
  },
  {
    name: "Sarah Connor",
    email: "sarah@agewell.com",
    password: "volunteerpassword",
    role: "volunteer",
    phone: "555-0188",
    address: "123 Elm Street",
    skills: ["Grocery Shopping", "Tech Support", "Companionship"]
  },
  {
    name: "David Beckham",
    email: "david@agewell.com",
    password: "volunteerpassword",
    role: "volunteer",
    phone: "555-0144",
    address: "52 Chelsea Road",
    skills: ["Medical Escort", "Housekeeping"]
  }
  // Note: Clara Vance (family member) is added after senior Eleanor is created,
  // because we need Eleanor's _id to set the linkedSenior reference.
];

// ─── Seed ──────────────────────────────────────────────────────────────────
const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/agewell');
    console.log('Database connected for seeding...');

    // Clear existing data
    await User.deleteMany();
    await HelpRequest.deleteMany();
    console.log('Cleared existing records.');

    // Insert initial users
    const createdUsers = [];
    for (const u of usersData) {
      const user = await User.create(u);
      createdUsers.push(user);
    }
    console.log(`Created ${createdUsers.length} base users.`);

    const eleanor = createdUsers.find(u => u.email === 'eleanor@agewell.com');
    const arthur  = createdUsers.find(u => u.email === 'arthur@agewell.com');
    const sarah   = createdUsers.find(u => u.email === 'sarah@agewell.com');
    const david   = createdUsers.find(u => u.email === 'david@agewell.com');

    // Add family/caregiver accounts linked to seniors
    const clara = await User.create({
      name: "Clara Vance",
      email: "clara@agewell.com",
      password: "familypassword",
      role: "family",
      phone: "555-0199",
      address: "72 Pinecrest Drive",
      linkedSenior: eleanor._id,
      relationship: "Daughter"
    });
    console.log(`Created family caregiver: ${clara.name} (linked to ${eleanor.name})`);

    const robertPendelton = await User.create({
      name: "Robert Pendelton",
      email: "robert@agewell.com",
      password: "familypassword",
      role: "family",
      phone: "555-0230",
      address: "16 Birchwood Lane",
      linkedSenior: arthur._id,
      relationship: "Son"
    });
    console.log(`Created family caregiver: ${robertPendelton.name} (linked to ${arthur.name})`);

    // ─── Sample Requests ──────────────────────────────────────────────────
    const sampleRequests = [
      // Eleanor's requests (she has a caregiver linked, so volunteers' acceptance will need family approval)
      {
        title: "Need help fetching fresh milk and bread",
        description: "Looking for someone who could stop by the local grocery store on their way and help me get a gallon of whole milk and a loaf of whole wheat bread. Thank you!",
        category: "Grocery Shopping",
        urgency: "low",
        status: "pending",
        senior: eleanor._id
      },
      {
        title: "Help setting up medical tablet screen",
        description: "My doctor sent me a new monitor screen for my blood pressure, but the Bluetooth is not pairing with my tablet. I would appreciate some tech support to configure it.",
        category: "Tech Support",
        urgency: "medium",
        status: "awaiting_approval",     // Sarah accepted, but Clara must approve
        senior: eleanor._id,
        volunteer: sarah._id,
        familyApprovalStatus: "none"
      },
      // Arthur's requests (he also has Robert as caregiver)
      {
        title: "Companionship for afternoon chat",
        description: "I am feeling a bit lonely today and would love to have a friendly volunteer stop by for a cup of tea and a pleasant conversation for an hour or so.",
        category: "Companionship",
        urgency: "low",
        status: "accepted",              // Robert approved this one
        senior: arthur._id,
        volunteer: sarah._id,
        familyApprovalStatus: "approved",
        familyReviewedBy: robertPendelton._id,
        familyReviewedAt: new Date(Date.now() - 3600000),
        acceptedAt: new Date(Date.now() - 3600000)
      },
      {
        title: "Urgent medicine collection from clinic",
        description: "I need my prescription picked up from the pharmacy today. My joints are hurting quite bad and I cannot walk in this cold rain.",
        category: "Medical Escort",
        urgency: "high",
        status: "completed",
        senior: arthur._id,
        volunteer: david._id,
        familyApprovalStatus: "approved",
        familyReviewedBy: robertPendelton._id,
        familyReviewedAt: new Date(Date.now() - 7200000),
        acceptedAt: new Date(Date.now() - 7200000),
        completedAt: new Date(Date.now() - 3600000),
        resolutionNotes: "Picked up Arthur's medicines from the pharmacy and delivered them safely to his door. He was very grateful!"
      }
    ];

    await HelpRequest.insertMany(sampleRequests);
    console.log('Successfully seeded sample help requests.');

    console.log('\n=== Seeding Completed Successfully! ===');
    console.log('\nDemo Accounts:');
    console.log('  👵 Senior:    eleanor@agewell.com / seniorpassword');
    console.log('  👴 Senior:    arthur@agewell.com  / seniorpassword');
    console.log('  🤝 Volunteer: sarah@agewell.com   / volunteerpassword');
    console.log('  🤝 Volunteer: david@agewell.com   / volunteerpassword');
    console.log('  ❤️  Family:    clara@agewell.com   / familypassword (linked to Eleanor)');
    console.log('  ❤️  Family:    robert@agewell.com  / familypassword (linked to Arthur)');
    console.log('  🛡️  Admin:     admin@agewell.com   / adminpassword');
    console.log('\nWorkflow demo:');
    console.log('  → eleanor\'s "Tech Support" request is at awaiting_approval.');
    console.log('  → Login as Clara to approve/reject Sarah as the volunteer.');

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDB();
