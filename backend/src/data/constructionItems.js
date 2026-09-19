// constructionItems.js
//
// Rebuilt from the WAHJ Alasalah baseline P6 schedule (single-villa granularity):
// each activity below corresponds to one step in the real, validated per-villa/
// per-block construction sequence used in the baseline XER, including the
// corrected logic reviewed during scheduling (Sept 2026):
//   - Backfilling runs independently of Columns & RC Frame (columns are cast
//     from the footings; backfill happens in parallel afterwards, not before)
//   - Roof Waterproofing and Wet Area Waterproofing run in parallel (no real
//     site dependency between roof-level and internal wet-area work)
//   - External Works (boundary fence/paving/landscape) starts right after
//     Backfilling and finishes independently of the villa's own MEP/finishes chain
//
// Categories map to the schedule's trade groups:
//   Civil          -> Substructure (SUB) + Superstructure (SUP)
//   Architectural  -> Openings (OPEN) + Finishes (FIN) + final handover
//   Mechanical     -> Plumbing (PLUMB) + HVAC
//   Electerical    -> Electrical (ELEC) + Communications (COMM) + Security (SEC)
//   Fence          -> External Works (EXT)
//
// predecessors use this file's own `id`, matching the TableItemID scheme
// used elsewhere in the app.

export const constructionItems = [
  // ---------- Substructure (Civil) ----------
  {
    id: 1,
    name: "Civil - Excavation to Formation Level",
    nameArabic: "انشائي - الحفر حتى منسوب التأسيس",
    predecessors: [],
    status: "NotStarted",
    TableItemID: "Civil-1",
  },
  {
    id: 2,
    name: "Civil - Anti-Termite Treatment & PCC Blinding",
    nameArabic: "انشائي - معالجة مضادة للنمل الأبيض وخرسانة نظافة",
    predecessors: [1],
    status: "NotStarted",
    TableItemID: "Civil-2",
  },
  {
    id: 3,
    name: "Civil - Strip Footing & Plinth Wall",
    nameArabic: "انشائي - القواعد الشريطية وحائط القاعدة",
    predecessors: [2],
    status: "NotStarted",
    TableItemID: "Civil-3",
  },
  {
    id: 4,
    name: "Civil - Raft Slab",
    nameArabic: "انشائي - البلاطة الأساسية",
    predecessors: [3],
    status: "NotStarted",
    TableItemID: "Civil-4",
  },
  {
    id: 5,
    name: "Civil - Edge Beam",
    nameArabic: "انشائي - عتب الحافة",
    predecessors: [4],
    status: "NotStarted",
    TableItemID: "Civil-5",
  },

  // ---------- Superstructure (Civil) - Columns run right after Edge Beam ----------
  {
    id: 6,
    name: "Civil - Columns & RC Frame (Aluminum Formwork System)",
    nameArabic: "انشائي - الأعمدة والإطار الخرساني (شدة الألومنيوم)",
    predecessors: [5],
    status: "NotStarted",
    TableItemID: "Civil-6",
  },
  {
    id: 7,
    name: "Civil - Backfilling & Compaction",
    nameArabic: "انشائي - الردم والدمك",
    predecessors: [5],
    status: "NotStarted",
    TableItemID: "Civil-7",
  },
  {
    id: 8,
    name: "Civil - Structural Screed & Beams",
    nameArabic: "انشائي - الميدة الإنشائية والكمرات",
    predecessors: [6],
    status: "NotStarted",
    TableItemID: "Civil-8",
  },
  {
    id: 9,
    name: "Civil - RC Slab Casting",
    nameArabic: "انشائي - صب البلاطة الخرسانية",
    predecessors: [8],
    status: "NotStarted",
    TableItemID: "Civil-9",
  },
  {
    id: 10,
    name: "Civil - RC Wall Casting - External",
    nameArabic: "انشائي - صب الحوائط الخرسانية الخارجية",
    predecessors: [9],
    status: "NotStarted",
    TableItemID: "Civil-10",
  },
  {
    id: 11,
    name: "Civil - RC Wall Casting - Internal",
    nameArabic: "انشائي - صب الحوائط الخرسانية الداخلية",
    predecessors: [10],
    status: "NotStarted",
    TableItemID: "Civil-11",
  },
  {
    id: 12,
    name: "Civil - Cast-in-Situ Stairs",
    nameArabic: "انشائي - السلالم المصبوبة موقعياً",
    predecessors: [11],
    status: "NotStarted",
    TableItemID: "Civil-12",
  },
  {
    id: 13,
    name: "Civil - Roof Parapet Structural Finishing",
    nameArabic: "انشائي - تشطيب باراپيت السطح الإنشائي",
    predecessors: [12],
    status: "NotStarted",
    TableItemID: "Civil-13",
  },

  // ---------- Thermal / Waterproofing - run in PARALLEL (no site dependency) ----------
  {
    id: 14,
    name: "Civil - Roof Waterproofing & Insulation",
    nameArabic: "انشائي - عزل السطح المائي والحراري",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Civil-14",
  },
  {
    id: 15,
    name: "Civil - Wet Area Waterproofing",
    nameArabic: "انشائي - عزل الحمامات المائي",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Civil-15",
  },

  // ---------- Openings (Architectural) - parallel with waterproofing ----------
  {
    id: 16,
    name: "Architectural - Door Frames Installation",
    nameArabic: "معماري - تركيب براويز الأبواب",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Architectural-1",
  },
  {
    id: 17,
    name: "Architectural - Window Frames Installation",
    nameArabic: "معماري - تركيب براويز الشبابيك",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Architectural-2",
  },
  {
    id: 18,
    name: "Architectural - Ironmongery",
    nameArabic: "معماري - الأدوات المعدنية والأقفال",
    predecessors: [16, 17],
    status: "NotStarted",
    TableItemID: "Architectural-3",
  },

  // ---------- MEP First Fix - parallel with waterproofing/openings ----------
  {
    id: 19,
    name: "Mechanical - MEP First Fix - Plumbing",
    nameArabic: "ميكانيك - التأسيس الأول للسباكة",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Mechanical-1",
  },
  {
    id: 20,
    name: "Mechanical - MEP First Fix - HVAC Ductwork",
    nameArabic: "ميكانيك - التأسيس الأول لمجاري التكييف",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Mechanical-2",
  },
  {
    id: 21,
    name: "Electerical - MEP First Fix - Conduits & Wiring",
    nameArabic: "كهرباء - التأسيس الأول للمواسير والأسلاك",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Electerical-1",
  },

  // ---------- Finishes (Architectural) - gated on ALL of the above parallel work ----------
  {
    id: 22,
    name: "Architectural - Plaster & Screed",
    nameArabic: "معماري - المحارة والتسوية",
    predecessors: [14, 15, 18, 19, 20, 21],
    status: "NotStarted",
    TableItemID: "Architectural-4",
  },
  {
    id: 23,
    name: "Architectural - Wall Tiling",
    nameArabic: "معماري - تكسية الحوائط",
    predecessors: [22],
    status: "NotStarted",
    TableItemID: "Architectural-5",
  },
  {
    id: 24,
    name: "Architectural - Floor Tiling",
    nameArabic: "معماري - تكسية الأرضيات",
    predecessors: [23],
    status: "NotStarted",
    TableItemID: "Architectural-6",
  },
  {
    id: 25,
    name: "Architectural - Painting",
    nameArabic: "معماري - الدهانات",
    predecessors: [24],
    status: "NotStarted",
    TableItemID: "Architectural-7",
  },
  {
    id: 26,
    name: "Architectural - Fixtures, Fittings & Specialty Items",
    nameArabic: "معماري - التجهيزات والتركيبات والعناصر الخاصة",
    predecessors: [25],
    status: "NotStarted",
    TableItemID: "Architectural-8",
  },

  // ---------- MEP Second Fix - run in parallel after Finishes ----------
  {
    id: 27,
    name: "Mechanical - Second Fix - Water Supply Piping",
    nameArabic: "ميكانيك - التأسيس الثاني لخطوط المياه",
    predecessors: [26],
    status: "NotStarted",
    TableItemID: "Mechanical-3",
  },
  {
    id: 28,
    name: "Mechanical - Second Fix - Drainage Piping",
    nameArabic: "ميكانيك - التأسيس الثاني للصرف",
    predecessors: [26],
    status: "NotStarted",
    TableItemID: "Mechanical-4",
  },
  {
    id: 29,
    name: "Mechanical - Second Fix - Sanitary Fixtures",
    nameArabic: "ميكانيك - تركيب الأدوات الصحية",
    predecessors: [27, 28],
    status: "NotStarted",
    TableItemID: "Mechanical-5",
  },
  {
    id: 30,
    name: "Mechanical - HVAC Testing & Commissioning",
    nameArabic: "ميكانيك - اختبار وتشغيل التكييف",
    predecessors: [26],
    status: "NotStarted",
    TableItemID: "Mechanical-6",
  },
  {
    id: 31,
    name: "Electerical - Second Fix - Distribution Panels",
    nameArabic: "كهرباء - تركيب لوحات التوزيع",
    predecessors: [26],
    status: "NotStarted",
    TableItemID: "Electerical-2",
  },
  {
    id: 32,
    name: "Electerical - Second Fix - Switches & Fittings",
    nameArabic: "كهرباء - تركيب المفاتيح والتجهيزات",
    predecessors: [31],
    status: "NotStarted",
    TableItemID: "Electerical-3",
  },
  {
    id: 33,
    name: "Electerical - Communications - Data/TV",
    nameArabic: "كهرباء - تمديدات الاتصالات والتلفزيون",
    predecessors: [26],
    status: "NotStarted",
    TableItemID: "Electerical-4",
  },
  {
    id: 34,
    name: "Electerical - Fire Alarm & Security Systems (CCTV)",
    nameArabic: "كهرباء - أنظمة الإنذار والأمان (كاميرات المراقبة)",
    predecessors: [26],
    status: "NotStarted",
    TableItemID: "Electerical-5",
  },

  // ---------- External Works (Fence) - starts right after Backfilling, independent chain ----------
  {
    id: 35,
    name: "Fence - Boundary Fence & Gate",
    nameArabic: "سور - السور الخارجي والبوابة",
    predecessors: [7],
    status: "NotStarted",
    TableItemID: "Fence-1",
  },
  {
    id: 36,
    name: "Fence - External Paving",
    nameArabic: "سور - رصف الأرضيات الخارجية",
    predecessors: [35],
    status: "NotStarted",
    TableItemID: "Fence-2",
  },
  {
    id: 37,
    name: "Fence - Landscape & Softscape",
    nameArabic: "سور - أعمال تنسيق الحدائق",
    predecessors: [36],
    status: "NotStarted",
    TableItemID: "Fence-3",
  },

  // ---------- Testing & Handover ----------
  {
    id: 38,
    name: "Architectural - Testing, Commissioning & Snagging",
    nameArabic: "معماري - الاختبار والتشغيل وقائمة الملاحظات",
    predecessors: [29, 30, 32, 33, 34],
    status: "NotStarted",
    TableItemID: "Architectural-9",
  },
  {
    id: 39,
    name: "Architectural - Final Handover of the Villa",
    nameArabic: "معماري - التسليم النهائي للفيلا",
    predecessors: [38, 37],
    status: "NotStarted",
    TableItemID: "Architectural-10",
  },
];
