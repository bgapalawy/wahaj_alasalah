// constructionItems.js
//
// Rebuilt DIRECTLY from WAHJ-ALASALAH_Baseline.xer (parsed programmatically,
// not manually transcribed) — Block A-BLK1 (Zone A, Block 1, Villas
// #001-009) used as the representative block, since every block in the
// schedule repeats this exact same 39-activity structure with identical
// names and predecessor logic, just under a different zone/block code
// prefix (e.g. AA### for A-BLK1, AB### for A-BLK2, BA### for B-BLK1, ...).
//
// IMPORTANT — P6 GRANULARITY: this schedule is modeled at the BLOCK level
// (7-9 villas share one set of activities), not per individual villa. The
// app's per-villa tracking is an intentional finer breakdown of the same
// work — when connecting to P6, one P6 block activity going "Complete"
// corresponds to that SAME activity going "Complete" across every real
// villa in that block, not a 1:1 single-villa match.
//
// p6Code on each item is the GENERIC activity code suffix that repeats
// identically across every block (e.g. "110" for Excavation in every
// single block, regardless of zone/block letter/number) — the real P6
// activity code for any given block is {zone}{block}{p6Code}, e.g.
// "AA110" for zone A block 1, "BC121" for zone B block 3. This is what a
// future P6 sync would use to map a specific block's activity update back
// to this generic item list.
//
// Two items (Architectural-9, Architectural-10) live in a DIFFERENT WBS
// branch in the real schedule than the other 37 (a separate "Package
// Testing & Commissioning" sub-phase, plus a milestone task on the block
// itself) rather than under the block's own 11 category nodes — confirmed
// by tracing their actual predecessor/successor links back to this
// block's other activities.
//
// predecessors use this file's own `id`, matching the TableItemID scheme
// used elsewhere in the app.

export const constructionItems = [
  // ---------- Substructure (Civil) ----------
  {
    id: 1,
    name: "Excavation to Formation Level",
    nameArabic: "الحفر حتى منسوب التأسيس",
    predecessors: [],
    status: "NotStarted",
    TableItemID: "Civil-1",
    p6Code: "110",
  },
  {
    id: 2,
    name: "Anti-Termite Treatment & PCC Blinding",
    nameArabic: "معالجة مضادة للنمل الأبيض وخرسانة نظافة",
    predecessors: [1],
    status: "NotStarted",
    TableItemID: "Civil-2",
    p6Code: "111",
  },
  {
    id: 3,
    name: "Strip Footing & Plinth Wall",
    nameArabic: "القواعد الشريطية وحائط القاعدة",
    predecessors: [2],
    status: "NotStarted",
    TableItemID: "Civil-3",
    p6Code: "112",
  },
  {
    id: 4,
    name: "Raft Slab",
    nameArabic: "البلاطة الأساسية",
    predecessors: [3],
    status: "NotStarted",
    TableItemID: "Civil-4",
    p6Code: "113",
  },
  {
    id: 5,
    name: "Edge Beam",
    nameArabic: "عتب الحافة",
    predecessors: [4],
    status: "NotStarted",
    TableItemID: "Civil-5",
    p6Code: "114",
  },
  {
    id: 6,
    name: "Backfilling & Compaction",
    nameArabic: "الردم والدمك",
    predecessors: [5],
    status: "NotStarted",
    TableItemID: "Civil-6",
    p6Code: "115",
  },

  // ---------- Superstructure (Civil) — Columns run right after Edge Beam, parallel with Backfilling ----------
  {
    id: 7,
    name: "Columns & RC Frame",
    nameArabic: "الأعمدة والإطار الخرساني",
    predecessors: [5],
    status: "NotStarted",
    TableItemID: "Civil-7",
    p6Code: "120",
  },
  {
    id: 8,
    name: "Structural Screed & Beams",
    nameArabic: "الميدة الإنشائية والكمرات",
    predecessors: [7],
    status: "NotStarted",
    TableItemID: "Civil-8",
    p6Code: "121",
  },
  {
    id: 9,
    name: "RC Slab Casting (Aluminum Formwork System)",
    nameArabic: "صب البلاطة الخرسانية (شدة الألومنيوم)",
    predecessors: [8],
    status: "NotStarted",
    TableItemID: "Civil-9",
    p6Code: "122",
  },
  {
    id: 10,
    name: "RC Wall Casting - Exterior (Aluminum Formwork, 200mm)",
    nameArabic: "صب الحوائط الخرسانية الخارجية (شدة ألومنيوم، 200مم)",
    predecessors: [9],
    status: "NotStarted",
    TableItemID: "Civil-10",
    p6Code: "123",
  },
  {
    id: 11,
    name: "RC Wall Casting - Interior & Parapet (Aluminum Formwork, 100-150mm)",
    nameArabic: "صب الحوائط الخرسانية الداخلية والباراپيت (شدة ألومنيوم، 100-150مم)",
    predecessors: [10],
    status: "NotStarted",
    TableItemID: "Civil-11",
    p6Code: "124",
  },
  {
    id: 12,
    name: "Cast-in-Situ Stairs & Structural Metalwork (Railings/Gates)",
    nameArabic: "السلالم المصبوبة موقعياً والأعمال المعدنية الإنشائية (الدرابزين/البوابات)",
    predecessors: [11],
    status: "NotStarted",
    TableItemID: "Civil-12",
    p6Code: "125",
  },
  {
    id: 13,
    name: "Roof Parapet Structural Finishing",
    nameArabic: "تشطيب باراپيت السطح الإنشائي",
    predecessors: [12],
    status: "NotStarted",
    TableItemID: "Civil-13",
    p6Code: "126",
  },

  // ---------- Thermal & Waterproofing — parallel (no site dependency between them) ----------
  {
    id: 14,
    name: "Roof Waterproofing & Insulation",
    nameArabic: "عزل السطح المائي والحراري",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Civil-14",
    p6Code: "130",
  },
  {
    id: 15,
    name: "Wet Area Waterproofing",
    nameArabic: "عزل الحمامات المائي",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Civil-15",
    p6Code: "131",
  },

  // ---------- Openings (Architectural) ----------
  {
    id: 16,
    name: "Door Frames & Wooden Doors",
    nameArabic: "براويز الأبواب والأبواب الخشبية",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Architectural-1",
    p6Code: "140",
  },
  {
    id: 17,
    name: "Window Frames & Glazing",
    nameArabic: "براويز الشبابيك والتزجيج",
    predecessors: [16],
    status: "NotStarted",
    TableItemID: "Architectural-2",
    p6Code: "141",
  },
  {
    id: 18,
    name: "Ironmongery & Hardware Fit-Out",
    nameArabic: "الأدوات المعدنية والأقفال والتركيبات",
    predecessors: [17],
    status: "NotStarted",
    TableItemID: "Architectural-3",
    p6Code: "142",
  },

  // ---------- MEP First Fix — all parallel, gated only on Roof Parapet Structural Finishing ----------
  {
    id: 19,
    name: "First Fix - Water Supply Piping",
    nameArabic: "التأسيس الأول لخطوط المياه",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Mechanical-1",
    p6Code: "160",
  },
  {
    id: 20,
    name: "First Fix - Drainage Piping",
    nameArabic: "التأسيس الأول للصرف",
    predecessors: [19],
    status: "NotStarted",
    TableItemID: "Mechanical-2",
    p6Code: "161",
  },
  {
    id: 21,
    name: "Ductwork & Equipment Installation",
    nameArabic: "تركيب مجاري ومعدات التكييف",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Mechanical-3",
    p6Code: "170",
  },
  {
    id: 22,
    name: "First Fix - Conduits & Wiring",
    nameArabic: "التأسيس الأول للمواسير والأسلاك",
    predecessors: [13],
    status: "NotStarted",
    TableItemID: "Electerical-1",
    p6Code: "180",
  },
  {
    id: 23,
    name: "Distribution Panels & DBs",
    nameArabic: "تركيب لوحات التوزيع",
    predecessors: [22],
    status: "NotStarted",
    TableItemID: "Electerical-2",
    p6Code: "181",
  },
  {
    id: 24,
    name: "Data, TV & Communications Network Installation",
    nameArabic: "تمديدات شبكة البيانات والتلفزيون والاتصالات",
    predecessors: [22],
    status: "NotStarted",
    TableItemID: "Electerical-3",
    p6Code: "190",
  },
  {
    id: 25,
    name: "Fire Alarm System",
    nameArabic: "نظام إنذار الحريق",
    predecessors: [22],
    status: "NotStarted",
    TableItemID: "Electerical-4",
    p6Code: "191",
  },
  {
    id: 26,
    name: "CCTV & Access Control Systems",
    nameArabic: "أنظمة كاميرات المراقبة والتحكم في الدخول",
    predecessors: [25],
    status: "NotStarted",
    TableItemID: "Electerical-5",
    p6Code: "192",
  },

  // ---------- Finishes (Architectural) — gated on ALL of the parallel first-fix/waterproofing/openings work ----------
  {
    id: 27,
    name: "Plaster & Screed",
    nameArabic: "المحارة والتسوية",
    predecessors: [14, 15, 18, 20, 21, 23],
    status: "NotStarted",
    TableItemID: "Architectural-4",
    p6Code: "150",
  },
  {
    id: 28,
    name: "Wall Tiling",
    nameArabic: "تكسية الحوائط",
    predecessors: [27],
    status: "NotStarted",
    TableItemID: "Architectural-5",
    p6Code: "151",
  },
  {
    id: 29,
    name: "Floor Tiling",
    nameArabic: "تكسية الأرضيات",
    predecessors: [28],
    status: "NotStarted",
    TableItemID: "Architectural-6",
    p6Code: "152",
  },
  {
    id: 30,
    name: "Painting",
    nameArabic: "الدهانات",
    predecessors: [29],
    status: "NotStarted",
    TableItemID: "Architectural-7",
    p6Code: "153",
  },
  {
    id: 31,
    name: "Fixtures, Fittings & Specialty Items",
    nameArabic: "التجهيزات والتركيبات والعناصر الخاصة",
    predecessors: [30],
    status: "NotStarted",
    TableItemID: "Architectural-8",
    p6Code: "154",
  },

  // ---------- MEP Second Fix — each gated on its own first-fix chain AND on Finishes being done ----------
  {
    id: 32,
    name: "Second Fix & Sanitary Fixtures",
    nameArabic: "التأسيس الثاني وتركيب الأدوات الصحية",
    predecessors: [20, 31],
    status: "NotStarted",
    TableItemID: "Mechanical-4",
    p6Code: "162",
  },
  {
    id: 33,
    name: "HVAC Testing & Commissioning",
    nameArabic: "اختبار وتشغيل التكييف",
    predecessors: [21, 31],
    status: "NotStarted",
    TableItemID: "Mechanical-5",
    p6Code: "171",
  },
  {
    id: 34,
    name: "Second Fix - Switches & Fittings",
    nameArabic: "التأسيس الثاني للمفاتيح والتجهيزات",
    predecessors: [23, 31],
    status: "NotStarted",
    TableItemID: "Electerical-6",
    p6Code: "182",
  },

  // ---------- External Works (Fence) — starts right after Backfilling, independent chain ----------
  {
    id: 35,
    name: "Boundary Fence & Gate",
    nameArabic: "السور الخارجي والبوابة",
    predecessors: [6],
    status: "NotStarted",
    TableItemID: "Fence-1",
    p6Code: "1A0",
  },
  {
    id: 36,
    name: "Paving & Hardscape",
    nameArabic: "رصف الأرضيات الخارجية",
    predecessors: [35],
    status: "NotStarted",
    TableItemID: "Fence-2",
    p6Code: "1A1",
  },
  {
    id: 37,
    name: "Landscape & Softscape",
    nameArabic: "أعمال تنسيق الحدائق",
    predecessors: [36],
    status: "NotStarted",
    TableItemID: "Fence-3",
    p6Code: "1A2",
  },

  // ---------- Testing & Handover — a DIFFERENT WBS branch in the real schedule
  // ("Package Testing & Commissioning" sub-phase + a milestone on the block
  // itself), not under the block's own 11 category nodes. Confirmed by
  // tracing real predecessor/successor links: gated on every second-fix
  // item, Communications, CCTV, and Landscape — then the handover
  // milestone is gated on this alone. ----------
  {
    id: 38,
    name: "Testing, Commissioning & Snagging",
    nameArabic: "الاختبار والتشغيل وقائمة الملاحظات",
    predecessors: [32, 33, 34, 24, 26, 37],
    status: "NotStarted",
    TableItemID: "Architectural-9",
    p6Code: "196",
  },
  {
    id: 39,
    name: "Final Handover of the Villa",
    nameArabic: "التسليم النهائي للفيلا",
    predecessors: [38],
    status: "NotStarted",
    TableItemID: "Architectural-10",
    p6Code: "MS", // real P6 code is a per-block milestone (e.g. "MS-A1"), not a numbered activity like the rest
  },

  // ---------- Site-wide / general cost items — from the reference
  // "Villa Unit Cost Breakdown" workbook, NOT from the block-level P6
  // schedule (these have no per-block task/date in the XER — they're
  // project-wide costs allocated per villa by villatype). No planned
  // dates exist for these; only planned_cost is ever set. No
  // predecessors — these aren't gated on or gating any schedule
  // activity, they're purely a cost-tracking line. ----------
  {
    id: 40,
    name: "General Requirements - Preliminaries/Mobilisation",
    nameArabic: "المتطلبات العامة - الأعمال التمهيدية والتعبئة",
    predecessors: [],
    status: "NotStarted",
    TableItemID: "General-1",
    p6Code: null,
    costByVillaType: { S: 800, MID: 800, END: 800 },
  },
  {
    id: 41,
    name: "NTP#1 Obligations incl. Mock-up",
    nameArabic: "التزامات أمر المباشرة الأول شاملة الوحدة النموذجية",
    predecessors: [],
    status: "NotStarted",
    TableItemID: "General-2",
    p6Code: null,
    costByVillaType: { S: 600, MID: 620, END: 650 },
  },
  {
    id: 42,
    name: "Earthworks (Site-wide/General)",
    nameArabic: "أعمال الحفر والردم (عام على مستوى الموقع)",
    predecessors: [],
    status: "NotStarted",
    TableItemID: "General-3",
    p6Code: null,
    costByVillaType: { S: 3656.36, MID: 3627.52, END: 3747.55 },
  },
  {
    id: 43,
    name: "Procurement - Superstructure (Package Batches, National Average)",
    nameArabic: "المشتريات - الهيكل الإنشائي (دفعات، متوسط وطني)",
    predecessors: [],
    status: "NotStarted",
    TableItemID: "General-4",
    p6Code: null,
    costByVillaType: { S: 485.99, MID: 396.98, END: 440.5 },
  },
  {
    id: 44,
    name: "MEP Second & Third Fix (Site-wide/General)",
    nameArabic: "التأسيس الثاني والثالث للكهروميكانيكال (عام على مستوى الموقع)",
    predecessors: [],
    status: "NotStarted",
    TableItemID: "General-5",
    p6Code: null,
    costByVillaType: { S: 607.32, MID: 556.78, END: 586.57 },
  },
  {
    id: 45,
    name: "Procurement - MEP Second & Third Fix (Package Batches, National Average)",
    nameArabic: "المشتريات - التأسيس الثاني والثالث (دفعات، متوسط وطني)",
    predecessors: [],
    status: "NotStarted",
    TableItemID: "General-6",
    p6Code: null,
    costByVillaType: { S: 264.29, MID: 233.34, END: 245.82 },
  },
  {
    id: 46,
    name: "Procurement - Finishes (Package Batches, National Average)",
    nameArabic: "المشتريات - التشطيبات (دفعات، متوسط وطني)",
    predecessors: [],
    status: "NotStarted",
    TableItemID: "General-7",
    p6Code: null,
    costByVillaType: { S: 274.01, MID: 222.66, END: 243.64 },
  },
  {
    id: 47,
    name: "Inherent Defects Insurance (IDI @1.60%)",
    nameArabic: "تأمين العيوب الخفية (1.60%)",
    predecessors: [],
    status: "NotStarted",
    TableItemID: "General-8",
    p6Code: null,
    costByVillaType: { S: 5009.91, MID: 4536.87, END: 4975.27 },
  },
];
