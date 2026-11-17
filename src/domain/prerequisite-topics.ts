/**
 * Subjects that prerequisite texts ask for without naming a course, such as "linear algebra" or "15 credits in
 * programming". Each pattern matches lower-case text. A more specific topic, such as functional programming, is
 * excluded from its general one, so "functional programming" does not also count as programming.
 */
export const TOPICS = {
  // Mathematics
  mathematics: {
    label: "Mathematics",
    pattern: /(?<!(?:discrete|applied|financial) )\bmathematics\b(?! (?:and|or) (?:mathematical )?statistics)/,
  },
  "linear-algebra": { label: "Linear algebra", pattern: /\blinear algebra\b/ },
  calculus: {
    label: "Calculus in one variable",
    pattern:
      /\b(?:calculus in one (?:real )?variable|(?:single|one)[- ]variable (?:calculus|analysis)|calculus|(?:mathematical )?analysis in one (?:real )?variable|mathematical analysis)\b(?! in several)(?<!multi-?variable calculus)/,
  },
  "multivariable-calculus": {
    label: "Multivariable calculus",
    pattern:
      /\b(?:multi-?vari(?:able|ate)(?: calculus| analysis)?|(?:calculus|analysis) in several (?:variables|dimensions)|several (?:variables|dimensions)|vector (?:analysis|calculus))\b/,
  },
  "dynamical-systems": { label: "Dynamical systems", pattern: /\bdynamic(?:al)? systems\b/ },
  "differential-equations": { label: "Differential equations", pattern: /\b(?:ordinary |partial )?differential equations\b/ },
  "numerical-analysis": { label: "Numerical analysis", pattern: /\bnumerical (?:analysis|methods|linear algebra)\b/ },
  "complex-analysis": {
    label: "Complex analysis",
    pattern: /\bcomplex (?:analysis|variables?|calculus)\b|\banalytic(?:al)? functions\b/,
  },
  transforms: {
    label: "Transforms",
    pattern:
      /\b(?:fourier|laplace|linear|integral|z)[- ]transforms?\b|\btransforms\b(?! learning)|\bmathematical transformations\b|\bfourier (?:analysis|series)\b/,
  },
  probability: { label: "Probability", pattern: /\bprobability\b/ },
  statistics: { label: "Statistics", pattern: /\bstatistic(?:s|al (?:methods|inference|analysis))\b|\bmathematical statistics\b/ },
  "stochastic-processes": { label: "Stochastic processes", pattern: /\b(?:stochastic|random) processes\b/ },
  "discrete-mathematics": { label: "Discrete mathematics", pattern: /\bdiscrete math(?:ematics|s)?\b/ },
  logic: { label: "Logic", pattern: /\blogic\b(?! (?:design|circuits))/ },
  optimization: { label: "Optimization", pattern: /\boptimi[sz]ation\b|\blinear programming\b/ },

  // Computer science
  programming: {
    label: "Programming",
    pattern:
      /(?<!(?:functional|object[- ]oriented|concurrent|parallel|machine[- ]oriented|linear|dynamic|unix|assembler|assembly) )\bprogramm?ing\b(?! language technology)/,
  },
  "functional-programming": { label: "Functional programming", pattern: /\bfunctional programming\b/ },
  "object-oriented-programming": { label: "Object-oriented programming", pattern: /\bobject[- ]oriented (?:programming|design)\b/ },
  "concurrent-programming": { label: "Concurrent and parallel programming", pattern: /\b(?:concurrent|parallel) programming\b/ },
  "machine-oriented-programming": {
    label: "Machine-oriented programming",
    pattern: /\b(?:machine[- ]oriented|assembler|assembly|low[- ]level) programming\b/,
  },
  algorithms: { label: "Algorithms and data structures", pattern: /\balgorithms\b|\bdata structures\b/ },
  databases: { label: "Databases", pattern: /\bdatabases?\b/ },
  "operating-systems": { label: "Operating systems", pattern: /\boperating systems?\b/ },
  "computer-networks": { label: "Computer networks", pattern: /\bcomputer (?:networks?|communication)\b|\bnetworking\b/ },
  "computer-security": { label: "Computer security", pattern: /\b(?:computer|information|network|cyber) ?security\b/ },
  "computer-organization": {
    label: "Computer organization",
    pattern:
      /\bcomputer (?:organi[sz]ation|architectures?)\b|(?<!\b(?:degree|bachelor'?s?|b\.?sc|programs?|programmes?)\b[^.;]*)\bcomputer engineering\b|\bdigital (?:design|systems|circuits|fundamentals)\b/,
  },
  "distributed-systems": { label: "Distributed systems", pattern: /\bdistributed systems?\b/ },
  "programming-languages": {
    label: "Programming language technology",
    pattern: /\bprogramming language technology\b|\bcompilers?\b|\binterpreters\b/,
  },
  "software-engineering": {
    label: "Software engineering",
    pattern: /\bsoftware (?:engineering|development)\b(?! (?:degree|programme))/,
  },
  "interaction-design": { label: "Interaction design", pattern: /\binteraction design\b|\bhuman\s*-?\s*computer\s+interaction\b/ },
  "image-analysis": { label: "Image analysis", pattern: /\bimage (?:analysis|processing)\b|\bcomputer vision\b/ },
  "machine-learning": { label: "Machine learning", pattern: /\bmachine learning\b|\bdeep learning\b|\bneural networks\b/ },
  "artificial-intelligence": { label: "Artificial intelligence", pattern: /\bartificial intelligence\b/ },
  matlab: { label: "Matlab", pattern: /\bmatlab\b/ },
  python: { label: "Python", pattern: /\bpython\b/ },

  // Physics
  physics: {
    label: "Physics",
    pattern:
      /(?<!(?:quantum|solid[- ]state|statistical|building|nuclear|semiconductor|computational|condensed matter|engineering) )\bphysics\b/,
  },
  mechanics: {
    label: "Mechanics",
    pattern:
      /(?<!(?:fluid|quantum|solid|statistical|continuum|structural|soil|rock|fracture|classical|analytical) )\bmechanics\b(?! and strength)|\bstatics\b|\bkinematics\b|\brigid bod(?:y|ies)\b|\bdynamics of particles\b/,
  },
  "classical-mechanics": { label: "Classical mechanics", pattern: /\b(?:classical|analytical) mechanics\b/ },
  "quantum-physics": { label: "Quantum physics", pattern: /\bquantum (?:physics|mechanics|theory)\b/ },
  electromagnetism: {
    label: "Electromagnetism",
    pattern: /\belectromagnet(?:ism|ics|ic field theory|ic fields?|ic theory|ic waves?)\b|\belectrodynamics\b/,
  },
  thermodynamics: { label: "Thermodynamics", pattern: /\bthermodynamics\b/ },
  "statistical-physics": { label: "Statistical physics", pattern: /\bstatistical (?:physics|mechanics)\b/ },
  "solid-state-physics": { label: "Solid state physics", pattern: /\b(?:solid[- ]state|condensed matter) physics\b/ },
  "fluid-mechanics": { label: "Fluid mechanics", pattern: /\bfluid (?:mechanics|dynamics)\b|\bhydrodynamics\b/ },
  "heat-transfer": {
    label: "Heat and mass transfer",
    pattern: /\bheat (?:and mass )?transfer\b|\bmass transfer\b|\b(?:mass )?transport (?:phenomena|processes)\b/,
  },
  optics: { label: "Optics", pattern: /\boptics\b|\bphotonics\b/ },
  acoustics: { label: "Acoustics", pattern: /\bacoustics\b/ },
  relativity: { label: "Special relativity", pattern: /\b(?:special )?relativity\b/ },
  astronomy: { label: "Astronomy", pattern: /\bastronomy\b|\bastrophysics\b/ },
  "nuclear-physics": { label: "Nuclear physics", pattern: /\bnuclear (?:physics|engineering|reactor)\b/ },

  // Mechanical, civil and materials engineering
  "solid-mechanics": {
    label: "Solid mechanics",
    pattern: /\bsolid mechanics\b|\bstrength of materials\b|\bmechanics and strength\b|\bcontinuum mechanics\b/,
  },
  "structural-engineering": {
    label: "Structural engineering",
    pattern: /\bstructural (?:engineering|mechanics|design|analysis|dynamics|systems)\b/,
  },
  "finite-element-method": { label: "Finite element method", pattern: /\bfinite element\b|\bfem\b/ },
  "materials-science": {
    label: "Materials science",
    pattern: /\bmaterials? (?:science|engineering|technology)\b|\bengineering materials\b/,
  },
  geotechnics: { label: "Geology and geotechnics", pattern: /\bgeotechnics?\b|\bgeology\b|\bsoil mechanics\b|\bhydrogeology\b/ },
  "water-engineering": {
    label: "Water engineering",
    pattern: /\b(?:waste|drinking |storm)?water (?:engineering|treatment|chemistry|resources?)\b|\bwastewater\b/,
  },
  hydraulics: { label: "Hydraulics and hydrology", pattern: /\bhydraulics\b|\bhydrology\b/ },
  "building-physics": { label: "Building physics", pattern: /\bbuilding (?:physics|technology|materials)\b/ },
  "machine-elements": { label: "Machine elements", pattern: /\bmachine (?:elements|design)\b/ },
  manufacturing: {
    label: "Manufacturing and production",
    pattern: /\b(?:manufacturing|production) (?:technology|engineering|processes|systems)\b/,
  },
  cad: { label: "CAD", pattern: /\b(?:3d )?cad\b|\bcomputer[- ]aided (?:design|modell?ing)\b/ },
  "industrial-design": { label: "Industrial design", pattern: /\bindustrial design\b|\bdesign methodology\b|\bform (?:theory|design)\b/ },
  "human-factors": { label: "Human factors and ergonomics", pattern: /\bhuman factors\b|\bergonomics\b/ },
  "product-development": { label: "Product development", pattern: /\bproduct (?:development|design|realization)\b/ },
  "combustion-engines": { label: "Combustion engines", pattern: /\bcombustion(?: engines?)?\b/ },
  "vehicle-dynamics": { label: "Vehicle dynamics", pattern: /\bvehicle dynamics\b/ },
  architecture: { label: "Architecture and design studio", pattern: /\bdesign studios?\b|\barchitectural design\b/ },
  "urban-planning": { label: "Urban planning", pattern: /\burban (?:planning|design)\b/ },

  // Electrical engineering
  circuits: {
    label: "Circuit analysis",
    pattern: /\b(?:electric(?:al)? )?circuit (?:analysis|theory)\b|\belectric(?:al)? circuits\b/,
  },
  electronics: { label: "Electronics", pattern: /(?<!power )\belectronics\b/ },
  "signals-and-systems": {
    label: "Signals and systems",
    pattern: /\bsignals? and systems\b|\b(?:digital )?signal processing\b|\blinear systems\b/,
  },
  "automatic-control": {
    label: "Automatic control",
    pattern: /\b(?:automatic|linear|feedback) control\b|\bcontrol (?:engineering|theory|systems?)\b|\bstate[- ]space\b/,
  },
  "electric-power": {
    label: "Electric power",
    pattern: /\b(?:electric(?:al)? )?power (?:systems?|engineering|electronics)\b|\belectric power\b|\belectrical machines?\b/,
  },
  "communication-engineering": {
    label: "Communication engineering",
    pattern: /\b(?:tele)?communication (?:engineering|systems|theory)\b|\binformation theory\b/,
  },
  microwaves: { label: "Microwave engineering", pattern: /\bmicrowaves?\b|\bantennas?\b|\brf\b/ },
  semiconductors: { label: "Semiconductor physics", pattern: /\bsemiconductors?\b/ },

  "biomedical-engineering": { label: "Biomedical engineering", pattern: /\bbiomedical (?:engineering|instrumentation)\b/ },

  // Chemistry and biology
  chemistry: {
    label: "Chemistry",
    pattern: /(?<!(?:general|basic|inorganic|organic|physical|analytical|surface|polymer|water|food|environmental) )\bchemistry\b/,
  },
  "general-chemistry": { label: "General chemistry", pattern: /\b(?:general|basic) chemistry\b|\binorganic\b|\bchemical bonding\b/ },
  "organic-chemistry": { label: "Organic chemistry", pattern: /\borganic chemistry\b|\borganic(?:,| and) (?:physical|inorganic)/ },
  "physical-chemistry": { label: "Physical chemistry", pattern: /\bphysical chemistry\b/ },
  "analytical-chemistry": { label: "Analytical chemistry", pattern: /\banalytical chemistry\b/ },
  "polymer-chemistry": { label: "Polymers", pattern: /\bpolymers?\b/ },
  "surface-chemistry": { label: "Surface chemistry", pattern: /\bsurface chemistry\b|\bcolloids?\b/ },
  "chemical-engineering": {
    label: "Chemical engineering",
    pattern: /\b(?:chemical )?reaction engineering\b|\bseparation (?:processes|technology)\b|\bunit operations\b|\bchemical engineering\b/,
  },
  biochemistry: { label: "Biochemistry", pattern: /\bbiochemistry\b/ },
  microbiology: { label: "Microbiology", pattern: /\bmicrobiology\b/ },
  "cell-biology": { label: "Cell and molecular biology", pattern: /\b(?:cell|molecular) biology\b|\bgenetics\b/ },
  biotechnology: { label: "Biotechnology", pattern: /\bbiotechnology\b|\bbioprocess(?:es| technology)?\b/ },

  // Industrial engineering and management
  "project-management": { label: "Project management", pattern: /\bproject management\b/ },
  "operations-management": {
    label: "Operations management",
    pattern: /\b(?:operations?|production) management\b|\bquality (?:and operations )?management\b/,
  },
  logistics: { label: "Logistics and supply chains", pattern: /\blogistics\b|\bsupply chains?\b/ },
  economics: { label: "Economics", pattern: /\b(?:economics|accounting|finance|financial management|business administration)\b/ },
  sustainability: {
    label: "Sustainability",
    pattern: /\bsustainab(?:le development|ility)\b|\benvironmental (?:sciences?|systems analysis|technology)\b/,
  },
  "energy-systems": { label: "Energy systems", pattern: /\benergy (?:systems|technology|engineering|conversion)\b/ },
} as const satisfies Record<string, { label: string; pattern: RegExp }>;

export type TopicId = keyof typeof TOPICS;
