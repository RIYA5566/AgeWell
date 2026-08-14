// AgeWell - Translation Dictionary and i18n Engine (English, Hindi, Marathi)

const translations = {
  en: {
    // Navigation / Global
    nav_logo: "AgeWell",
    nav_text_size: "Text Size:",
    nav_logout: "🔑 Log Out",
    footer_text: "© 2026 AgeWell Platform. Designed with care for Senior Citizens, Volunteers, and Admins.",
    
    // Login (index.html)
    login_title: "Sign In to AgeWell",
    login_subtitle: "Welcome back! Please log in to continue.",
    label_email: "Email Address",
    label_password: "Password",
    btn_login: "🔑 Log In to AgeWell",
    new_to_agewell: "New to AgeWell?",
    btn_create_account: "✍️ Create a New Account",
    demo_creds_title: "🔐 Demo Login Credentials:",
    hero_title: "AgeWell",
    hero_subtitle: "Connecting Senior Citizens with compassionate local Volunteers for everyday support and peace of mind.",
    feat_req_title: "Request Help",
    feat_req_desc: "Easily ask for help with groceries, tech support, medical visits, housekeeping, or companionship.",
    feat_vol_title: "Volunteer Support",
    feat_vol_desc: "Volunteers can browse and accept pending requests, and stay connected with seniors throughout.",
    feat_sos_title: "Emergency SOS",
    feat_sos_desc: "One tap emergency alert instantly notifies volunteers and admins for immediate support.",
    feat_voice_title: "Voice Requests",
    feat_voice_desc: "Use your voice to describe what you need. No typing required — just speak!",
    feat_acc_title: "Accessibility First",
    feat_acc_desc: "Large text, high contrast, oversized buttons, and adjustable font size for easy use by all.",

    // Registration (register.html)
    reg_title: "Create your AgeWell Account",
    reg_subtitle: "Register as a Senior Citizen to request assistance, or join as a Volunteer to offer support.",
    label_role: "Choose your Role:",
    role_senior: "Senior Citizen",
    role_senior_desc: "I need help with daily tasks.",
    role_volunteer: "Volunteer",
    role_volunteer_desc: "I want to help seniors in my area.",
    role_family: "Family / Caregiver",
    role_family_desc: "I look after a senior and approve their helpers.",
    label_name: "Full Name",
    placeholder_name: "Enter your full name",
    label_phone: "Phone Number",

    label_address: "Home Address",
    label_emergency_contact: "Emergency Contact Details (Name & Phone Number)",
    placeholder_emergency_contact: "e.g. Son: John Doe - 555-0199",
    label_language: "🌐 Preferred Language / भाषा / भाषा निवडा",

    btn_register: "✍️ Complete Registration",
    already_have_account: "Already have an account?",
    btn_go_login: "🔑 Go to Login Page",
    kyc_title: "🛡️ Mandatory KYC & Verification Documents",
    kyc_desc: "To ensure senior citizens are safe, all volunteers must complete identity & background verification before visiting seniors.",
    label_aadhaar: "🪪 Aadhaar / National ID Number",
    label_phone_otp_section: "📞 Phone Number OTP Verification",
    btn_send_otp: "Send OTP",
    btn_verify_otp: "Verify OTP",
    phone_not_verified: "❌ Phone Not Verified (Click Send OTP)",
    email_not_verified: "❌ Email Not Verified (Click Send OTP)",
    label_email_otp_section: "📧 Email OTP Verification",
    label_upload_govt_id: "📄 Upload Government Photo ID (Aadhaar / Voter ID / Passport)",
    upload_govt_id_desc: "Upload clear image or document of your Govt issued ID.",
    label_upload_selfie: "📸 Upload Live Selfie / Profile Photo",
    upload_selfie_desc: "Clear front-facing picture of your face for identity matching.",
    skills_title: "Select the Skills / Areas you can support:",
    skill_grocery: "Grocery Shopping",
    skill_medical: "Medical Escort",
    skill_tech: "Tech Support",
    skill_housekeeping: "Housekeeping",
    skill_companionship: "Companionship",
    skill_other: "Other Assistance",
    caregiver_details_title: "Caregiver Details",
    label_senior_email: "Senior Citizen's Registered Email Address",
    senior_email_desc: "This links your account to your senior. They must already be registered.",
    label_relationship: "Your Relationship to the Senior",

    // Senior Dashboard
    sd_welcome: "Welcome back, {name}! 👋",
    sd_sos_btn: "🚨 SOS EMERGENCY",
    sd_sos_desc: "Instantly alerts nearby verified volunteers and starts an alarm. Use this for emergencies only.",
    sd_active_requests: "📋 Active Assistance Requests",
    sd_completed_history: "📜 Request History & Verification",
    sd_new_request_btn: "➕ Create New Help Request",
    sd_modal_title: "Request Assistance",
    sd_modal_category: "Select Help Category:",
    sd_modal_title_label: "Short Task Title (Optional if recording voice)",
    sd_modal_desc_label: "Describe what you need help with (Optional if recording voice)",
    sd_voice_label: "🎙️ Record Voice Request (Speak in your preferred language)",
    btn_start_record: "🎤 Start Recording",
    btn_stop_record: "⏹️ Stop Recording",
    btn_clear_record: "🗑️ Clear",
    btn_submit_request: "📤 Raise Request",
    btn_cancel: "Cancel",
    sd_status_pending: "Awaiting Caregiver Approval",
    sd_status_approved: "Approved & Active",
    sd_status_completed: "Completed",
    sd_voice_lang: "Voice Language:",

    // Volunteer Dashboard
    vd_welcome: "Welcome, {name}!",
    vd_wallet_title: "My Earnings Wallet",
    vd_wallet_total: "Total Earned",
    vd_wallet_available: "Available",
    vd_wallet_pending: "Pending",
    vd_view_earnings: "📊 View Earnings",
    vd_withdraw: "🏦 Withdraw",
    vd_kyc_card_title: "🛡️ Multi-Level Trust & Verification Status",
    vd_kyc_card_subtitle: "Required verification levels before accepting requests to visit senior citizens.",
    vd_btn_kyc_submit: "📤 Submit KYC Documents",
    vd_badge_govt: "📄 Govt ID:",
    vd_badge_phone: "📞 Phone: Verified",
    vd_badge_email: "📧 Email: Verified",
    vd_badge_police: "👮 Police Check:",
    vd_status_awaiting_approval: "⏳ Awaiting Family Approval",
    vd_status_awaiting_approval_desc: "You have accepted these requests. The senior's family/caregiver is reviewing your profile before you can proceed.",
    vd_status_active: "🤝 My Active Commitments (Tasks in Progress)",
    vd_status_seeking: "🔍 Help Requests Seeking Volunteers",
    vd_status_notifications: "📢 Task Assignment Notifications",
    vd_status_history: "📜 My Service History (Completed Tasks)",

    // Family Dashboard
    fd_welcome: "Welcome, Caregiver {name}! ❤️",
    fd_linked_senior: "Linked Senior Citizen: {name}",
    fd_pending_approval: "⏳ Caregiver Approvals Pending Your Consent",
    fd_pending_approval_desc: "Volunteers have accepted your senior's help requests. Please review their profiles and check ID/Police badges to authorize their visit.",
    fd_current_active: "🤝 Current Active Commitments",
    fd_current_active_desc: "These requests are approved and volunteers are currently assisting your senior.",
    fd_completed_history: "📜 Complete Service History",
    fd_portal_title: "Family Caregiver Portal",
    fd_welcome_subtitle: "Review and approve volunteers before they assist your loved one.",
    fd_requests_section_title: "📋 Senior Help Requests & Fulfillment Decisions",
    fd_volunteer_approvals_title: "⏳ Volunteer Approvals & Quoted Fees",
    fd_proof_verifications_title: "📸 Delivery & Receipt Proof Verifications",


    // Common / Dynamic Strings
    status_pending: "Pending",
    status_approved: "Approved",
    status_completed: "Completed",
    status_cancelled: "Cancelled",
    status_unverified: "Unverified",
    status_verified: "Verified",
    status_rejected: "Rejected",
    status_pending_review: "Pending Review",
    
    // Earnings Modal & Actions
    em_title: "💰 Earnings History",
    em_tab_tx: "📋 Transactions",
    em_tab_month: "📅 This Month",
    em_tab_withdraw: "🏦 Withdraw",
    em_no_tx: "No earnings yet. Complete tasks to start earning!",
    em_monthly_completed: "Tasks Completed",
    em_monthly_total: "Total Earned",
    em_monthly_avg: "Avg / Task",
    em_withdraw_avail: "Available Balance",
    em_bank_acc: "Bank Account (Simulated)",
    em_withdraw_est: "⚡ Estimated arrival: 2–3 business days",
    em_withdraw_success_title: "Withdrawal Successful!",
    em_withdraw_success_desc: "Your earnings will reach your bank account in 2–3 business days.",
    em_tx_id: "Transaction ID",
    sd_voice_assistant_title: "🎙️ Voice Request Assistant",
    sd_voice_status_listening: "Speak your request now...",
    sd_voice_sub_listening: "Listening to what you need help with.",
    sd_voice_box_label: "🗣️ Speech Converted To Text:",
    sd_voice_confirm_prompt: "🔊 \"Should I send this request?\"",
    sd_voice_confirm_desc: "Simply say \"YES\" to send or \"NO\" to cancel.",
    btn_voice_confirm_yes: "✅ YES (Send)",
    btn_voice_confirm_no: "❌ NO (Discard)",
    nav_language_label: "Lang:",
    sd_actions_panel: "Actions Panel",
    sd_support_requests: "My Support Requests",
    sd_urgency_label: "5. How Urgent Is This?",

    status_fulfilled_by_family: "🏡 Fulfilled by Family Caregiver",
    status_rejected_by_caregiver: "❌ Request Rejected by Caregiver",
    status_awaiting_allotment: "⏳ Awaiting Caregiver Allotment",
    status_allotted_volunteers: "🔍 Allotted to Volunteers (Seeking Help)",
    status_caregiver_reviewing: "⏳ Caregiver Reviewing Volunteer Quotes",
    status_volunteer_assigned: "🤝 Volunteer Assigned",
    status_cart_proof_submitted: "💳 Cart Proof Submitted by Volunteer",
    status_purchase_funded: "✅ Purchase Funded (In Progress)",
    status_awaiting_verification: "🧾 Receipt Uploaded (Awaiting Verification)",
    status_service_completed: "✅ Service Completed & Delivered",

    badge_high_priority: "High Priority",
    badge_sos_emergency: "SOS EMERGENCY",

    sd_pref_label: "🛒 Caregiver Shopping Preference: ",
    sd_pref_no_preference: "No Preference",
    sd_pref_store_brand: "Store Brand Only (Cheapest)",

    sd_voice_recording_label: "🎙️ Voice Recording:",
    sd_requested_on_label: "Requested on: ",
    btn_cancel_request: "❌ Cancel Request",

    sd_reason_label: "Reason:",
    sd_completed_directly_caregiver: "🏡 Completed Directly by Family Caregiver",
    sd_completed_directly_caregiver_desc: "Your family caregiver took care of this request for you!",
    sd_volunteer_candidate: "Volunteer Candidate:",
    sd_caregiver_reviewing_quotes: "🔐 Your family caregiver is reviewing volunteer quotes. Contact details will appear once approved.",
    sd_approved_volunteer: "Approved Volunteer:",
    sd_volunteer_contact: "Volunteer Contact:",
    sd_volunteer_email: "Volunteer Email:",
    sd_assisted_by: "Assisted By:",
    sd_completion_notes: "Completion Notes:",
    sd_no_notes_provided: "No notes provided",
    sd_total_spent: "💵 Total Amount Spent:",
    sd_free_service: "(Voluntary Free Service)",
    placeholder_request_title: "e.g. Need medicine from pharmacy, light bulb change, etc.",
    placeholder_request_desc: "Describe what you need help with...",

    popup_sos_cancelled_title: "SOS Alarm Cancelled",
    popup_sos_cancelled_msg: "Emergency SOS alarm has been cancelled.",
    popup_form_cancelled_title: "Request Form Cancelled",
    popup_form_cancelled_msg: "Your help request form was cancelled.",
    popup_mic_required_title: "Microphone Access Required",
    popup_mic_required_msg: "Microphone access was denied or is not supported in this browser. Please check browser permissions.",
    popup_mic_required_msg2: "Microphone access is required for voice request confirmation. Please check browser permissions.",
    confirm_cancel_request_title: "Cancel Help Request?",
    confirm_cancel_request_msg: "Are you sure you want to cancel this help request? This action cannot be undone.",
    popup_cancelled_title: "Request Cancelled",
    popup_cancelled_msg: "Your help request has been successfully cancelled.",
    popup_failed_cancel_title: "Failed to Cancel",
    popup_failed_cancel_msg: "Failed to cancel request.",
    popup_voice_assistant_cancelled_msg: "Voice request assistant cancelled.",
    popup_confirmed_title: "Help Request Confirmed!",
    popup_confirmed_msg: "Your request has been confirmed and submitted successfully! Volunteers nearby will be notified.",
    popup_failed_title: "Submission Failed",
    popup_failed_msg: "Failed to submit request.",
    popup_low_conf_title: "Voice Request Created!",
    popup_low_conf_msg: "Because AI speech confidence was low, your family caregiver has been notified to verify your request.",
    popup_voice_confirmed_title: "Help Request Confirmed!",
    popup_voice_confirmed_msg: "Your voice request has been confirmed and submitted successfully! Volunteers nearby will be notified.",
    popup_aborted_title: "Action Aborted",
    popup_aborted_msg: "Cancellation was aborted. Your request was kept safe.",
    popup_delivery_confirmed_title: "Delivery Confirmed!",
    popup_delivery_confirmed_msg: "✅ Delivery confirmed! Thank you.",
    popup_issue_reported_title: "Issue Reported",
    popup_issue_reported_msg: "⚠️ Issue reported: Item not received.",
    popup_error_title: "Error",
    popup_error_submit_msg: "Error submitting response",

    btn_ok: "👍 OK, Got It!",
    btn_yes_cancel: "❌ Yes, Cancel",
    btn_no_keep: "↩️ No, Keep Request",
    btn_ivr_press_1: "1️⃣ PRESS 1<br><span style='font-size: 0.95rem; font-weight: 600;'>(Received Items / YES)</span>",
    btn_ivr_press_2: "2️⃣ PRESS 2<br><span style='font-size: 0.95rem; font-weight: 600;'>(Did Not Receive / NO)</span>",
    ivr_badge: "Automated Delivery Confirmation Call",
    ivr_title: "Incoming Confirmation Call",
    ivr_mic_helper: "🗣️ You can also speak your response directly into your microphone (\"Yes\" or \"No\")."
  },
  hi: {

    // Navigation / Global
    nav_logo: "एजवेल",
    nav_text_size: "अक्षर का आकार:",
    nav_logout: "🔑 लॉग आउट",
    footer_text: "© 2026 एजवेल प्लेटफॉर्म। वरिष्ठ नागरिकों, स्वयंसेवकों और प्रशासकों के लिए देखभाल के साथ डिज़ाइन किया गया।",

    // Login (index.html)
    login_title: "एजवेल में साइन इन करें",
    login_subtitle: "वापसी पर आपका स्वागत है! जारी रखने के लिए कृपया लॉग इन करें।",
    label_email: "ईमेल पता",
    label_password: "पासवर्ड",
    btn_login: "🔑 एजवेल में लॉग इन करें",
    new_to_agewell: "एजवेल में नए हैं?",
    btn_create_account: "✍️ नया खाता बनाएँ",
    demo_creds_title: "🔐 डेमो लॉगिन क्रेडेंशियल:",
    hero_title: "एजवेल",
    hero_subtitle: "वरिष्ठ नागरिकों को रोजमर्रा की सहायता और मन की शांति के लिए स्थानीय स्वयंसेवकों से जोड़ना।",
    feat_req_title: "मदद का अनुरोध करें",
    feat_req_desc: "किराने का सामान, तकनीकी सहायता, चिकित्सा यात्राओं, घर की सफाई या संगति के लिए आसानी से मदद मांगें।",
    feat_vol_title: "स्वयंसेवक सहायता",
    feat_vol_desc: "स्वयंसेवक लंबित अनुरोधों को देख और स्वीकार कर सकते हैं, और हमेशा संपर्क में रह सकते हैं।",
    feat_sos_title: "आपातकालीन एसओएस",
    feat_sos_desc: "एक टैप आपातकालीन अलर्ट तुरंत स्वयंसेवकों और व्यवस्थापकों को सहायता के लिए सूचित करता है।",
    feat_voice_title: "आवाज अनुरोध",
    feat_voice_desc: "अपनी आवाज का उपयोग करके बताएं कि आपको क्या चाहिए। टाइप करने की आवश्यकता नहीं है - बस बोलें!",
    feat_acc_title: "सुलभता सर्वोपरि",
    feat_acc_desc: "सभी के लिए आसान उपयोग के लिए बड़े अक्षर, उच्च कंट्रास्ट, बड़े बटन और समायोज्य फ़ॉन्ट आकार।",

    // Registration (register.html)
    reg_title: "अपना एजवेल खाता बनाएँ",
    reg_subtitle: "सहायता का अनुरोध करने के लिए वरिष्ठ नागरिक के रूप में पंजीकरण करें, या सहायता प्रदान करने के लिए स्वयंसेवक के रूप में शामिल हों।",
    label_role: "अपनी भूमिका चुनें:",
    role_senior: "वरिष्ठ नागरिक",
    role_senior_desc: "मुझे दैनिक कार्यों में मदद की आवश्यकता है।",
    role_volunteer: "स्वयंसेवक",
    role_volunteer_desc: "मैं अपने क्षेत्र में वरिष्ठ नागरिकों की मदद करना चाहता हूँ।",
    role_family: "परिवार / देखभालकर्ता",
    role_family_desc: "मैं एक वरिष्ठ नागरिक की देखभाल करता हूँ और उनके सहायकों को मंजूरी देता हूँ।",
    label_name: "पूरा नाम",
    placeholder_name: "अपना पूरा नाम दर्ज करें",
    label_phone: "फ़ोन नंबर",

    label_address: "घर का पता",
    label_emergency_contact: "आपातकालीन संपर्क विवरण (नाम और फ़ोन नंबर)",
    placeholder_emergency_contact: "जैसे: बेटा: रमेश कुमार - 555-0199",
    label_language: "🌐 पसंदीदा भाषा / भाषा निवडा",

    btn_register: "✍️ पंजीकरण पूरा करें",
    already_have_account: "पहले से ही एक खाता है?",
    btn_go_login: "🔑 लॉगिन पेज पर जाएँ",
    kyc_title: "🛡️ अनिवार्य केवाईसी और सत्यापन दस्तावेज",
    kyc_desc: "वरिष्ठ नागरिकों की सुरक्षा सुनिश्चित करने के लिए, सभी स्वयंसेवकों को वरिष्ठ नागरिकों के पास जाने से पहले पहचान और पृष्ठभूमि सत्यापन पूरा करना होगा।",
    label_aadhaar: "🪪 आधार / राष्ट्रीय आईडी नंबर",
    label_phone_otp_section: "📞 फ़ोन नंबर ओटीपी सत्यापन",
    btn_send_otp: "ओटीपी भेजें",
    btn_verify_otp: "ओटीपी सत्यापित करें",
    phone_not_verified: "❌ फ़ोन सत्यापित नहीं है (ओटीपी भेजें पर क्लिक करें)",
    email_not_verified: "❌ ईमेल सत्यापित नहीं है (ओटीपी भेजें पर क्लिक करें)",
    label_email_otp_section: "📧 ईमेल ओटीपी सत्यापन",
    label_upload_govt_id: "📄 सरकारी फोटो आईडी (आधार / मतदाता पहचान पत्र / पासपोर्ट) अपलोड करें",
    upload_govt_id_desc: "अपनी सरकारी आईडी की स्पष्ट छवि या दस्तावेज अपलोड करें।",
    label_upload_selfie: "📸 लाइव सेल्फी / प्रोफाइल फोटो अपलोड करें",
    upload_selfie_desc: "पहचान मिलान के लिए अपने चेहरे की स्पष्ट सामने की तस्वीर।",
    skills_title: "उन कौशलों / क्षेत्रों का चयन करें जिनमें आप सहायता कर सकते हैं:",
    skill_grocery: "किराने की खरीदारी",
    skill_medical: "चिकित्सा एस्कॉर्ट",
    skill_tech: "तकनीकी सहायता",
    skill_housekeeping: "घर की सफाई",
    skill_companionship: "संगति",
    skill_other: "अन्य सहायता",
    caregiver_details_title: "देखभालकर्ता विवरण",
    label_senior_email: "वरिष्ठ नागरिक का पंजीकृत ईमेल पता",
    senior_email_desc: "यह आपके खाते को आपके वरिष्ठ नागरिक से जोड़ता है। वे पहले से पंजीकृत होने चाहिए।",
    label_relationship: "वरिष्ठ नागरिक से आपका संबंध",

    // Senior Dashboard
    sd_welcome: "वापसी पर स्वागत है, {name}! 👋",
    sd_sos_btn: "🚨 एसओएस आपातकालीन",
    sd_sos_desc: "तुरंत पास के सत्यापित स्वयंसेवकों को सचेत करता है और अलार्म शुरू करता है। केवल आपातकाल के लिए उपयोग करें।",
    sd_active_requests: "📋 सक्रिय सहायता अनुरोध",
    sd_completed_history: "📜 अनुरोध इतिहास और सत्यापन",
    sd_new_request_btn: "➕ नया सहायता अनुरोध बनाएँ",
    sd_modal_title: "सहायता का अनुरोध करें",
    sd_modal_category: "सहायता श्रेणी चुनें:",
    sd_modal_title_label: "संक्षिप्त कार्य शीर्षक (आवाज रिकॉर्ड करने पर वैकल्पिक)",
    sd_modal_desc_label: "आपको किस काम में मदद चाहिए, उसका विवरण (आवाज रिकॉर्ड करने पर वैकल्पिक)",
    sd_voice_label: "🎙️ आवाज अनुरोध रिकॉर्ड करें (अपनी पसंदीदा भाषा में बोलें)",
    btn_start_record: "🎤 रिकॉर्डिंग शुरू करें",
    btn_stop_record: "⏹️ रिकॉर्डिंग बंद करें",
    btn_clear_record: "🗑️ साफ करें",
    btn_submit_request: "📤 अनुरोध भेजें",
    btn_cancel: "रद्द करें",
    sd_status_pending: "देखभालकर्ता की मंजूरी का इंतजार",
    sd_status_approved: "स्वीकृत और सक्रिय",
    sd_status_completed: "पूरा हो गया",
    sd_voice_lang: "आवाज की भाषा:",

    // Volunteer Dashboard
    vd_welcome: "स्वागत है, {name}!",
    vd_wallet_title: "मेरा कमाई बटुआ",
    vd_wallet_total: "कुल कमाई",
    vd_wallet_available: "उपलब्ध",
    vd_wallet_pending: "लंबित",
    vd_view_earnings: "📊 कमाई देखें",
    vd_withdraw: "🏦 पैसे निकालें",
    vd_kyc_card_title: "🛡️ बहु-स्तरीय विश्वास और सत्यापन स्थिति",
    vd_kyc_card_subtitle: "वरिष्ठ नागरिकों से मिलने के अनुरोधों को स्वीकार करने से पहले आवश्यक सत्यापन स्तर।",
    vd_btn_kyc_submit: "📤 केवाईसी दस्तावेज जमा करें",
    vd_badge_govt: "📄 सरकारी आईडी:",
    vd_badge_phone: "📞 फ़ोन: सत्यापित",
    vd_badge_email: "📧 ईमेल: सत्यापित",
    vd_badge_police: "👮 पुलिस जांच:",
    vd_status_awaiting_approval: "⏳ परिवार की मंजूरी का इंतजार",
    vd_status_awaiting_approval_desc: "आपने इन अनुरोधों को स्वीकार कर लिया है। आपके आगे बढ़ने से पहले वरिष्ठ नागरिक का परिवार/देखभालकर्ता आपकी प्रोफाइल की समीक्षा कर रहा है।",
    vd_status_active: "🤝 मेरी सक्रिय प्रतिबद्धताएं (कार्य प्रगति पर हैं)",
    vd_status_seeking: "🔍 मदद की तलाश में अनुरोध",
    vd_status_notifications: "📢 कार्य आवंटन सूचनाएं",
    vd_status_history: "📜 मेरा सेवा इतिहास (पूरे किए गए कार्य)",

    // Family Dashboard
    fd_welcome: "आपका स्वागत है, देखभालकर्ता {name}! ❤️",
    fd_linked_senior: "जुड़े हुए वरिष्ठ नागरिक: {name}",
    fd_pending_approval: "⏳ आपकी सहमति के लिए लंबित देखभालकर्ता स्वीकृतियां",
    fd_pending_approval_desc: "स्वयंसेवकों ने आपके वरिष्ठ नागरिक के सहायता अनुरोधों को स्वीकार कर लिया है। कृपया उनके प्रोफाइल की समीक्षा करें और उनकी यात्रा को अधिकृत करने के लिए आईडी/पोलीस बैज की जांच करें।",
    fd_current_active: "🤝 वर्तमान सक्रिय प्रतिबद्धताएं",
    fd_current_active_desc: "ये अनुरोध स्वीकृत हैं और स्वयंसेवक वर्तमान में आपके वरिष्ठ नागरिक की सहायता कर रहे हैं।",
    fd_completed_history: "📜 संपूर्ण सेवा इतिहास",
    fd_portal_title: "पारिवारिक देखभालकर्ता पोर्टल",
    fd_welcome_subtitle: "अपने प्रियजन की सहायता करने से पहले स्वयंसेवकों की समीक्षा और अनुमोदन करें।",
    fd_requests_section_title: "📋 वरिष्ठ सहायता अनुरोध और पूर्ति निर्णय",
    fd_volunteer_approvals_title: "⏳ स्वयंसेवक अनुमोदन और उद्धृत शुल्क",
    fd_proof_verifications_title: "📸 वितरण और रसीद प्रमाण सत्यापन",


    // Common / Dynamic Strings
    status_pending: "लंबित",
    status_approved: "स्वीकृत",
    status_completed: "पूरा हो गया",
    status_cancelled: "रद्द",
    status_unverified: "असत्यापित",
    status_verified: "सत्यापित",
    status_rejected: "अस्वीकृत",
    status_pending_review: "समीक्षा लंबित",

    // Earnings Modal & Actions
    em_title: "💰 कमाई का इतिहास",
    em_tab_tx: "📋 लेनदेन",
    em_tab_month: "📅 इस महीने",
    em_tab_withdraw: "🏦 पैसे निकालें",
    em_no_tx: "अभी तक कोई कमाई नहीं हुई है। कमाई शुरू करने के लिए कार्यों को पूरा करें!",
    em_monthly_completed: "पूरे किए गए कार्य",
    em_monthly_total: "कुल कमाई",
    em_monthly_avg: "औसत / कार्य",
    em_withdraw_avail: "उपलब्ध शेष राशि",
    em_bank_acc: "बैंक खाता (सिम्युलेटेड)",
    em_withdraw_est: "⚡ अनुमानित आगमन: 2-3 कार्य दिवस",
    em_withdraw_success_title: "निकासी सफल!",
    em_withdraw_success_desc: "आपकी कमाई 2-3 कार्य दिवसों में आपके बैंक खाते में पहुंच जाएगी।",
    em_tx_id: "लेनदेन आईडी",
    sd_voice_assistant_title: "🎙️ आवाज अनुरोध सहायक",
    sd_voice_status_listening: "अब अपना अनुरोध बोलें...",
    sd_voice_sub_listening: "आपकी सहायता की जरूरत सुनी जा रही है।",
    sd_voice_box_label: "🗣️ आवाज पाठ में परिवर्तित:",
    sd_voice_confirm_prompt: "🔊 \"क्या मुझे यह अनुरोध भेजना चाहिए?\"",
    sd_voice_confirm_desc: "भेजने के लिए बस \"हाँ (YES)\" कहें या रद्द करने के लिए \"नहीं (NO)\" कहें।",
    btn_voice_confirm_yes: "✅ हाँ (भेजें)",
    btn_voice_confirm_no: "❌ नहीं (रद्द करें)",
    nav_language_label: "भाषा:",
    sd_actions_panel: "कार्रवाई पैनल",
    sd_support_requests: "मेरे सहायता अनुरोध",
    sd_urgency_label: "५. यह कितना जरूरी है?",

    status_fulfilled_by_family: "🏡 पारिवारिक देखभालकर्ता द्वारा पूरा किया गया",
    status_rejected_by_caregiver: "❌ देखभालकर्ता द्वारा अनुरोध अस्वीकृत",
    status_awaiting_allotment: "⏳ देखभालकर्ता आवंटन की प्रतीक्षा है",
    status_allotted_volunteers: "🔍 स्वयंसेवकों को आवंटित (मदद की तलाश में)",
    status_caregiver_reviewing: "⏳ देखभालकर्ता स्वयंसेवक कोट की समीक्षा कर रहे हैं",
    status_volunteer_assigned: "🤝 स्वयंसेवक नियुक्त किया गया",
    status_cart_proof_submitted: "💳 स्वयंसेवक द्वारा कार्ट प्रमाण प्रस्तुत किया गया",
    status_purchase_funded: "✅ खरीद वित्त पोषित (प्रगति पर)",
    status_awaiting_verification: "🧾 रसीद अपलोड की गई (सत्यापन की प्रतीक्षा)",
    status_service_completed: "✅ सेवा पूर्ण और वितरित की गई",

    badge_high_priority: "उच्च प्राथमिकता",
    badge_sos_emergency: "एसओएस आपातकालीन",

    sd_pref_label: "🛒 देखभालकर्ता खरीदारी प्राथमिकता: ",
    sd_pref_no_preference: "कोई प्राथमिकता नहीं",
    sd_pref_store_brand: "केवल स्टोर ब्रांड (सबसे सस्ता)",

    sd_voice_recording_label: "🎙️ आवाज रिकॉर्डिंग:",
    sd_requested_on_label: "अनुरोध की तिथि: ",
    btn_cancel_request: "❌ अनुरोध रद्द करें",

    sd_reason_label: "कारण:",
    sd_completed_directly_caregiver: "🏡 पारिवारिक देखभालकर्ता द्वारा सीधे पूरा किया गया",
    sd_completed_directly_caregiver_desc: "आपके पारिवारिक देखभालकर्ता ने आपके लिए इस अनुरोध का ध्यान रखा!",
    sd_volunteer_candidate: "स्वयंसेवक उम्मीदवार:",
    sd_caregiver_reviewing_quotes: "🔐 आपके पारिवारिक देखभालकर्ता स्वयंसेवक कोट की समीक्षा कर रहे हैं। स्वीकृत होने के बाद संपर्क विवरण दिखाई देंगे।",
    sd_approved_volunteer: "स्वीकृत स्वयंसेवक:",
    sd_volunteer_contact: "स्वयंसेवक संपर्क:",
    sd_volunteer_email: "स्वयंसेवक ईमेल:",
    sd_assisted_by: "सहायता प्रदान की:",
    sd_completion_notes: "पूर्णता नोट:",
    sd_no_notes_provided: "कोई नोट नहीं दिया गया",
    sd_total_spent: "💵 कुल खर्च राशि:",
    sd_free_service: "(स्वैच्छिक निःशुल्क सेवा)",
    placeholder_request_title: "उदा. फार्मेसी से दवा चाहिए, बल्ब बदलना है, आदि।",
    placeholder_request_desc: "आपको किस काम में मदद चाहिए, उसका विवरण दें...",

    popup_sos_cancelled_title: "एसओएस अलार्म रद्द",
    popup_sos_cancelled_msg: "आपातकालीन एसओएस अलार्म रद्द कर दिया गया है।",
    popup_form_cancelled_title: "अनुरोध फ़ॉर्म रद्द",
    popup_form_cancelled_msg: "आपका सहायता अनुरोध फ़ॉर्म रद्द कर दिया गया था।",
    popup_mic_required_title: "माइक्रोफ़ोन पहुंच आवश्यक",
    popup_mic_required_msg: "माइक्रोफ़ोन पहुंच अस्वीकार कर दी गई है या इस ब्राउज़र में समर्थित नहीं है। कृपया ब्राउज़र अनुमतियों की जांच करें।",
    popup_mic_required_msg2: "आवाज अनुरोध सत्यापन के लिए माइक्रोफ़ोन पहुंच आवश्यक है। कृपया ब्राउज़र अनुमतियों की जांच करें।",
    confirm_cancel_request_title: "सहायता अनुरोध रद्द करें?",
    confirm_cancel_request_msg: "क्या आप वाकई इस सहायता अनुरोध को रद्द करना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।",
    popup_cancelled_title: "अनुरोध रद्द",
    popup_cancelled_msg: "आपका सहायता अनुरोध सफलतापूर्वक रद्द कर दिया गया है।",
    popup_failed_cancel_title: "रद्द करने में विफल",
    popup_failed_cancel_msg: "अनुरोध रद्द करने में विफल रहा।",
    popup_voice_assistant_cancelled_msg: "आवाज अनुरोध सहायक रद्द कर दिया गया।",
    popup_confirmed_title: "सहायता अनुरोध की पुष्टि की गई!",
    popup_confirmed_msg: "आपका अनुरोध सफलतापूर्वक सत्यापित और जमा कर दिया गया है! पास के स्वयंसेवकों को सूचित किया जाएगा।",
    popup_failed_title: "सबमिशन विफल",
    popup_failed_msg: "अनुरोध सबमिट करने में विफल रहा।",
    popup_low_conf_title: "आवाज अनुरोध बनाया गया!",
    popup_low_conf_msg: "कम आत्मविश्वास के कारण, आपके देखभालकर्ता को सत्यापित करने के लिए सूचित किया गया है।",
    popup_voice_confirmed_title: "सहायता अनुरोध की पुष्टि की गई!",
    popup_voice_confirmed_msg: "आपका आवाज अनुरोध सफलतापूर्वक सत्यापित और जमा कर दिया गया है! पास के स्वयंसेवकों को सूचित किया जाएगा।",
    popup_aborted_title: "कार्रवाई रद्द की गई",
    popup_aborted_msg: "रद्दीकरण रोक दिया गया था। आपका अनुरोध सुरक्षित रखा गया था।",
    popup_delivery_confirmed_title: "वितरण की पुष्टि की गई!",
    popup_delivery_confirmed_msg: "✅ वितरण की पुष्टि की गई! धन्यवाद।",
    popup_issue_reported_title: "समस्या दर्ज की गई",
    popup_issue_reported_msg: "⚠️ समस्या दर्ज की गई: वस्तुएं प्राप्त नहीं हुईं।",
    popup_error_title: "त्रुटि",
    popup_error_submit_msg: "प्रतिक्रिया सबमिट करने में त्रुटि",

    btn_ok: "👍 ठीक है, समझ गया!",
    btn_yes_cancel: "❌ हाँ, रद्द करें",
    btn_no_keep: "↩️ नहीं, अनुरोध रखें",
    btn_ivr_press_1: "1️⃣ बटन १ दबाएं<br><span style='font-size: 0.95rem; font-weight: 600;'>(वस्तुएं मिल गईं / हाँ)</span>",
    btn_ivr_press_2: "2️⃣ बटन २ दबाएं<br><span style='font-size: 0.95rem; font-weight: 600;'>(वस्तुएं नहीं मिलीं / नहीं)</span>",
    ivr_badge: "स्वचालित वितरण पुष्टिकरण कॉल",
    ivr_title: "इनकमिंग पुष्टिकरण कॉल",
    ivr_mic_helper: "🗣️ आप सीधे अपने माइक्रोफ़ोन में अपनी प्रतिक्रिया बोल भी सकते हैं (\"हाँ\" या \"नहीं\")."
  },
  mr: {

    // Navigation / Global
    nav_logo: "एजवेल",
    nav_text_size: "अक्षरांचा आकार:",
    nav_logout: "🔑 लॉग आउट",
    footer_text: "© 2026 एजवेल प्लॅटफॉर्म. ज्येष्ठ नागरिक, स्वयंसेवक आणि प्रशासकांसाठी काळजीपूर्वक डिझाइन केलेले.",

    // Login (index.html)
    login_title: "एजवेल मध्ये साइन इन करा",
    login_subtitle: "पुन्हा स्वागत आहे! पुढे जाण्यासाठी कृपया लॉग इन करा.",
    label_email: "ईमेल पत्ता",
    label_password: "पासवर्ड",
    btn_login: "🔑 एजवेल मध्ये लॉग इन करा",
    new_to_agewell: "एजवेल वर नवीन आहात?",
    btn_create_account: "✍️ नवीन खाते तयार करा",
    demo_creds_title: "🔐 डेमो लॉगिन तपशील:",
    hero_title: "एजवेल",
    hero_subtitle: "ज्येष्ठ नागरिकांना रोजच्या मदतीसाठी आणि मनाच्या शांततेसाठी स्थानिक स्वयंसेवकांशी जोडणे.",
    feat_req_title: "मदतीची विनंती करा",
    feat_req_desc: "किराणा सामान, तांत्रिक मदत, वैद्यकीय भेटी, घराची स्वच्छता किंवा सोबत यासाठी सहज मदत मागा.",
    feat_vol_title: "स्वयंसेवक मदत",
    feat_vol_desc: "स्वयंसेवक प्रलंबित विनंत्या पाहू आणि स्वीकारू शकतात आणि नेहमी संपर्कात राहू शकतात.",
    feat_sos_title: "आणीबाणी एसओएस",
    feat_sos_desc: "एक टॅप आणीबाणीचा इशारा त्वरित स्वयंसेवक आणि प्रशासकांना मदतीसाठी सूचित करतो.",
    feat_voice_title: "आवाज विनंती",
    feat_voice_desc: "तुम्हाला काय हवे आहे ते सांगण्यासाठी तुमच्या आवाजाचा वापर करा. टाईप करण्याची गरज नाही - फक्त बोला!",
    feat_acc_title: "सुलभता प्रथम",
    feat_acc_desc: "सर्वांसाठी सुलभ वापरासाठी मोठे अक्षरे, उच्च कॉन्ट्रास्ट, मोठे बटणे आणि सानुकूल फॉन्ट आकार.",

    // Registration (register.html)
    reg_title: "तुमचे एजवेल खाते तयार करा",
    reg_subtitle: "मदतीची विनंती करण्यासाठी ज्येष्ठ नागरिक म्हणून नोंदणी करा, किंवा मदत करण्यासाठी स्वयंसेवक म्हणून सामील व्हा.",
    label_role: "तुमची भूमिका निवडा:",
    role_senior: "ज्येष्ठ नागरिक",
    role_senior_desc: "मला रोजच्या कामात मदतीची गरज आहे.",
    role_volunteer: "स्वयंसेवक",
    role_volunteer_desc: "मला माझ्या परिसरातील ज्येष्ठांना मदत करायची आहे.",
    role_family: "कुटुंब / काळजीवाहू",
    role_family_desc: "मी ज्येष्ठांची काळजी घेतो आणि त्यांच्या सहाय्यकांना मंजुरी देतो.",
    label_name: "पूर्ण नाव",
    placeholder_name: "आपले पूर्ण नाव प्रविष्ट करा",
    label_phone: "फोन नंबर",

    label_address: "घरचा पत्ता",
    label_emergency_contact: "आणीबाणीच्या संपर्काचा तपशील (नाव आणि फोन नंबर)",
    placeholder_emergency_contact: "उदा. मुलगा: रमेश कुमार - 555-0199",
    label_language: "🌐 पसंदीदा भाषा / भाषा निवडा",

    btn_register: "✍️ नोंदणी पूर्ण करा",
    already_have_account: "आधीच खाते आहे का?",
    btn_go_login: "🔑 लॉगिन पृष्ठावर जा",
    kyc_title: "🛡️ अनिवार्य केवायसी आणि पडताळणी कागदपत्रे",
    kyc_desc: "ज्येष्ठ नागरिकांची सुरक्षितता सुनिश्चित करण्यासाठी, सर्व स्वयंसेवकांनी ज्येष्ठांना भेट देण्यापूर्वी ओळख आणि पार्श्वभूमी पडताळणी पूर्ण करणे आवश्यक आहे.",
    label_aadhaar: "🪪 आधार / राष्ट्रीय आयडी क्रमांक",
    label_phone_otp_section: "📞 फोन नंबर ओटीपी पडताळणी",
    btn_send_otp: "ओटीपी पाठवा",
    btn_verify_otp: "ओटीपी सत्यापित करा",
    phone_not_verified: "❌ फोन सत्यापित नाही (ओटीपी पाठवा वर क्लिक करा)",
    email_not_verified: "❌ ईमेल सत्यापित नाही (ओटीपी पाठवा वर क्लिक करा)",
    label_email_otp_section: "📧 ईमेल ओटीपी पडताळणी",
    label_upload_govt_id: "📄 सरकारी फोटो आयडी (आधार / मतदार ओळखपत्र / पासपोर्ट) अपलोड करा",
    upload_govt_id_desc: "तुमच्या सरकारी आयडीची स्पष्ट प्रतिमा किंवा दस्तऐवज अपलोड करा.",
    label_upload_selfie: "📸 थेट सेल्फी / प्रोफाइल फोटो अपलोड करा",
    upload_selfie_desc: "ओळख जुळवण्यासाठी तुमच्या चेहऱ्याचे स्पष्ट समोरचे चित्र.",
    skills_title: "तुम्ही मदत करू शकता अशा कौशल्ये / क्षेत्रांची निवड करा:",
    skill_grocery: "किराणा खरेदी",
    skill_medical: "वैद्यकीय मदत",
    skill_tech: "तांत्रिक सहाय्य",
    skill_housekeeping: "घराची स्वच्छता",
    skill_companionship: "सोबत / साहचर्य",
    skill_other: "इतर मदत",
    caregiver_details_title: "काळजीवाहू तपशील",
    label_senior_email: "ज्येष्ठ नागरिकाचा नोंदणीकृत ईमेल पत्ता",
    senior_email_desc: "हे तुमचे खाते तुमच्या ज्येष्ठ नागरिकाशी जोडते. त्यांची आधीच नोंदणी असणे आवश्यक आहे.",
    label_relationship: "ज्येष्ठ नागरिकाशी तुमचे नाते",

    // Senior Dashboard
    sd_welcome: "पुन्हा स्वागत आहे, {name}! 👋",
    sd_sos_btn: "🚨 एसओएस आणीबाणी",
    sd_sos_desc: "त्वरित जवळच्या सत्यापित स्वयंसेवकांना सतर्क करते आणि गजर सुरू करते. फक्त आणीबाणीच्या प्रसंगी वापरा.",
    sd_active_requests: "📋 सक्रिय मदत विनंत्या",
    sd_completed_history: "📜 विनंती इतिहास आणि पडताळणी",
    sd_new_request_btn: "➕ नवीन मदत विनंती तयार करा",
    sd_modal_title: "मदतीची विनंती करा",
    sd_modal_category: "मदत श्रेणी निवडा:",
    sd_modal_title_label: "संक्षिप्त कार्य शीर्षक (आवाज रेकॉर्ड केल्यास पर्यायी)",
    sd_modal_desc_label: "तुम्हाला कोणत्या कामात मदत हवी आहे त्याचे वर्णन (आवाज रेकॉर्ड केल्यास पर्यायी)",
    sd_voice_label: "🎙️ आवाज विनंती रेकॉर्ड करा (तुमच्या पसंतीच्या भाषेत बोला)",
    btn_start_record: "🎤 रेकॉर्डिंग सुरू करा",
    btn_stop_record: "⏹️ रेकॉर्डिंग थांबवा",
    btn_clear_record: "🗑️ साफ करा",
    btn_submit_request: "📤 विनंती पाठवा",
    btn_cancel: "रद्द करा",
    sd_status_pending: "काळजीवाहूच्या मंजुरीची प्रतीक्षा",
    sd_status_approved: "मंजूर आणि सक्रिय",
    sd_status_completed: "पूर्ण झाले",
    sd_voice_lang: "आवाज भाषा:",

    // Volunteer Dashboard
    vd_welcome: "स्वागत आहे, {name}!",
    vd_wallet_title: "माझे कमाई पाकीट",
    vd_wallet_total: "एकूण कमाई",
    vd_wallet_available: "उपलब्ध",
    vd_wallet_pending: "प्रलंबित",
    vd_view_earnings: "📊 कमाई पहा",
    vd_withdraw: "🏦 पैसे काढा",
    vd_kyc_card_title: "🛡️ बहु-स्तरीय विश्वास आणि पडताळणी स्थिती",
    vd_kyc_card_subtitle: "ज्येष्ठ नागरिकांना भेट देण्याच्या विनंत्या स्वीकारण्यापूर्वी आवश्यक पडताळणी पातळी.",
    vd_btn_kyc_submit: "📤 केवायसी कागदपत्रे सबमिट करा",
    vd_badge_govt: "📄 सरकारी आयडी:",
    vd_badge_phone: "📞 फोन: सत्यापित",
    vd_badge_email: "📧 ईमेल: सत्यापित",
    vd_badge_police: "👮 पोलीस तपासणी:",
    vd_status_awaiting_approval: "⏳ कुटुंबाच्या मंजुरीची प्रतीक्षा",
    vd_status_awaiting_approval_desc: "तुम्ही या विनंत्या स्वीकारल्या आहेत. तुम्ही पुढे जाण्यापूर्वी ज्येष्ठ नागरिकाचे कुटुंब/काळजीवाहू तुमच्या प्रोफाइलचे पुनरावलोकन करत आहेत.",
    vd_status_active: "🤝 माझी सक्रिय वचनबद्धता (काम प्रगतीपथावर आहे)",
    vd_status_seeking: "🔍 मदतीची आवश्यकता असलेल्या विनंत्या",
    vd_status_notifications: "📢 कार्य वाटप सूचना",
    vd_status_history: "📜 माझा सेवा इतिहास (पूर्ण झालेली कामे)",

    // Family Dashboard
    fd_welcome: "स्वागत आहे, काळजीवाहू {name}! ❤️",
    fd_linked_senior: "जोडलेले ज्येष्ठ नागरिक: {name}",
    fd_pending_approval: "⏳ तुमच्या संमतीसाठी प्रलंबित काळजीवाहू मंजुरी",
    fd_pending_approval_desc: "स्वयंसेवकांनी तुमच्या ज्येष्ठ नागरिकाच्या मदत विनंत्या स्वीकारल्या आहेत. कृपया त्यांच्या प्रोफाइलचे पुनरावलोकन करा आणि त्यांच्या भेटीला परवानगी देण्यासाठी आयडी/पोलीस बॅज तपासा.",
    fd_current_active: "🤝 सध्याची सक्रिय वचनबद्धता",
    fd_current_active_desc: "या विनंत्या मंजूर आहेत आणि स्वयंसेवक सध्या तुमच्या ज्येष्ठ नागरिकाला मदत करत आहेत.",
    fd_completed_history: "📜 संपूर्ण सेवा इतिहास",
    fd_portal_title: "कौटुंबिक काळजीवाहू पोर्टल",
    fd_welcome_subtitle: "आपल्या प्रियजनाला मदत करण्यापूर्वी स्वयंसेवकांचे पुनरावलोकन आणि मंजूरी द्या.",
    fd_requests_section_title: "📋 ज्येष्ठ मदत विनंत्या आणि निर्णय",
    fd_volunteer_approvals_title: "⏳ स्वयंसेवक मंजूरी आणि कोटेड फी",
    fd_proof_verifications_title: "📸 वितरण आणि पावती पुरावा पडताळणी",


    // Common / Dynamic Strings
    status_pending: "प्रलंबित",
    status_approved: "मंजूर",
    status_completed: "पूर्ण झाले",
    status_cancelled: "रद्द",
    status_unverified: "अपडताळलेले",
    status_verified: "पडताळलेले",
    status_rejected: "नाकारले",
    status_pending_review: "पुनरावलोकन प्रलंबित",

    // Earnings Modal & Actions
    em_title: "💰 कमाईचा इतिहास",
    em_tab_tx: "📋 व्यवहार",
    em_tab_month: "📅 या महिन्यात",
    em_tab_withdraw: "🏦 पैसे काढा",
    em_no_tx: "अद्याप कोणतीही कमाई झालेली नाही. कमाई सुरू करण्यासाठी कामे पूर्ण करा!",
    em_monthly_completed: "पूर्ण झालेली कामे",
    em_monthly_total: "एकूण कमाई",
    em_monthly_avg: "सरासरी / काम",
    em_withdraw_avail: "उपलब्ध शिल्लक",
    em_bank_acc: "बँक खाते (सिम्युलेटेड)",
    em_withdraw_est: "⚡ अंदाजे आगमन: २-३ कार्यालयीन दिवस",
    em_withdraw_success_title: "पैसे काढणे यशस्वी!",
    em_withdraw_success_desc: "तुमची कमाई २-३ कार्यालयीन दिवसांत तुमच्या बँक खात्यात पोहोचेल.",
    em_tx_id: "व्यवहार आयडी",
    sd_voice_assistant_title: "🎙️ आवाज विनंती सहाय्यक",
    sd_voice_status_listening: "आता तुमची विनंती बोला...",
    sd_voice_sub_listening: "मदतीची आवश्यकता ऐकली जात आहे.",
    sd_voice_box_label: "🗣️ आवाज मजकुरात रूपांतरित:",
    sd_voice_confirm_prompt: "🔊 \"मी ही विनंती पाठवू का?\"",
    sd_voice_confirm_desc: "पाठवण्यासाठी फक्त \"हो (YES)\" म्हणा किंवा रद्द करण्यासाठी \"नाही (NO)\" म्हणा.",
    btn_voice_confirm_yes: "✅ हो (पाठवा)",
    btn_voice_confirm_no: "❌ नाही (रद्द करा)",
    nav_language_label: "भाषा:",
    sd_actions_panel: "कृती पॅनेल",
    sd_support_requests: "माझ्या मदतीच्या विनंत्या",
    sd_urgency_label: "५. ही विनंती किती तातडीची आहे?",

    status_fulfilled_by_family: "🏡 कौटुंबिक काळजीवाहूद्वारे पूर्ण केले",
    status_rejected_by_caregiver: "❌ काळजीवाहूद्वारे विनंती नाकारली",
    status_awaiting_allotment: "⏳ काळजीवाहू वाटपाची प्रतीक्षा आहे",
    status_allotted_volunteers: "🔍 स्वयंसेवकांना वाटप केले (मदत शोधत आहे)",
    status_caregiver_reviewing: "⏳ काळजीवाहू स्वयंसेवक कोटचे पुनरावलोकन करत आहेत",
    status_volunteer_assigned: "🤝 स्वयंसेवक नियुक्त केला",
    status_cart_proof_submitted: "💳 स्वयंसेवकाद्वारे कार्ट पुरावा सादर केला",
    status_purchase_funded: "✅ खरेदी निधीकृत (प्रगतीपथावर)",
    status_awaiting_verification: "🧾 पावती अपलोड केली (पडताळणी प्रलंबित)",
    status_service_completed: "✅ सेवा पूर्ण आणि वितरित केली",

    badge_high_priority: "उच्च प्राथमिकता",
    badge_sos_emergency: "एसओएस आणीबाणी",

    sd_pref_label: "🛒 काळजीवाहू खरेदी प्राधान्य: ",
    sd_pref_no_preference: "काहीही प्राधान्य नाही",
    sd_pref_store_brand: "फक्त स्टोअर ब्रँड (सर्वात स्वस्त)",

    sd_voice_recording_label: "🎙️ आवाज रेकॉर्डिंग:",
    sd_requested_on_label: "विनंतीची तारीख: ",
    btn_cancel_request: "❌ विनंती रद्द करा",

    sd_reason_label: "कारण:",
    sd_completed_directly_caregiver: "🏡 कौटुंबिक काळजीवाहूद्वारे थेट पूर्ण केले",
    sd_completed_directly_caregiver_desc: "तुमच्या कौटुंबिक काळजीवाहूने तुमच्यासाठी या विनंतीची काळजी घेतली!",
    sd_volunteer_candidate: "स्वयंसेवक उमेदवार:",
    sd_caregiver_reviewing_quotes: "🔐 तुमचे कौटुंबिक काळजीवाहू स्वयंसेवक कोटचे पुनरावलोकन करत आहेत. मंजुरी मिळाल्यावर संपर्क तपशील दिसतील.",
    sd_approved_volunteer: "सत्यापित स्वयंसेवक:",
    sd_volunteer_contact: "स्वयंसेवक संपर्क:",
    sd_volunteer_email: "स्वयंसेवक ईमेल:",
    sd_assisted_by: "मदत केली:",
    sd_completion_notes: "पूर्णता नोट्स:",
    sd_no_notes_provided: "कोणतीही नोंद दिली नाही",
    sd_total_spent: "💵 एकूण खर्च झालेली रक्कम:",
    sd_free_service: "(स्वैच्छिक विनामूल्य सेवा)",
    placeholder_request_title: "उदा. फार्मसीमधून औषध हवे आहे, दिवा बदलायचा आहे, इत्यादी.",
    placeholder_request_desc: "तुम्हाला ज्या कामात मदत हवी आहे त्याचे वर्णन करा...",

    popup_sos_cancelled_title: "एसओएस अलार्म रद्द",
    popup_sos_cancelled_msg: "आणीबाणीचा एसओएस अलार्म रद्द करण्यात आला आहे.",
    popup_form_cancelled_title: "विनंती फॉर्म रद्द",
    popup_form_cancelled_msg: "तुमचा मदत विनंती फॉर्म रद्द करण्यात आला आहे.",
    popup_mic_required_title: "मायक्रोफोन परवानगी आवश्यक",
    popup_mic_required_msg: "मायक्रोफोन परवानगी नाकारली गेली आहे किंवा या ब्राउझरमध्ये समर्थित नाही. कृपया ब्राउझर परवानगी तपासा.",
    popup_mic_required_msg2: "आवाज विनंती पडताळणीसाठी मायक्रोफोन परवानगी आवश्यक आहे. कृपया ब्राउझर परवानग्या तपासा.",
    confirm_cancel_request_title: "मदत विनंती रद्द करायची?",
    confirm_cancel_request_msg: "तुम्हाला नक्की ही मदत विनंती रद्द करायची आहे का? ही क्रिया मागे घेता येणार नाही.",
    popup_cancelled_title: "विनंती रद्द",
    popup_cancelled_msg: "तुमची मदत विनंती यशस्वीरित्या रद्द करण्यात आली आहे.",
    popup_failed_cancel_title: "रद्द करण्यात अयशस्वी",
    popup_failed_cancel_msg: "विनंती रद्द करण्यात अयशस्वी.",
    popup_voice_assistant_cancelled_msg: "आवाज विनंती सहाय्यक रद्द केला.",
    popup_confirmed_title: "मदत विनंती मंजूर केली!",
    popup_confirmed_msg: "तुमची विनंती यशस्वीरित्या सबमिट केली आहे! जवळील स्वयंसेवकांना सूचित केले जाईल.",
    popup_failed_title: "सबमिशन अयशस्वी",
    popup_failed_msg: "विनंती सबमिट करण्यात अयशस्वी.",
    popup_low_conf_title: "आवाज विनंती तयार केली!",
    popup_low_conf_msg: "कमी विश्वासार्हतेमुळे, तुमच्या काळजीवाहूला पडताळणीसाठी सूचित केले आहे.",
    popup_voice_confirmed_title: "मदत विनंती मंजूर केली!",
    popup_voice_confirmed_msg: "तुमची आवाज विनंती यशस्वीरित्या सबमिट केली आहे! जवळील स्वयंसेवकांना सूचित केले जाईल.",
    popup_aborted_title: "कृती रद्द केली",
    popup_aborted_msg: "रद्द करण्याची प्रक्रिया थांबवली गेली. तुमची विनंती सुरक्षित आहे.",
    popup_delivery_confirmed_title: "वितरणाची खात्री झाली!",
    popup_delivery_confirmed_msg: "✅ वितरणाची खात्री झाली! धन्यवाद.",
    popup_issue_reported_title: "समस्या नोंदवली गेली",
    popup_issue_reported_msg: "⚠️ समस्या नोंदवली: वस्तू मिळाल्या नाहीत.",
    popup_error_title: "त्रुटि",
    popup_error_submit_msg: "प्रतिसाद सादर करण्यात त्रुटी",

    btn_ok: "👍 ठीक आहे, समजले!",
    btn_yes_cancel: "❌ होय, रद्द करा",
    btn_no_keep: "↩️ नाही, विनंती ठेवा",
    btn_ivr_press_1: "1️⃣ बटन १ दाबा<br><span style='font-size: 0.95rem; font-weight: 600;'>(वस्तू मिळाल्या / होय)</span>",
    btn_ivr_press_2: "2️⃣ बटन २ दाबा<br><span style='font-size: 0.95rem; font-weight: 600;'>(वस्तू मिळाल्या नाहीत / नाही)</span>",
    ivr_badge: "स्वयंचलित वितरण पुष्टीकरण कॉल",
    ivr_title: "इनकमिंग पुष्टीकरण कॉल",
    ivr_mic_helper: "🗣️ तुम्ही तुमची प्रतिक्रिया थेट तुमच्या मायक्रोफोनमध्ये बोलू शकता (\"होय\" किंवा \"नाही\")."
  }
};


// Global helper to get language
function getLang() {
  let lang = localStorage.getItem("appLang");
  if (!lang) {
    // Fallback to user language in profile if logged in
    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        lang = user.language || "en";
      } catch (e) {
        lang = "en";
      }
    } else {
      lang = "en";
    }
  }
  return lang;
}

// Global helper to set language & translate page
async function setLang(lang) {
  if (!translations[lang]) lang = "en";
  localStorage.setItem("appLang", lang);
  
  // Try to sync to backend if user is logged in
  const token = localStorage.getItem("token");
  if (token) {
    try {
      // Sync language setting with DB
      const res = await fetch("/api/auth/language", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ language: lang })
      });
      if (res.ok) {
        // Also update local user object cached in localStorage
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          user.language = lang;
          localStorage.setItem("user", JSON.stringify(user));
        }
      }
    } catch (err) {
      console.warn("Could not sync language setting to backend database:", err);
    }
  }

  // Update switcher buttons UI selected state
  updateLangSwitcherUI(lang);

  // Apply translations to DOM elements
  applyTranslations(lang);
}

// Update flag/text buttons style state
function updateLangSwitcherUI(lang) {
  const btnEn = document.getElementById("langBtnEn");
  const btnHi = document.getElementById("langBtnHi");
  const btnMr = document.getElementById("langBtnMr");

  if (btnEn) btnEn.style.cssText = lang === "en" ? "font-weight: 800; background: var(--color-primary-dark); color: #fff; border: 2px solid var(--color-primary-dark); padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s;" : "background: transparent; color: var(--color-primary-dark); border: 2px solid var(--color-primary); padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s;";
  if (btnHi) btnHi.style.cssText = lang === "hi" ? "font-weight: 800; background: var(--color-primary-dark); color: #fff; border: 2px solid var(--color-primary-dark); padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s;" : "background: transparent; color: var(--color-primary-dark); border: 2px solid var(--color-primary); padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s;";
  if (btnMr) btnMr.style.cssText = lang === "mr" ? "font-weight: 800; background: var(--color-primary-dark); color: #fff; border: 2px solid var(--color-primary-dark); padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s;" : "background: transparent; color: var(--color-primary-dark); border: 2px solid var(--color-primary); padding: 4px 10px; border-radius: 6px; cursor: pointer; transition: all 0.2s;";
}

// Interpolation helper for variables like {name}
function t(key, vars = {}) {
  const lang = getLang();
  let text = translations[lang]?.[key] || translations["en"]?.[key] || key;
  Object.keys(vars).forEach(v => {
    text = text.replace(`{${v}}`, vars[v]);
  });
  return text;
}

// Walks DOM and applies translations
function applyTranslations(lang = getLang()) {
  const transDict = translations[lang] || translations["en"];
  const elements = document.querySelectorAll("[data-i18n]");
  elements.forEach(el => {
    const key = el.getAttribute("data-i18n");
    let text = transDict[key] || translations["en"][key];
    if (text) {
      // Check if it's an input with placeholder
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
        el.setAttribute("placeholder", text);
      } else {
        // Replace text content
        el.innerHTML = text;
      }
    }
  });

  // Also translate HTML lang attribute
  document.documentElement.setAttribute("lang", lang === "hi" ? "hi" : lang === "mr" ? "mr" : "en");
}

// Global initialization
document.addEventListener("DOMContentLoaded", () => {
  const currentLang = getLang();
  // Ensure the UI matches
  updateLangSwitcherUI(currentLang);
  // Apply translation strings
  applyTranslations(currentLang);
});
