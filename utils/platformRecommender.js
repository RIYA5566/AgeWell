/**
 * AgeWell AI Platform Recommender & Pre-filled Search Link Generator
 * Powered by the Service Mapping Dataset (20 Categories)
 */

// User-provided Service Mapping Dataset
const serviceMapping = [
  {
    category: "Grocery",
    keywords: [
      "milk","bread","rice","wheat","atta","flour","oil","sugar","salt",
      "tea","coffee","biscuits","eggs","vegetables","fruits","banana",
      "apple","orange","tomato","potato","onion","dal","paneer",
      "curd","butter","cheese","groceries","ration","snacks"
    ],
    platforms: ["Blinkit", "Instamart", "Zepto", "BigBasket", "Amazon Fresh"]
  },
  {
    category: "Food Delivery",
    keywords: [
      "pizza","burger","paratha","aloo paratha","sandwich",
      "dosa","idli","biryani","meal","lunch","dinner","breakfast",
      "juice","coffee","tea","cake","ice cream","food","restaurant",
      "order food","thali","roll","noodles","fried rice"
    ],
    platforms: ["Swiggy", "Zomato", "EatSure"]
  },
  {
    category: "Medicine",
    keywords: [
      "medicine","tablet","capsule","crocin","paracetamol",
      "dolo","insulin","bp medicine","syrup","ointment",
      "bandage","first aid","thermometer","mask","sanitizer"
    ],
    platforms: ["Apollo 24|7", "PharmEasy", "Tata 1mg", "NetMeds"]
  },
  {
    category: "Doctor Appointment",
    keywords: [
      "doctor","appointment","hospital","clinic","physician",
      "cardiologist","orthopedic","dentist","eye doctor",
      "checkup","consultation"
    ],
    platforms: ["Practo", "Apollo 24|7", "MediBuddy"]
  },
  {
    category: "Transportation",
    keywords: [
      "cab","taxi","uber","ola","hospital visit",
      "ride","drop","pickup","travel","station","airport"
    ],
    platforms: ["Uber", "Ola", "Rapido"]
  },
  {
    category: "Emergency",
    keywords: [
      "emergency","ambulance","fell","fall",
      "pain","heart attack","breathing","accident",
      "unconscious","urgent","blood","emergency help"
    ],
    platforms: ["108 Ambulance", "Nearest Hospital", "Emergency Contacts"]
  },
  {
    category: "Bill Payment",
    keywords: [
      "electricity bill","water bill","gas bill",
      "recharge","mobile recharge","bill","payment",
      "internet bill","wifi bill","phone bill"
    ],
    platforms: ["Google Pay", "PhonePe", "Paytm", "BHIM"]
  },
  {
    category: "Banking",
    keywords: [
      "bank","withdraw money","deposit money",
      "atm","passbook","cheque","upi","net banking",
      "account","balance"
    ],
    platforms: ["Google Pay", "PhonePe", "Paytm", "Bank Website"]
  },
  {
    category: "Shopping",
    keywords: [
      "clothes","shirt","pants","shoes","watch",
      "blanket","pillow","utensils","kitchen",
      "home appliances","shopping","buy"
    ],
    platforms: ["Amazon", "Flipkart", "Myntra"]
  },
  {
    category: "Electronics",
    keywords: [
      "mobile","phone","laptop","charger",
      "headphones","tv","fan","fridge",
      "washing machine","electronics"
    ],
    platforms: ["Amazon", "Flipkart", "Croma", "Reliance Digital"]
  },
  {
    category: "Courier",
    keywords: [
      "parcel","courier","package","send documents",
      "delivery","post","speed post"
    ],
    platforms: ["India Post", "DTDC", "Blue Dart", "Delhivery"]
  },
  {
    category: "Home Services",
    keywords: [
      "electrician","plumber","carpenter",
      "cleaning","house cleaning","repair",
      "ac repair","painting","home service"
    ],
    platforms: ["Urban Company"]
  },
  {
    category: "Laundry",
    keywords: [
      "laundry","wash clothes","dry clean",
      "ironing","clean clothes"
    ],
    platforms: ["Tumbledry", "UC Laundry"]
  },
  {
    category: "Pet Care",
    keywords: [
      "dog food","cat food","pet","veterinary",
      "pet medicine","pet grooming"
    ],
    platforms: ["Heads Up For Tails", "Supertails"]
  },
  {
    category: "Flowers & Gifts",
    keywords: [
      "flowers","bouquet","gift","birthday gift",
      "anniversary","chocolates","cake"
    ],
    platforms: ["FNP", "IGP"]
  },
  {
    category: "Government Services",
    keywords: [
      "aadhar","pan card","passport",
      "pension","government office",
      "certificate","license"
    ],
    platforms: ["DigiLocker", "UMANG", "Official Government Portals"]
  },
  {
    category: "Travel Booking",
    keywords: [
      "train ticket","flight ticket",
      "hotel","bus","trip","travel booking"
    ],
    platforms: ["IRCTC", "MakeMyTrip", "Yatra", "Goibibo"]
  },
  {
    category: "Entertainment",
    keywords: [
      "movie","cinema","concert","show",
      "tickets","book ticket"
    ],
    platforms: ["BookMyShow"]
  },
  {
    category: "Communication",
    keywords: [
      "video call","call family","message",
      "chat","whatsapp","zoom","meet"
    ],
    platforms: ["WhatsApp", "Google Meet", "Zoom"]
  },
  {
    category: "Companionship",
    keywords: [
      "lonely","talk","conversation",
      "visit me","company","friend",
      "walk together"
    ],
    platforms: ["Assign Volunteer", "Notify Family"]
  }
];

// Fallback search terms if no specific product item was identified
const CATEGORY_DEFAULT_QUERIES = {
  "Grocery": "bread milk",
  "Food Delivery": "food",
  "Medicine": "medicine crocin",
  "Doctor Appointment": "doctor",
  "Transportation": "cab taxi",
  "Emergency": "hospital ambulance",
  "Bill Payment": "electricity bill",
  "Banking": "net banking",
  "Shopping": "clothes",
  "Electronics": "electronics charger",
  "Courier": "courier parcel",
  "Home Services": "repair cleaning",
  "Laundry": "laundry",
  "Pet Care": "pet food",
  "Flowers & Gifts": "flowers bouquet",
  "Government Services": "digilocker",
  "Travel Booking": "train ticket",
  "Entertainment": "movie tickets",
  "Communication": "whatsapp",
  "Companionship": "volunteer"
};

// Map platform names to metadata (Icon, Color, and Pre-filled URL Generator)
const PLATFORM_DETAILS = {
  "Blinkit": { icon: "⚡", color: "#f5c518", getUrl: q => `https://blinkit.com/s/?q=${encodeURIComponent(q)}` },
  "Instamart": { icon: "🛒", color: "#fc8019", getUrl: q => `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(q)}` },
  "Zepto": { icon: "💜", color: "#7b1fa2", getUrl: q => `https://www.zeptonow.com/search?q=${encodeURIComponent(q)}` },
  "BigBasket": { icon: "🧺", color: "#689f38", getUrl: q => `https://www.bigbasket.com/ps/?q=${encodeURIComponent(q)}` },
  "Amazon Fresh": { icon: "🥬", color: "#232f3e", getUrl: q => `https://www.amazon.in/s?k=${encodeURIComponent(q)}` },
  "Swiggy": { icon: "🍕", color: "#fc8019", getUrl: q => `https://www.swiggy.com/search?query=${encodeURIComponent(q)}` },
  "Zomato": { icon: "🔴", color: "#cb202d", getUrl: q => `https://www.zomato.com/search?q=${encodeURIComponent(q)}` },
  "EatSure": { icon: "🍲", color: "#ff4f00", getUrl: q => `https://www.eatsure.com/` },
  "Apollo 24|7": { icon: "🏥", color: "#005b9f", getUrl: q => `https://www.apollo247.com/search-medicines/${encodeURIComponent(q)}` },
  "PharmEasy": { icon: "💊", color: "#10847e", getUrl: q => `https://pharmeasy.in/search/all?name=${encodeURIComponent(q)}` },
  "Tata 1mg": { icon: "🧪", color: "#ff6f61", getUrl: q => `https://www.1mg.com/search/all?name=${encodeURIComponent(q)}` },
  "NetMeds": { icon: "🩹", color: "#24aeb1", getUrl: q => `https://www.netmeds.com/catalogsearch/result?q=${encodeURIComponent(q)}` },
  "Practo": { icon: "👨‍⚕️", color: "#28328c", getUrl: q => `https://www.practo.com/search?q=${encodeURIComponent(q)}` },
  "MediBuddy": { icon: "🩺", color: "#1a73e8", getUrl: q => `https://www.medibuddy.in/` },
  "Uber": { icon: "🚕", color: "#000000", getUrl: q => `https://m.uber.com/` },
  "Ola": { icon: "🚖", color: "#2bb673", getUrl: q => `https://book.olacabs.com/` },
  "Rapido": { icon: "🛵", color: "#f9a825", getUrl: q => `https://www.rapido.bike/` },
  "108 Ambulance": { icon: "🚨", color: "#d32f2f", getUrl: q => `tel:108` },
  "Nearest Hospital": { icon: "🏥", color: "#1976d2", getUrl: q => `https://www.google.com/maps/search/nearest+hospital` },
  "Emergency Contacts": { icon: "📞", color: "#c62828", getUrl: q => `tel:112` },
  "Google Pay": { icon: "💳", color: "#1a73e8", getUrl: q => `https://pay.google.com/` },
  "PhonePe": { icon: "🟣", color: "#5f259f", getUrl: q => `https://www.phonepe.com/` },
  "Paytm": { icon: "📲", color: "#00b9f1", getUrl: q => `https://paytm.com/` },
  "BHIM": { icon: "🇮🇳", color: "#003975", getUrl: q => `https://www.bhimupi.org.in/` },
  "Bank Website": { icon: "🏦", color: "#37474f", getUrl: q => `https://www.google.com/search?q=${encodeURIComponent(q)}+net+banking` },
  "Amazon": { icon: "📦", color: "#ff9900", getUrl: q => `https://www.amazon.in/s?k=${encodeURIComponent(q)}` },
  "Flipkart": { icon: "🛍️", color: "#2874f0", getUrl: q => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}` },
  "Myntra": { icon: "👗", color: "#ff3f6c", getUrl: q => `https://www.myntra.com/${encodeURIComponent(q)}` },
  "Croma": { icon: "💻", color: "#00a699", getUrl: q => `https://www.croma.com/searchB?q=${encodeURIComponent(q)}` },
  "Reliance Digital": { icon: "📱", color: "#e42529", getUrl: q => `https://www.reliancedigital.in/search?q=${encodeURIComponent(q)}` },
  "India Post": { icon: "📮", color: "#c62828", getUrl: q => `https://www.indiapost.gov.in/` },
  "DTDC": { icon: "📦", color: "#002d62", getUrl: q => `https://www.dtdc.in/` },
  "Blue Dart": { icon: "✈️", color: "#003399", getUrl: q => `https://www.bluedart.com/` },
  "Delhivery": { icon: "🚚", color: "#cc0000", getUrl: q => `https://www.delhivery.com/` },
  "Urban Company": { icon: "🛠️", color: "#222222", getUrl: q => `https://www.urbancompany.com/` },
  "Tumbledry": { icon: "🧺", color: "#00acc1", getUrl: q => `https://tumbledry.in/` },
  "UC Laundry": { icon: "🧼", color: "#3949ab", getUrl: q => `https://www.urbancompany.com/` },
  "Heads Up For Tails": { icon: "🐶", color: "#e91e63", getUrl: q => `https://headsupfortails.com/search?q=${encodeURIComponent(q)}` },
  "Supertails": { icon: "🐱", color: "#ff9800", getUrl: q => `https://supertails.com/search?q=${encodeURIComponent(q)}` },
  "FNP": { icon: "💐", color: "#4caf50", getUrl: q => `https://www.fnp.com/search?q=${encodeURIComponent(q)}` },
  "IGP": { icon: "🎁", color: "#e91e63", getUrl: q => `https://www.igp.com/search?q=${encodeURIComponent(q)}` },
  "DigiLocker": { icon: "🔒", color: "#1976d2", getUrl: q => `https://www.digilocker.gov.in/` },
  "UMANG": { icon: "🏛️", color: "#00838f", getUrl: q => `https://web.umang.gov.in/` },
  "Official Government Portals": { icon: "🇮🇳", color: "#2e7d32", getUrl: q => `https://www.india.gov.in/` },
  "IRCTC": { icon: "🚆", color: "#d32f2f", getUrl: q => `https://www.irctc.co.in/nget/train-search` },
  "MakeMyTrip": { icon: "✈️", color: "#eb2026", getUrl: q => `https://www.makemytrip.com/` },
  "Yatra": { icon: "🧳", color: "#ea232a", getUrl: q => `https://www.yatra.com/` },
  "Goibibo": { icon: "🏨", color: "#ec5b24", getUrl: q => `https://www.goibibo.com/` },
  "BookMyShow": { icon: "🎟️", color: "#e50914", getUrl: q => `https://in.bookmyshow.com/explore/home` },
  "WhatsApp": { icon: "💬", color: "#25d366", getUrl: q => `https://web.whatsapp.com/` },
  "Google Meet": { icon: "📹", color: "#00897b", getUrl: q => `https://meet.google.com/` },
  "Zoom": { icon: "🎥", color: "#2d8cff", getUrl: q => `https://zoom.us/` },
  "Assign Volunteer": { icon: "🤝", color: "#2e7d32", getUrl: q => `#` },
  "Notify Family": { icon: "❤️", color: "#c2185b", getUrl: q => `#` }
};

// Common filler/stop phrases to strip during item extraction
const FILLER_WORDS = [
  /\bplease\b/gi, /\bneed\b/gi, /\bhelp me\b/gi, /\bhelp\b/gi, /\bcan someone\b/gi,
  /\bbuy\b/gi, /\bget me\b/gi, /\bbring me\b/gi, /\bbring\b/gi, /\bget\b/gi, /\bwant\b/gi,
  /\bfor me\b/gi, /\bfrom store\b/gi, /\bfrom market\b/gi, /\bfrom shop\b/gi,
  /\burgent\b/gi, /\btoday\b/gi, /\bthanks\b/gi, /\bthank you\b/gi, /\bkindly\b/gi,
  /\bi need\b/gi, /\bi want\b/gi, /\bsomeone to\b/gi, /\bto buy\b/gi, /\bto get\b/gi
];

/**
 * Extract clean item query from request text (e.g. "bread, milk", "Crocin", "aloo paratha")
 * Guaranteed to NEVER output "Help Request - ..." or auto-generated titles
 */
function extractItemsQuery(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.trim();

  // 1. Aggressively strip auto-generated titles, dates, & emergency boilerplates
  cleaned = cleaned.replace(/Help Request\s*[-–—]?\s*\d{1,2}\s+\w+\s+\d{4}/gi, ' ');
  cleaned = cleaned.replace(/Help Request\s*[-–—]?\s*/gi, ' ');
  cleaned = cleaned.replace(/\bHelp Request\b/gi, ' ');
  cleaned = cleaned.replace(/\bEMERGENCY ALARM ACTIVE\b/gi, ' ');
  cleaned = cleaned.replace(/SOS triggered by Senior Citizen via dashboard\. Instant assistance required\./gi, ' ');
  cleaned = cleaned.replace(/\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/gi, ' ');

  // 2. Extract matched items/keywords from serviceMapping dataset
  const lowerText = cleaned.toLowerCase();
  const matchedKeywords = [];

  for (const service of serviceMapping) {
    for (const kw of service.keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerText) && !matchedKeywords.includes(kw)) {
        matchedKeywords.push(kw);
      }
    }
  }

  // If specific items were matched, return them cleanly joined
  if (matchedKeywords.length > 0) {
    // Sort by length descending so longer specific phrases ("aloo paratha") take precedence over shorter substrings ("paratha")
    matchedKeywords.sort((a, b) => b.length - a.length);

    const filteredKeywords = [];
    for (const kw of matchedKeywords) {
      if (['food', 'groceries', 'buy', 'shopping', 'help', 'urgent', 'assistance'].includes(kw.toLowerCase())) continue;
      if (!filteredKeywords.some(existing => existing.toLowerCase().includes(kw.toLowerCase()))) {
        filteredKeywords.push(kw);
      }
    }

    const result = (filteredKeywords.length > 0 ? filteredKeywords : matchedKeywords).join(' ');
    if (result && result.trim().length > 0 && !result.toLowerCase().includes('help request')) {
      return result.trim();
    }
  }

  // 3. Fallback: Strip conversational filler words
  FILLER_WORDS.forEach(regex => {
    cleaned = cleaned.replace(regex, ' ');
  });

  cleaned = cleaned.replace(/[^\w\s,]/gi, ' ').replace(/\s+/g, ' ').trim();

  if (cleaned.toLowerCase().includes('help request') || cleaned.length === 0) {
    return '';
  }

  return cleaned;
}

/**
 * Recommend platforms and pre-filled search links matching the Service Mapping Dataset
 */
function recommendPlatforms({ title = '', description = '', transcript = '', category = 'Other' }) {
  // Strip 'help request' boilerplate from text BEFORE matching category
  let cleanedText = `${title} ${description} ${transcript}`.toLowerCase();
  cleanedText = cleanedText.replace(/help request\s*[-–—]?\s*\d{1,2}\s+\w+\s+\d{4}/gi, ' ')
                           .replace(/help request\s*[-–—]?\s*/gi, ' ')
                           .replace(/\bhelp request\b/gi, ' ')
                           .replace(/\bemergency alarm active\b/gi, ' ');

  let matchedCategoryObj = null;

  // 1. Match category by keyword in serviceMapping dataset with specific priority
  const priorityCategories = [
    "Grocery", "Medicine", "Food Delivery", "Doctor Appointment",
    "Transportation", "Bill Payment", "Banking", "Courier", "Home Services",
    "Laundry", "Pet Care", "Flowers & Gifts", "Government Services",
    "Travel Booking", "Entertainment", "Communication", "Companionship",
    "Electronics", "Shopping", "Emergency"
  ];

  for (const catName of priorityCategories) {
    const item = serviceMapping.find(s => s.category === catName);
    if (!item) continue;
    for (const kw of item.keywords) {
      const regex = new RegExp(`\\b${kw.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`, 'i');
      if (regex.test(cleanedText)) {
        matchedCategoryObj = item;
        break;
      }
    }
    if (matchedCategoryObj) break;
  }

  // 2. Fallback category matching by system category dropdown
  if (!matchedCategoryObj) {
    if (category === 'Grocery Shopping') {
      matchedCategoryObj = serviceMapping.find(s => s.category === 'Grocery');
    } else if (category === 'Medical Escort') {
      matchedCategoryObj = serviceMapping.find(s => s.category === 'Medicine');
    } else if (category === 'Tech Support') {
      matchedCategoryObj = serviceMapping.find(s => s.category === 'Electronics');
    } else if (category === 'Housekeeping') {
      matchedCategoryObj = serviceMapping.find(s => s.category === 'Home Services');
    } else if (category === 'Companionship') {
      matchedCategoryObj = serviceMapping.find(s => s.category === 'Companionship');
    }
  }

  // 3. Fallback to Grocery/Shopping if no specific match
  if (!matchedCategoryObj) {
    matchedCategoryObj = serviceMapping.find(s => s.category === 'Grocery') || serviceMapping[0];
  }

  // Extract clean query item name
  let extractedQuery = extractItemsQuery(`${title} ${description} ${transcript}`);

  // If extracted query is empty or contains "Help Request", use category default search term!
  if (!extractedQuery || extractedQuery.toLowerCase().includes('help request')) {
    extractedQuery = CATEGORY_DEFAULT_QUERIES[matchedCategoryObj.category] || 'bread milk';
  }

  // Map matched platform names to full details with pre-filled search URLs using extractedQuery
  const suggestedPlatforms = matchedCategoryObj.platforms.map(pName => {
    const detail = PLATFORM_DETAILS[pName] || {
      icon: "🚀",
      color: "#1976d2",
      getUrl: q => `https://www.google.com/search?q=${encodeURIComponent(pName + ' ' + q)}`
    };

    return {
      name: pName,
      category: matchedCategoryObj.category,
      icon: detail.icon,
      color: detail.color,
      searchQuery: extractedQuery,
      url: detail.getUrl(extractedQuery)
    };
  });

  return {
    categoryName: matchedCategoryObj.category,
    extractedItems: extractedQuery,
    suggestedPlatforms
  };
}

module.exports = {
  serviceMapping,
  PLATFORM_DETAILS,
  extractItemsQuery,
  recommendPlatforms
};
