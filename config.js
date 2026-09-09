/*
1. add 
2. edit
3. delete
4. expand branch
5. mark important
6. add notes
7. add pyq
8. add youtube video
9. add map
10. generate AI quiz

*/

window.APP_CONFIG = {
  features: {
    notes: true,
    noteFormatting: false,
    youtube: true,
    pyq: true,
    quizMode: false,
    focusMode: false,
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
  ai: {
    geminiModel: "gemini-3.6-flash"
  },
  preImportedMaps: [
    { label: "1. Maths", file: "1_maths.json" },
    { label: "10. Geography", file: "10_geography.json" },
    { label: "11. TRE4 Computer Science", file: "11_tre4_computer_science.json" },
    { label: "12. SET Computer Science", file: "12_stet_computer_science.json" },
    { label: "2. Reasoning", file: "2_reasoning.json" },
    { label: "3. English", file: "3_english.json" },
    { label: "4. Polity", file: "4_polity.json" },
    { label: "5. Static Gk", file: "5_static_gk.json" },
    { label: "6. History", file: "6_history.json" },
    { label: "7. Economy", file: "7_economy.json" },
    { label: "8. Battles", file: "8_battles.json" }
  ],
  preImportedQuizzes: [
    { label: "3. English - Active ⬌ Passive Voice", file: "3_english_active_passive_voice.json"},
    { label: "3. English - Direct → Indirect", file: "3_english_direct_indirect.json" },
    { label: "3. English - subject verb agreement", file: "3_english_subject_verb_agreement.json"},
    { label: "4. Polity - Articles 12-35→ Fundamental Rights", file: "fm_quiz.json" },
    { label: "5. Static Gk - Indian Dance Forms", file: "5_static_gk_indian_dance_forms.json"},
    { label: "5. Static Gk - Rivers of India", file: "5_static_gk_rivers_of_india.json"},
    { label: "6. History - Indus Valley (2500-1600 BCE)", file: "ivc_quiz.json" },
    { label: "7. Economy - FYP", file: "fyp_quiz.json" },
    { label: "7. Economy - National Income", file: "7_economy_national_income.json"},
    { label: "TRE4 Computer Science - Operating System", file: "tre4_computer_science_operating_system.json"},
    { label: "TRE4 Computer Science - Theory of Computation", file: "tre4_computer_science_theory_of_computation.json"}
  ],
  preImportedTests: [
    { label: "SSC CGL 12-09-2025 Shift 1", file: "ssc/cgl/ssc_cgl_12-9-2025_shift_1.json" },
    { label: "SSC CGL 12-09-2025 Shift 2", file: "ssc/cgl/ssc_cgl_12-9-2025_shift_2.json" },
    { label: "SSC CGL 13-09-2025 Shift 1",file: "ssc/cgl/ssc_cgl_13-9-2025_shift_1.json" }
  ]
};