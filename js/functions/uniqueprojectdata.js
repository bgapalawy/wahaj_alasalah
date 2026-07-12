

const notFoundColor ="#000000";
const default_color="#FFFFFF"
const notFoundStatusText = '(Not Found)';
const villaIDcounts = 590;
const notfoundtextcolor="White";
let SelectedConstuctionItem = "";
let SelectedConstuctionItemForFileName = "";
let SelectedConstuctionItemForpopup = "";
let SelectedConstuctionItemID = "";
let monitoringselectionvalue = "";
let Cuttoff_Day = 0;
let old_villaStatus="";
let old_villaStatusInvoice="";
let tooltip={};
const states = ["NotStarted", "NCR", "Notes", "Rejected", "Completed","Approval"];

const EXCLUDED_KEYS = new Set(['nameArabic', 'id', 'name', 'predecessors']);

let isFirstClick = true;
let activeColorMap = {};


let villaBlockStageMap = new Map();








const statusColorMap = {
  Completed: "#4CAF50", // Green
  Notes: "#a094ed", // Blue
  NCR: "#FFFF00", // yellow
  Rejected: "#F44336", // Red
  NotStarted: "#F2F2F2", // GREY
};
const statusColorMapsch = {
  Completed: "#4CAF50", // Green
  InProgress: "#a094ed", // Blue
  ready: "#FFFF00", // yellow
  blocked: "#F44336", // Red
  NotStarted: "#F2F2F2", // GREY
};

const statusColorMapInvoice = {
  Paid: "#4CAF50", // Green
  InProgress: "#a094ed", // Blue
  ReadyToPay: "#FFFF00", // yellow
  NotStarted: "#F2F2F2", // GREY
};



const generalColorPalette = {
  key1: "#FF5733", // red
  key2: "#33FF57", // green
  key3: "#a094ed", // blue
  key4: "#F1C40F", // yellow
  key5: "#8E44AD", // purple
  key6: "#E67E22", // orange
  key7: "#3498DB", // light blue
  key8: "#2ECC71", // light green
};
const colorPaletteArray = Object.values(generalColorPalette);
const statusColorMap2 = new Map(); // Maps status values to colors
let nextColorIndex = 0; // Track next color to assign

const generalchoose = {
  key1: "#FF5733", // red
  key2: "#33FF57", // green
  key3: "##a094ed", // blue
  key4: "#F1C40F", // yellow
  key5: "#8E44AD", // purple
  key6: "#E67E22", // orange
  key7: "#FFFFFF", // white
  key8: "#000000", // black
};

 const statusColorMaps = {
  default: statusColorMap,
  sch: statusColorMapsch,
  invoice: statusColorMapInvoice,
  general: generalColorPalette
};





// var imageAreas = document.querySelectorAll(".image-area");
var imageSize = 50; // Adjust image size limit in MB
var validExtensions = {
  image: ["jpg", "jpeg", "png", "gif"],
  pdf: ["pdf"],
  video: ["mp4", "mov", "avi"],
  word: ["doc", "docx"],
  excel: ["xls", "xlsx"],
  powerpoint: ["ppt", "pptx"],
  dwg: ["dwg"],
};





//


// Construction items data



const Civil = {
  1: ["Excavation&Compaction of Fondation", "الحفر ودمك الأساس"],
  2: ["Pouring Concrete For Bedding", "صب الخرسانة للفرشة"],
  3: ["Reinforcement Concrete For Foundation", "خرسانة مسلحة للأساس"],
  4: ["Steel Fixing& Carpenter work for Beams", "تركيب حديد ونجارة للكمرات"],
  5: ["Pouring Concrete For Beams", "صب الخرسانة للكمرات"],
  6: ["Bitmen Coating For Fondation&Beams", "طلاء بيتومين للأساس والكمرات"],
  7: ["Backfilling Inside Fondations", "ردم داخل الأساسات"],
  8: ["Steel Fixing& Carpenter work for Ground Slap", "تركيب حديد ونجارة للبلاطة الأرضية"],
  9: ["Anti Termite Treatment For Ground Slap", "معالجة ضد النمل الأبيض للبلاطة الأرضية"],
  10: ["Pouring Concrete For Ground Slap", "صب الخرسانة للبلاطة الأرضية"],
  11: ["Precast Constrction", "إنشاء مسبق الصنع"]
};
const Fence = {
  1: ["Pouring Bedding Concrete For Fence Fondations", "صب الخرسانة للفرشة لأساسات السور"],
  2: ["RC Concrete For Fence Fondations", "خرسانة مسلحة لأساسات السور"],
  3: ["Steel Fixing & Carpentry For Fence Columns", "تركيب حديد ونجارة لأعمدة السور"],
  4: ["Pouring Concrete For Fence Columns", "صب الخرسانة لأعمدة السور"],
  5: ["Installation Precast Panel For Fence", "تركيب ألواح مسبقة الصنع للسور"],
  6: ["Bitumen Coating For Fence Fondations", "طلاء بيتومين لأساسات السور"],
  7: ["Pouring Bedding Concrete For Front Fence Fondations", "صب الخرسانة للفرشة لأساسات السور الأمامي"],
  8: ["RC Concrete For Front Fence Fondations", "خرسانة مسلحة لأساسات السور الأمامي"],
  9: ["Steel Fixing & Carpentry For Front Fence Columns", "تركيب حديد ونجارة لأعمدة السور الأمامي"],
  10: ["Backfilling the Yard", "ردم الفناء"],
  11: ["Pouring Concrete Wall Of Front Fence Columns", "صب الخرسانة لجدار أعمدة السور الأمامي"],
  12: ["Pouring Concrete Crown Of Front Fence Columns", "صب الخرسانة لتاج أعمدة السور الأمامي"],
  13: ["Pouring Concrete Flower Basin Of Front Fence Columns", "صب الخرسانة لحوض الزهور لأعمدة السور الأمامي"],
  14: ["Antitermite Treatment For Yard", "معالجة ضد النمل الأبيض للفناء"],
  15: ["Pouring Concrete For Yard", "صب الخرسانة للفناء"],
  16: ["Painting The Base Surface Of The Fence", "دهان السطح الأساسي للسور"],
  17: ["Painting The Final Face Of The Fence", "دهان الوجه النهائي للسور"]
};
const Architectural = {
  1: ["Block Work For GF & Estabishment 1F", "بناء الطابق الأرضي والأول"],
  2: ["Screed Work For 1F & Roof", "أعمال التسوية للطابق الأول والسقف"],
  3: ["Block Works For 1F", "بناء الطابق الأول"],
  4: ["Thermal Insulation For Roof", "عزل حراري للسقف"],
  5: ["Roof Floor Tiles", "بلاط الأسطح"],
  6: ["Plaster Work For Villa", "لياسة الفيلا"],
  7: ["Marbale Stairs & Handrails", "السلالم الرخامية والدرابزين"],
  8: ["Water Proofing Of Bathrooms", "عزل مائي للحمامات"],
  9: ["Bathroom Tiles", "بلاط الحمامات"],
  10: ["Structure For Gypsum", "هيكل الجبس"],
  11: ["Gypsum Board For Room", "ألواح الجبس للغرف"],
  12: ["Installation Of Gypsum Board For Bathroom & Kitchen", "تركيب ألواح الجبس للحمام والمطبخ"],
  13: ["Putty Filler For Gypsm Board Ceiling", "معجون سقف ألواح الجبس"],
  14: ["Fixing Shower Glass", "تركيب زجاج الحمام"],
  15: ["Interior Wall Putty Filler", "معجون الجدران الداخلية"],
  16: ["1st Face Paint", "الدهان الأولي"],
  17: ["Installation Of Aluminum Windows", "تركيب نوافذ الألمنيوم"],
  18: ["Installation Of Parquet", "تركيب الباركيه"],
  19: ["Installation Of Wooden Doors", "تركيب الأبواب الخشبية"],
  20: ["Final Face Paint", "الدهان النهائي"],
  21: ["Bardoura Works For Yard", "أعمال الباردورا للفناء"],
  22: ["Block Work For Flower Basin", "بناء حوض الزهور"],
  23: ["Plastering Work For Flower Basin", "لياسة حوض الزهور"],
  24: ["Interlock Works For The Yard", "أعمال الإنترلوك للفناء"],
  25: ["External Grading Works For The Villa", "أعمال التسوية الخارجية للفيلا"],
  26: ["Installation The Exterior Door & Garage Door", "تركيب الباب الخارجي وباب الجراج"],
  27: ["Granite Surronds Around The Villa", "أعمال الجرانيت حول الفيلا"],
  28: ["Exterior Painting Of The Villa", "دهان الواجهة الخارجية للفيلا"],
  29: ["Pardora Works For The External Sidewalk", "أعمال الباردورا للرصيف الخارجي"],
  30: ["Interlock Works For The Exerrnal Sidewalk", "أعمال الإنترلوك للرصيف الخارجي"],
  31: ["Arch Snaglist & Handover", "قائمة الأعمال المتبقية وتسليمها"],
  32: ["Final Handover Of The Villa To The Consltant", "التسليم النهائي للفيلا للعميل"],
  33: ["Customer Delivery", "تسليم العميل"]
};
const Mechanical = {
  1: ["Mech&Elec Establishment for Beams", "التأسيس الميكانيكي والكهربائي للكمرات"],
  2: ["Mech Works Under Grond Slap", "أعمال ميكانيكية تحت البلاطة الأرضية"],
  3: ["L.L & H.L Drainage", "صرف الدور الارضي والعلوي"],
  4: ["Water Tank & Heater Foundations", "أساسات خزان المياه والسخان"],
  5: ["Water Line Network", "شبكة خطوط المياه"],
  6: ["Installation Of Sanitry Fixture", "تركيب الأدوات الصحية"],
  7: ["Installation Of Water Tank-Heater & Pumps", "تركيب خزان المياه والسخان والمضخات"],
  8: ["Outdoor Drainage & Water Line", "صرف المياه الخارجي وخطوط المياه"],
  9: ["Fixing Floor Drain For The Yard", "تركيب الصرف للفناء"],
  10: ["Connection The Drain To The Piblic Network", "ربط الصرف والمياه بالشبكة العامة"],
  11: ["Mech Work Testing & Handover", "اختبار الأعمال الميكانيكية وتسليمها"]
};
const Electerical = {
  1: ["Elec Establishment For GF & 1F", "التأسيس الكهربائي للطابق الأرضي والأول"],
  2: ["Continue Elec Establishment For GF & 1F", "استكمال التأسيس الكهربائي للطابق الأرضي والأول"],
  3: ["Pulling The Elec Wires", "سحب الأسلاك الكهربائية"],
  4: ["Installation Of Elec Fixture & Accessories", "تركيب الأدوات الكهربائية والملحقات"],
  5: ["Establishing Elec For Fence Columns", "التأسيس الكهربائي لأعمدة السور"],
  6: ["Establishing Elec For Front Fence Columns", "التأسيس الكهربائي لأعمدة السور الأمامي"],
  7: ["Establishing Elec For Fence & Yard", "التأسيس الكهربائي للسور والفناء"],
  8: ["Installation Elec Fixtures & Accessories For The Yard", "تركيب الأدوات الكهربائية والملحقات للفناء"],
  9: ["Pulling The Villa's Main Elec Cable", "سحب الكابل الكهربائي الرئيسي للفيلا"],
  10: ["ElecWork Testing & Handover", "اختبار الأعمال الكهربائية وتسليمها"]
};
const activities = [
  {
    id: 1,
    name: "Civil - Excavation&Compaction of Fondation",
    nameArabic: "انشائي - الحفر ودمك الأساس",
    predecessors: [],
    status: "NotStarted",
    TableItemID: "Civil-1",
  },
  {
    id: 2,
    name: "Civil - Pouring Concrete For Bedding",
    nameArabic: "انشائي - صب الخرسانة للفرشة",
    predecessors: [1],
    status: "NotStarted",
    TableItemID: "Civil-2",
  },
  {
    id: 3,
    name: "Civil - Reinforcement Concrete For Foundation",
    nameArabic: "انشائي - خرسانة مسلحة للأساس",
    predecessors: [2],
    status: "NotStarted",
    TableItemID: "Civil-3",
  },
  {
    id: 4,
    name: "Civil - Steel Fixing& Carpenter work for Beams",
    nameArabic: "انشائي - تركيب حديد ونجارة للكمرات",
    predecessors: [3],
    status: "NotStarted",
    TableItemID: "Civil-4",
  },
  {
    id: 5,
    name: "Mechanical - Mech&Elec Establishment for Beams",
    nameArabic: "ميكانيك - التأسيس الميكانيكي والكهربائي للكمرات",
    predecessors: [4],
    status: "NotStarted",
    TableItemID: "Mechanical-1",
  },
  {
    id: 6,
    name: "Civil - Pouring Concrete For Beams",
    nameArabic: "انشائي - صب الخرسانة للكمرات",
    predecessors: [5],
    status: "NotStarted",
    TableItemID: "Civil-5",
  },
  {
    id: 7,
    name: "Civil - Bitmen Coating For Fondation&Beams",
    nameArabic: "انشائي - طلاء بيتومين للأساس والكمرات",
    predecessors: [6],
    status: "NotStarted",
    TableItemID: "Civil-6",
  },
  {
    id: 8,
    name: "Civil - Backfilling Inside Fondations",
    nameArabic: "انشائي - ردم داخل الأساسات",
    predecessors: [7],
    status: "NotStarted",
    TableItemID: "Civil-7",
  },
  {
    id: 9,
    name: "Mechanical - Mech Works Under Grond Slap",
    nameArabic: "ميكانيك - أعمال ميكانيكية تحت البلاطة الأرضية",
    predecessors: [8],
    status: "NotStarted",
    TableItemID: "Mechanical-2",
  },
  {
    id: 10,
    name: "Civil - Steel Fixing& Carpenter work for Ground Slap",
    nameArabic: "انشائي - تركيب حديد ونجارة للبلاطة الأرضية",
    predecessors: [9],
    status: "NotStarted",
    TableItemID: "Civil-8",
  },
  {
    id: 11,
    name: "Civil - Anti Termite Treatment For Ground Slap",
    nameArabic: "انشائي - معالجة ضد النمل الأبيض للبلاطة الأرضية",
    predecessors: [10],
    status: "NotStarted",
    TableItemID: "Civil-9",
  },
  {
    id: 12,
    name: "Civil - Pouring Concrete For Ground Slap",
    nameArabic: "انشائي - صب الخرسانة للبلاطة الأرضية",
    predecessors: [11, 10],
    status: "NotStarted",
    TableItemID: "Civil-10",
  },
  {
    id: 13,
    name: "Civil - Precast Constrction",
    nameArabic: "انشائي - إنشاء مسبق الصنع",
    predecessors: [12],
    status: "NotStarted",
    TableItemID: "Civil-11",
  },
  {
    id: 14,
    name: "Architectural - Block Work For GF & Estabishment 1F",
    nameArabic: "معماري - بناء الطابق الأرضي والأول",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Architectural-1",
  },
  {
    id: 15,
    name: "Mechanical - L.L & H.L Drainage",
    nameArabic: "ميكانيك - صرف الدور الارضي والعلوي",
    predecessors: [14],
    status: "NotStarted",
    TableItemID: "Mechanical-3",
  },
  {
    id: 16,
    name: "Electerical - Elec Establishment For GF & 1F",
    nameArabic: "كهرباء - التأسيس الكهربائي للطابق الأرضي والأول",
    predecessors: [14],
    status: "NotStarted",
    TableItemID: "Electerical-1",
  },
  {
    id: 17,
    name: "Architectural - Screed Work For 1F & Roof",
    nameArabic: "معماري - أعمال التسوية للطابق الأول والسقف",
    predecessors: [15, 16],
    status: "NotStarted",
    TableItemID: "Architectural-2",
  },
  {
    id: 18,
    name: "Mechanical - Water Tank & Heater Foundations",
    nameArabic: "ميكانيك - أساسات خزان المياه والسخان",
    predecessors: [17],
    status: "NotStarted",
    TableItemID: "Mechanical-4",
  },
  {
    id: 19,
    name: "Architectural - Block Works For 1F",
    nameArabic: "معماري - بناء الطابق الأول",
    predecessors: [17],
    status: "NotStarted",
    TableItemID: "Architectural-3",
  },
  {
    id: 20,
    name: "Mechanical - Water Line Network",
    nameArabic: "ميكانيك - شبكة خطوط المياه",
    predecessors: [19],
    status: "NotStarted",
    TableItemID: "Mechanical-5",
  },
  {
    id: 21,
    name: "Electerical - Continue Elec Establishment For GF & 1F",
    nameArabic: "كهرباء - استكمال التأسيس الكهربائي للطابق الأرضي والأول",
    predecessors: [19],
    status: "NotStarted",
    TableItemID: "Electerical-2",
  },
  {
    id: 22,
    name: "Architectural - Thermal Insulation For Roof",
    nameArabic: "معماري - عزل حراري للسقف",
    predecessors: [18],
    status: "NotStarted",
    TableItemID: "Architectural-4",
  },
  {
    id: 23,
    name: "Architectural - Roof Floor Tiles",
    nameArabic: "معماري - بلاط الأسطح",
    predecessors: [22],
    status: "NotStarted",
    TableItemID: "Architectural-5",
  },
  {
    id: 24,
    name: "Architectural - Plaster Work For Villa",
    nameArabic: "معماري - لياسة الفيلا",
    predecessors: [20, 21],
    status: "NotStarted",
    TableItemID: "Architectural-6",
  },
  {
    id: 25,
    name: "Architectural - Marbale Stairs & Handrails",
    nameArabic: "معماري - السلالم الرخامية والدرابزين",
    predecessors: [24],
    status: "NotStarted",
    TableItemID: "Architectural-7",
  },
  {
    id: 26,
    name: "Architectural - Water Proofing Of Bathrooms",
    nameArabic: "معماري - عزل مائي للحمامات",
    predecessors: [24],
    status: "NotStarted",
    TableItemID: "Architectural-8",
  },
  {
    id: 27,
    name: "Electerical - Pulling The Elec Wires",
    nameArabic: "كهرباء - سحب الأسلاك الكهربائية",
    predecessors: [24],
    status: "NotStarted",
    TableItemID: "Electerical-3",
  },
  {
    id: 28,
    name: "Architectural - Bathroom Tiles",
    nameArabic: "معماري - بلاط الحمامات",
    predecessors: [26, 23],
    status: "NotStarted",
    TableItemID: "Architectural-9",
  },
  {
    id: 29,
    name: "Architectural - Structure For Gypsum",
    nameArabic: "معماري - هيكل الجبس",
    predecessors: [28],
    status: "NotStarted",
    TableItemID: "Architectural-10",
  },
  {
    id: 30,
    name: "Architectural - Gypsum Board For Room",
    nameArabic: "معماري - ألواح الجبس للغرف",
    predecessors: [29, 27],
    status: "NotStarted",
    TableItemID: "Architectural-11",
  },
  {
    id: 31,
    name: "Architectural - Installation Of Gypsum Board For Bathroom & Kitchen",
    nameArabic: "معماري - تركيب ألواح الجبس للحمام والمطبخ",
    predecessors: [30],
    status: "NotStarted",
    TableItemID: "Architectural-12",
  },
  {
    id: 32,
    name: "Architectural - Putty Filler For Gypsm Board Ceiling",
    nameArabic: "معماري - معجون سقف ألواح الجبس",
    predecessors: [31],
    status: "NotStarted",
    TableItemID: "Architectural-13",
  },
  {
    id: 33,
    name: "Architectural - Fixing Shower Glass",
    nameArabic: "معماري - تركيب زجاج الحمام",
    predecessors: [32],
    status: "NotStarted",
    TableItemID: "Architectural-14",
  },
  {
    id: 34,
    name: "Architectural - Interior Wall Putty Filler",
    nameArabic: "معماري - معجون الجدران الداخلية",
    predecessors: [32, 25],
    status: "NotStarted",
    TableItemID: "Architectural-15",
  },
  {
    id: 35,
    name: "Mechanical - Installation Of Sanitry Fixture",
    nameArabic: "ميكانيك - تركيب الأدوات الصحية",
    predecessors: [33],
    status: "NotStarted",
    TableItemID: "Mechanical-6",
  },
  {
    id: 36,
    name: "Architectural - 1st Face Paint",
    nameArabic: "معماري - الدهان الأولي",
    predecessors: [34],
    status: "NotStarted",
    TableItemID: "Architectural-16",
  },
  {
    id: 37,
    name: "Architectural - Installation Of Aluminum Windows",
    nameArabic: "معماري - تركيب نوافذ الألمنيوم",
    predecessors: [34],
    status: "NotStarted",
    TableItemID: "Architectural-17",
  },
  {
    id: 38,
    name: "Electerical - Installation Of Elec Fixture & Accessories",
    nameArabic: "كهرباء - تركيب الأدوات الكهربائية والملحقات",
    predecessors: [32, 34, 27],
    status: "NotStarted",
    TableItemID: "Electerical-4",
  },
  {
    id: 39,
    name: "Mechanical - Installation Of Water Tank-Heater & Pumps",
    nameArabic: "ميكانيك - تركيب خزان المياه والسخان والمضخات",
    predecessors: [35, 23],
    status: "NotStarted",
    TableItemID: "Mechanical-7",
  },
  {
    id: 40,
    name: "Architectural - Installation Of Parquet",
    nameArabic: "معماري - تركيب الباركيه",
    predecessors: [36],
    status: "NotStarted",
    TableItemID: "Architectural-18",
  },
  {
    id: 41,
    name: "Architectural - Installation Of Wooden Doors",
    nameArabic: "معماري - تركيب الأبواب الخشبية",
    predecessors: [40],
    status: "NotStarted",
    TableItemID: "Architectural-19",
  },
  {
    id: 42,
    name: "Architectural - Final Face Paint",
    nameArabic: "معماري - الدهان النهائي",
    predecessors: [37, 41],
    status: "NotStarted",
    TableItemID: "Architectural-20",
  },
  {
    id: 43,
    name: "Fence - Pouring Bedding Concrete For Fence Fondations",
    nameArabic: "سور - صب الخرسانة للفرشة لأساسات السور",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Fence-1",
  },
  {
    id: 44,
    name: "Fence - RC Concrete For Fence Fondations",
    nameArabic: "سور - خرسانة مسلحة لأساسات السور",
    predecessors: [43],
    status: "NotStarted",
    TableItemID: "Fence-2",
  },
  {
    id: 45,
    name: "Fence - Steel Fixing & Carpentry For Fence Columns",
    nameArabic: "سور - تركيب حديد ونجارة لأعمدة السور",
    predecessors: [44],
    status: "NotStarted",
    TableItemID: "Fence-3",
  },
  {
    id: 46,
    name: "Electerical - Establishing Elec For Fence Columns",
    nameArabic: "كهرباء - التأسيس الكهربائي لأعمدة السور",
    predecessors: [45],
    status: "NotStarted",
    TableItemID: "Electerical-5",
  },
  {
    id: 47,
    name: "Fence - Pouring Concrete For Fence Columns",
    nameArabic: "سور - صب الخرسانة لأعمدة السور",
    predecessors: [46],
    status: "NotStarted",
    TableItemID: "Fence-4",
  },
  {
    id: 48,
    name: "Fence - Installation Precast Panel For Fence",
    nameArabic: "سور - تركيب ألواح مسبقة الصنع للسور",
    predecessors: [47],
    status: "NotStarted",
    TableItemID: "Fence-5",
  },
  {
    id: 49,
    name: "Fence - Bitumen Coating For Fence Fondations",
    nameArabic: "سور - طلاء بيتومين لأساسات السور",
    predecessors: [48],
    status: "NotStarted",
    TableItemID: "Fence-6",
  },
  {
    id: 50,
    name: "Fence - Pouring Bedding Concrete For Front Fence Fondations",
    nameArabic: "سور - صب الخرسانة للفرشة لأساسات السور الأمامي",
    predecessors: [48],
    status: "NotStarted",
    TableItemID: "Fence-7",
  },
  {
    id: 51,
    name: "Fence - RC Concrete For Front Fence Fondations",
    nameArabic: "سور - خرسانة مسلحة لأساسات السور الأمامي",
    predecessors: [50],
    status: "NotStarted",
    TableItemID: "Fence-8",
  },
  {
    id: 52,
    name: "Mechanical - Outdoor Drainage & Water Line",
    nameArabic: "ميكانيك - صرف المياه الخارجي وخطوط المياه",
    predecessors: [49, 15],
    status: "NotStarted",
    TableItemID: "Mechanical-8",
  },
  {
    id: 53,
    name: "Fence - Steel Fixing & Carpentry For Front Fence Columns",
    nameArabic: "سور - تركيب حديد ونجارة لأعمدة السور الأمامي",
    predecessors: [51],
    status: "NotStarted",
    TableItemID: "Fence-9",
  },
  {
    id: 54,
    name: "Electerical - Establishing Elec For Front Fence Columns",
    nameArabic: "كهرباء - التأسيس الكهربائي لأعمدة السور الأمامي",
    predecessors: [53],
    status: "NotStarted",
    TableItemID: "Electerical-6",
  },
  {
    id: 55,
    name: "Electerical - Establishing Elec For Fence & Yard",
    nameArabic: "كهرباء - التأسيس الكهربائي للسور والفناء",
    predecessors: [52],
    status: "NotStarted",
    TableItemID: "Electerical-7",
  },
  {
    id: 56,
    name: "Fence - Backfilling the Yard",
    nameArabic: "سور - ردم الفناء",
    predecessors: [55],
    status: "NotStarted",
    TableItemID: "Fence-10",
  },
  {
    id: 57,
    name: "Fence - Pouring Concrete Wall Of Front Fence Columns",
    nameArabic: "سور - صب الخرسانة لجدار أعمدة السور الأمامي",
    predecessors: [54],
    status: "NotStarted",
    TableItemID: "Fence-11",
  },
  {
    id: 58,
    name: "Fence - Pouring Concrete Crown Of Front Fence Columns",
    nameArabic: "سور - صب الخرسانة لتاج أعمدة السور الأمامي",
    predecessors: [57],
    status: "NotStarted",
    TableItemID: "Fence-12",
  },
  {
    id: 59,
    name: "Architectural - Bardoura Works For Yard",
    nameArabic: "معماري - أعمال الباردورا للفناء",
    predecessors: [56],
    status: "NotStarted",
    TableItemID: "Architectural-21",
  },
  {
    id: 60,
    name: "Fence - Pouring Concrete Flower Basin Of Front Fence Columns",
    nameArabic: "سور - صب الخرسانة لحوض الزهور لأعمدة السور الأمامي",
    predecessors: [58],
    status: "NotStarted",
    TableItemID: "Fence-13",
  },
  {
    id: 61,
    name: "Fence - Antitermite Treatment For Yard",
    nameArabic: "سور - معالجة ضد النمل الأبيض للفناء",
    predecessors: [59],
    status: "NotStarted",
    TableItemID: "Fence-14",
  },
  {
    id: 62,
    name: "Fence - Pouring Concrete For Yard",
    nameArabic: "سور - صب الخرسانة للفناء",
    predecessors: [61],
    status: "NotStarted",
    TableItemID: "Fence-15",
  },
  {
    id: 63,
    name: "Architectural - Block Work For Flower Basin",
    nameArabic: "معماري - بناء حوض الزهور",
    predecessors: [62],
    status: "NotStarted",
    TableItemID: "Architectural-22",
  },
  {
    id: 64,
    name: "Architectural - Plastering Work For Flower Basin",
    nameArabic: "معماري - لياسة حوض الزهور",
    predecessors: [63],
    status: "NotStarted",
    TableItemID: "Architectural-23",
  },
  {
    id: 65,
    name: "Architectural - Interlock Works For The Yard",
    nameArabic: "معماري - أعمال الإنترلوك للفناء",
    predecessors: [64],
    status: "NotStarted",
    TableItemID: "Architectural-24",
  },
  {
    id: 66,
    name: "Architectural - External Grading Works For The Villa",
    nameArabic: "معماري - أعمال التسوية الخارجية للفيلا",
    predecessors: [65],
    status: "NotStarted",
    TableItemID: "Architectural-25",
  },
  {
    id: 67,
    name: "Architectural - Installation The Exterior Door & Garage Door",
    nameArabic: "معماري - تركيب الباب الخارجي وباب الجراج",
    predecessors: [65],
    status: "NotStarted",
    TableItemID: "Architectural-26",
  },
  {
    id: 68,
    name: "Mechanical - Fixing Floor Drain For The Yard",
    nameArabic: "ميكانيك - تركيب الصرف للفناء",
    predecessors: [65],
    status: "NotStarted",
    TableItemID: "Mechanical-9",
  },
  {
    id: 69,
    name: "Architectural - Granite Surronds Around The Villa",
    nameArabic: "معماري - أعمال الجرانيت حول الفيلا",
    predecessors: [66],
    status: "NotStarted",
    TableItemID: "Architectural-27",
  },
  {
    id: 70,
    name: "Fence - Painting The Base Surface Of The Fence",
    nameArabic: "سور - دهان السطح الأساسي للسور",
    predecessors: [76],
    status: "NotStarted",
    TableItemID: "Fence-16",
  },
  {
    id: 71,
    name: "Fence - Painting The Final Face Of The Fence",
    nameArabic: "سور - دهان الوجه النهائي للسور",
    predecessors: [70],
    status: "NotStarted",
    TableItemID: "Fence-17",
  },
  {
    id: 72,
    name: "Architectural - Exterior Painting Of The Villa",
    nameArabic: "معماري - دهان الواجهة الخارجية للفيلا",
    predecessors: [69, 71, 67, 68],
    status: "NotStarted",
    TableItemID: "Architectural-28",
  },
  {
    id: 73,
    name: "Electerical - Installation Elec Fixtures & Accessories For The Yard",
    nameArabic: "كهرباء - تركيب الأدوات الكهربائية والملحقات للفناء",
    predecessors: [71, 72],
    status: "NotStarted",
    TableItemID: "Electerical-8",
  },
  {
    id: 74,
    name: "Mechanical - Connection The Drain To The Piblic Network",
    nameArabic: "ميكانيك - ربط الصرف والمياه بالشبكة العامة",
    predecessors: [52, 60],
    status: "NotStarted",
    TableItemID: "Mechanical-10",
  },
  {
    id: 75,
    name: "Architectural - Pardora Works For The External Sidewalk",
    nameArabic: "معماري - أعمال الباردورا للرصيف الخارجي",
    predecessors: [65, 74],
    status: "NotStarted",
    TableItemID: "Architectural-29",
  },
  {
    id: 76,
    name: "Architectural - Interlock Works For The Exerrnal Sidewalk",
    nameArabic: "معماري - أعمال الإنترلوك للرصيف الخارجي",
    predecessors: [75],
    status: "NotStarted",
    TableItemID: "Architectural-30",
  },
  {
    id: 77,
    name: "Electerical - Pulling The Villa's Main Elec Cable",
    nameArabic: "كهرباء - سحب الكابل الكهربائي الرئيسي للفيلا",
    predecessors: [76, 73],
    status: "NotStarted",
    TableItemID: "Electerical-9",
  },
  {
    id: 78,
    name: "Mechanical - Mech Work Testing & Handover",
    nameArabic: "ميكانيك - اختبار الأعمال الميكانيكية وتسليمها",
    predecessors: [74, 35, 39],
    status: "NotStarted",
    TableItemID: "Mechanical-11",
  },
  {
    id: 79,
    name: "Architectural - Arch Snaglist & Handover",
    nameArabic: "معماري - قائمة الأعمال المتبقية وتسليمها",
    predecessors: [76, 72, 41],
    status: "NotStarted",
    TableItemID: "Architectural-31",
  },
  {
    id: 80,
    name: "Electerical - ElecWork Testing & Handover",
    nameArabic: "كهرباء - اختبار الأعمال الكهربائية وتسليمها",
    predecessors: [77, 38],
    status: "NotStarted",
    TableItemID: "Electerical-10",
  },
  {
    id: 81,
    name: "Architectural - Final Handover Of The Villa To The Consltant",
    nameArabic: "معماري - التسليم النهائي للفيلا للعميل",
    predecessors: [79, 80, 78, 42],
    status: "NotStarted",
    TableItemID: "Architectural-32",
  },
  {
    id: 82,
    name: "Architectural - Customer Delivery",
    nameArabic: "معماري - تسليم العميل",
    predecessors: [81],
    status: "NotStarted",
    TableItemID: "Architectural-33",
  },
];