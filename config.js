window.APP_CONFIG = {
  features: {
    notes: true,
    youtube: true,
    pyq: true,
    quizMode: false,
    focusMode: true,
    importantMarker: true,
    search: true,
    darkMode: true,
    exportImage: false,
    exportPDF: false
  },
  dev: {
    mockAIQuizResponse: false, // Set to true to return mock quiz data
    alwaysPromptApiKey: false, // Set to true to always ask for API key
    inspectMode: true          // Set to false to disable DevTools and right-click
  },
  preImportedMaps: [
    { label: "1. Maths", file: "maths.json" },
    { label: "2. Reasoning", file: "Reasoning.json" },
    { label: "3. English", file: "English.json" },
    { label: "4. Polity", file: "Polity.json" },
    { label: "5. Static Gk", file: "Static_Gk.json" },
    { label: "6. History", file: "History.json" },
    { label: "7. Economy", file: "Economy.json" },
    { label: "8. Battles", file: "Battles.json" },
    { label: "TRE4 Computer Science", file: "TRE4_Computer_Science.json" }
  ],
  preImportedQuizzes: [
    
    { label: "6. History - Indus Valley (2500-1600 BCE)", file: "ivc_quiz.json" },
    { label: "7. Economy - FYP", file: "fyp_quiz.json" },
    { label: "4. Polity - Articles 12-35→ Fundamental Rights", file: "fm_quiz.json" },
    { label: "3. English - Direct → Indirect", file: "3_english_direct_indirect.json" },
    { label: "3. English - Active ⬌ Passive Voice", file: "3_english_active_passive_voice.json"}
  ],
  preImportedTests: [
    { label: "SSC CGL 12-09-2025 Shift 1", file: "ssc/cgl/ssc_cgl_12-9-2025_shift_1.json" },
    { label: "SSC CGL 12-09-2025 Shift 2", file: "ssc/cgl/ssc_cgl_12-9-2025_shift_2.json" },
    { label: "SSC CGL 13-09-2025 Shift 1",file: "ssc/cgl/ssc_cgl_13-9-2025_shift_1.json" }
  ]
};