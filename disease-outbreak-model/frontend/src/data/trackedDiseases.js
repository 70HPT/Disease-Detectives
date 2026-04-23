// Single source of truth for diseases surfaced in the Disease Spotlight selector.
// Entries here should correspond to ML models Braulio has shipped.
// Add a new model → add an entry here; the UI picks it up automatically.
//
// Burden statistics sourced from CDC NNDSS/FluView (influenza), CDC COVID
// Data Tracker (COVID-19), and CDC NORS/FoodNet (Salmonella). Rounded to
// the nearest sensible unit for display.

export const TRACKED_DISEASES = [
  {
    id: 'Influenza',
    name: 'Influenza',
    apiKey: 'influenza',
    modelKey: 'influenza_lstm',
    sourceLabel: 'NNDSS',
    accent: '#0ea5e9',
    spotlight: {
      overview: (year) => `Seasonal influenza in ${year} was classified as moderate severity by the CDC, with H3N2 as the dominant circulating strain. Approximately 29 million symptomatic illnesses were estimated nationally, resulting in 380,000 hospitalizations.`,
      keyFinding: 'H3N2 dominance correlated with reduced vaccine effectiveness in adults 18-49',
      stats: [
        { label: 'Annual US cases', value: '~29M', sub: 'symptomatic illnesses' },
        { label: 'Hospitalizations', value: '~380K', sub: 'per season' },
        { label: 'US deaths', value: '~25K', sub: 'median annual' },
        { label: 'Case fatality', value: '0.1%', sub: 'typical season' },
      ],
      profile: {
        pathogen: 'Orthomyxovirus (RNA)',
        transmission: 'Respiratory droplets',
        incubation: '1–4 days',
        duration: '5–7 days',
        peakSeason: 'December – February',
      },
      riskGroups: ['Age 65+', 'Children under 5', 'Pregnant women', 'Chronic conditions', 'Immunocompromised'],
      prevention: [
        { label: 'Annual vaccination', detail: 'updated each September' },
        { label: 'Hand hygiene', detail: 'soap or 60%+ alcohol' },
        { label: 'Stay home when ill', detail: '24hr fever-free before return' },
      ],
    },
  },
  {
    id: 'COVID-19',
    name: 'COVID-19',
    apiKey: 'covid',
    modelKey: 'covid_lstm',
    sourceLabel: 'CDC',
    accent: '#a855f7',
    spotlight: {
      overview: (year) => `COVID-19 surveillance in ${year} transitioned to endemic monitoring. Hospitalizations remained well below pandemic peaks, though winter waves continued to strain capacity in under-resourced facilities. Updated boosters targeting JN.1-lineage variants were deployed.`,
      keyFinding: 'Hybrid immunity (infection + vaccination) provided the strongest protection across all age groups',
      stats: [
        { label: 'Cumulative US cases', value: '~110M', sub: 'since 2020' },
        { label: 'Hospitalizations', value: '~1.1M', sub: 'cumulative' },
        { label: 'US deaths', value: '~1.2M', sub: 'cumulative' },
        { label: 'Reproduction (R₀)', value: '2.5–3.5', sub: 'wild-type estimate' },
      ],
      profile: {
        pathogen: 'SARS-CoV-2 (RNA)',
        transmission: 'Respiratory droplets + aerosols',
        incubation: '2–14 days',
        duration: 'Variable (5 days–weeks)',
        peakSeason: 'Winter + late summer',
      },
      riskGroups: ['Age 65+', 'Immunocompromised', 'Pregnant women', 'Chronic conditions', 'Unvaccinated adults'],
      prevention: [
        { label: 'Updated booster', detail: 'targets current variants' },
        { label: 'Indoor ventilation', detail: 'HEPA or outdoor air' },
        { label: 'Test before high-risk contact', detail: 'rapid antigen or PCR' },
      ],
    },
  },
  {
    id: 'Salmonella',
    name: 'Salmonella',
    apiKey: 'salmonella',
    modelKey: 'salmonella_lstm',
    sourceLabel: 'NORS',
    accent: '#f59e0b',
    spotlight: {
      overview: (year) => `Non-typhoidal Salmonella caused an estimated 1.35 million US infections in ${year}, driving roughly 26,500 hospitalizations and 420 deaths. Produce-linked outbreaks (onions, cucumbers, leafy greens) accounted for a growing share, while poultry, eggs, and backyard flocks remained persistent reservoirs.`,
      keyFinding: 'Multi-state outbreaks increasingly trace to pre-cut produce and live-poultry exposure rather than traditional food service',
      stats: [
        { label: 'Annual US cases', value: '~1.35M', sub: 'illnesses estimated' },
        { label: 'Hospitalizations', value: '~26.5K', sub: 'per year' },
        { label: 'US deaths', value: '~420', sub: 'per year' },
        { label: 'Case fatality', value: '0.03%', sub: 'non-typhoidal' },
      ],
      profile: {
        pathogen: 'Salmonella enterica (bacteria)',
        transmission: 'Foodborne · contact with live animals',
        incubation: '6 hours – 6 days',
        duration: '4–7 days',
        peakSeason: 'Summer months',
      },
      riskGroups: ['Children under 5', 'Age 65+', 'Immunocompromised', 'Sickle cell disease'],
      prevention: [
        { label: 'Cook to safe temperature', detail: 'poultry 165°F internal' },
        { label: 'Separate raw from cooked', detail: 'dedicated cutting boards' },
        { label: 'Wash after animal contact', detail: 'especially reptiles/poultry' },
      ],
    },
  },
]

export function getDiseaseById(id) {
  return TRACKED_DISEASES.find(d => d.id === id) ?? TRACKED_DISEASES[0]
}
