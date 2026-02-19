// ============================================
// SHARED STATE DATA — Health grades, facts, timeline events
// Used by StatePanel (mobile), StateHealthRings, StateTimeline
// ============================================

// ============================================
// STATE FACTS DATABASE
// ============================================
export const STATE_FACTS = {
  'Alabama': { capital: 'Montgomery', region: 'Southeast', statehood: 1819, fact: 'Home to the Tuskegee Institute, which pioneered rural public health outreach in the early 1900s.' },
  'Alaska': { capital: 'Juneau', region: 'Pacific', statehood: 1959, fact: 'Has the lowest population density in the U.S., creating unique challenges for rural healthcare delivery.' },
  'Arizona': { capital: 'Phoenix', region: 'Southwest', statehood: 1912, fact: 'The dry climate made it a historic destination for tuberculosis patients seeking recovery in the early 20th century.' },
  'Arkansas': { capital: 'Little Rock', region: 'South', statehood: 1836, fact: 'Hot Springs National Park was once prescribed by doctors as a therapeutic destination for various ailments.' },
  'California': { capital: 'Sacramento', region: 'West', statehood: 1850, fact: 'Leads the nation in biomedical research funding, home to over 3,000 biotech companies.' },
  'Colorado': { capital: 'Denver', region: 'Mountain', statehood: 1876, fact: 'Consistently ranked among the healthiest states due to high altitude, active lifestyle, and low obesity rates.' },
  'Connecticut': { capital: 'Hartford', region: 'Northeast', statehood: 1788, fact: 'Yale University established one of America\'s first public health schools in 1915.' },
  'Delaware': { capital: 'Dover', region: 'Mid-Atlantic', statehood: 1787, fact: 'First state to ratify the Constitution and a pioneer in corporate healthcare policy.' },
  'Florida': { capital: 'Tallahassee', region: 'Southeast', statehood: 1845, fact: 'Has the highest percentage of residents over 65, driving innovative geriatric care models.' },
  'Georgia': { capital: 'Atlanta', region: 'Southeast', statehood: 1788, fact: 'Atlanta is home to the CDC headquarters, the nation\'s leading public health agency.' },
  'Hawaii': { capital: 'Honolulu', region: 'Pacific', statehood: 1959, fact: 'Has the longest average life expectancy in the U.S. at over 80 years.' },
  'Idaho': { capital: 'Boise', region: 'Mountain', statehood: 1890, fact: 'One of the fastest-growing states, rapidly expanding its rural telemedicine infrastructure.' },
  'Illinois': { capital: 'Springfield', region: 'Midwest', statehood: 1818, fact: 'Chicago\'s meatpacking industry reforms in 1906 led to the creation of the FDA.' },
  'Indiana': { capital: 'Indianapolis', region: 'Midwest', statehood: 1816, fact: 'Eli Lilly, headquartered in Indianapolis, produces roughly 25% of the world\'s insulin supply.' },
  'Iowa': { capital: 'Des Moines', region: 'Midwest', statehood: 1846, fact: 'Pioneered the nation\'s first statewide electronic health records system.' },
  'Kansas': { capital: 'Topeka', region: 'Central', statehood: 1861, fact: 'The 1918 flu pandemic was first documented at Fort Riley, reshaping global disease surveillance.' },
  'Kentucky': { capital: 'Frankfort', region: 'South', statehood: 1792, fact: 'The Frontier Nursing Service, founded in 1925, pioneered nurse-midwifery in rural America.' },
  'Louisiana': { capital: 'Baton Rouge', region: 'South', statehood: 1812, fact: 'New Orleans has one of the oldest public health systems in the Americas, dating to French colonial quarantine laws.' },
  'Maine': { capital: 'Augusta', region: 'New England', statehood: 1820, fact: 'Has the lowest violent crime rate in the U.S. and ranks highly in mental health access.' },
  'Maryland': { capital: 'Annapolis', region: 'Mid-Atlantic', statehood: 1788, fact: 'Johns Hopkins Hospital, founded in 1889, revolutionized American medical education and research.' },
  'Massachusetts': { capital: 'Boston', region: 'New England', statehood: 1788, fact: 'Implemented the first universal healthcare mandate in the U.S. in 2006, inspiring the national ACA.' },
  'Michigan': { capital: 'Lansing', region: 'Midwest', statehood: 1837, fact: 'The Flint water crisis became a landmark case in environmental public health awareness.' },
  'Minnesota': { capital: 'St. Paul', region: 'Midwest', statehood: 1858, fact: 'Home to the Mayo Clinic, consistently ranked the #1 hospital in the world.' },
  'Mississippi': { capital: 'Jackson', region: 'South', statehood: 1817, fact: 'Has the highest rate of church attendance in the U.S., with faith-based health programs playing a major community role.' },
  'Missouri': { capital: 'Jefferson City', region: 'Midwest', statehood: 1821, fact: 'Washington University in St. Louis has produced more Nobel laureates in medicine than most countries.' },
  'Montana': { capital: 'Helena', region: 'Mountain', statehood: 1889, fact: 'Has one of the highest rates of outdoor recreation participation, linked to lower cardiovascular disease.' },
  'Nebraska': { capital: 'Lincoln', region: 'Central', statehood: 1867, fact: 'UNMC in Omaha houses one of only a few U.S. biocontainment units for treating highly infectious diseases.' },
  'Nevada': { capital: 'Carson City', region: 'West', statehood: 1864, fact: 'Las Vegas has become an unexpected hub for medical tourism and advanced surgical procedures.' },
  'New Hampshire': { capital: 'Concord', region: 'New England', statehood: 1788, fact: 'Ranks among the top states for healthcare access and lowest uninsured rates.' },
  'New Jersey': { capital: 'Trenton', region: 'Mid-Atlantic', statehood: 1787, fact: 'Often called "The Medicine Chest of the World" — home to 13 of the world\'s 20 largest pharma companies.' },
  'New Mexico': { capital: 'Santa Fe', region: 'Southwest', statehood: 1912, fact: 'Project ECHO, developed at UNM, revolutionized telemedicine for underserved rural communities worldwide.' },
  'New York': { capital: 'Albany', region: 'Northeast', statehood: 1788, fact: 'NYC\'s public health department, founded in 1866, was the first of its kind in the Western Hemisphere.' },
  'North Carolina': { capital: 'Raleigh', region: 'Southeast', statehood: 1789, fact: 'Research Triangle Park is home to the largest cluster of biotech and pharmaceutical companies in the U.S.' },
  'North Dakota': { capital: 'Bismarck', region: 'Central', statehood: 1889, fact: 'Has one of the lowest COVID mortality rates, partly attributed to its dispersed rural population.' },
  'Ohio': { capital: 'Columbus', region: 'Midwest', statehood: 1803, fact: 'Cleveland Clinic performs more heart surgeries than any other hospital in the world.' },
  'Oklahoma': { capital: 'Oklahoma City', region: 'South Central', statehood: 1907, fact: 'The Cherokee Nation operates one of the largest tribally-managed health systems in the U.S.' },
  'Oregon': { capital: 'Salem', region: 'Pacific NW', statehood: 1859, fact: 'First state to legalize physician-assisted end-of-life care with the Death with Dignity Act in 1997.' },
  'Pennsylvania': { capital: 'Harrisburg', region: 'Mid-Atlantic', statehood: 1787, fact: 'Home to the first hospital in America — Pennsylvania Hospital, founded by Benjamin Franklin in 1751.' },
  'Rhode Island': { capital: 'Providence', region: 'New England', statehood: 1790, fact: 'Smallest state by area but has one of the highest physician-to-patient ratios in the country.' },
  'South Carolina': { capital: 'Columbia', region: 'Southeast', statehood: 1788, fact: 'MUSC in Charleston is a leader in stroke telemedicine, connecting rural ERs with specialists remotely.' },
  'South Dakota': { capital: 'Pierre', region: 'Central', statehood: 1889, fact: 'Sanford Health, based here, is one of the largest rural health systems in the nation.' },
  'Tennessee': { capital: 'Nashville', region: 'South', statehood: 1796, fact: 'Nashville is called "The Healthcare Capital" — home to more than 500 healthcare companies.' },
  'Texas': { capital: 'Austin', region: 'South Central', statehood: 1845, fact: 'The Texas Medical Center in Houston is the world\'s largest medical complex, with 60+ institutions.' },
  'Utah': { capital: 'Salt Lake City', region: 'Mountain', statehood: 1896, fact: 'Consistently ranked as one of the healthiest states, with the lowest smoking rate in the nation.' },
  'Vermont': { capital: 'Montpelier', region: 'New England', statehood: 1791, fact: 'First state to establish a comprehensive healthcare reform law aimed at universal coverage.' },
  'Virginia': { capital: 'Richmond', region: 'Southeast', statehood: 1788, fact: 'Home to the first permanent English settlement and early colonial quarantine practices.' },
  'Washington': { capital: 'Olympia', region: 'Pacific NW', statehood: 1889, fact: 'The first confirmed COVID-19 case in the U.S. was detected in Snohomish County in January 2020.' },
  'West Virginia': { capital: 'Charleston', region: 'Appalachian', statehood: 1863, fact: 'Despite health challenges, WV led the nation in early COVID vaccine rollout speed in 2021.' },
  'Wisconsin': { capital: 'Madison', region: 'Midwest', statehood: 1848, fact: 'UW-Madison researchers discovered vitamin D fortification, eliminating rickets as a childhood epidemic.' },
  'Wyoming': { capital: 'Cheyenne', region: 'Mountain', statehood: 1890, fact: 'Least populous state, where emergency air medical transport is essential for rural healthcare access.' },
}

export const DEFAULT_FACT = { capital: 'N/A', region: 'N/A', statehood: 'N/A', fact: 'Select a state to learn more.' }

// ============================================
// HEALTH GRADE HELPER
// ============================================
export function getHealthGrade(healthIndex) {
  if (healthIndex >= 80) return { grade: 'A', color: '#00ffcc', glow: '#00ffcc50', pct: healthIndex / 100 }
  if (healthIndex >= 70) return { grade: 'B+', color: '#00e0aa', glow: '#00e0aa50', pct: healthIndex / 100 }
  if (healthIndex >= 60) return { grade: 'B', color: '#0ea5e9', glow: '#0ea5e950', pct: healthIndex / 100 }
  if (healthIndex >= 50) return { grade: 'C+', color: '#f0c040', glow: '#f0c04050', pct: healthIndex / 100 }
  if (healthIndex >= 40) return { grade: 'C', color: '#e09030', glow: '#e0903050', pct: healthIndex / 100 }
  return { grade: 'D', color: '#ff4060', glow: '#ff406050', pct: healthIndex / 100 }
}

// ============================================
// OUTBREAK EVENTS — National
// ============================================
export const NATIONAL_EVENTS = [
  { year: 1918, name: 'Spanish Flu', severity: 'critical', type: 'Influenza', deaths: '675,000', desc: 'Deadliest pandemic in U.S. history, infecting one-third of the global population.' },
  { year: 1952, name: 'Polio Epidemic', severity: 'high', type: 'Poliovirus', deaths: '3,145', desc: 'Worst U.S. polio outbreak; accelerated development of the Salk vaccine.' },
  { year: 1981, name: 'HIV/AIDS Emerges', severity: 'critical', type: 'HIV', deaths: '700,000+', desc: 'First cases identified in Los Angeles; transformed public health infrastructure.' },
  { year: 1993, name: 'Hantavirus', severity: 'medium', type: 'Hantavirus', deaths: '32', desc: 'Outbreak in the Four Corners region led to identification of a new pathogen.' },
  { year: 2003, name: 'SARS Scare', severity: 'low', type: 'Coronavirus', deaths: '0', desc: 'Eight U.S. cases confirmed; catalyzed pandemic preparedness planning.' },
  { year: 2009, name: 'H1N1 Pandemic', severity: 'high', type: 'Influenza', deaths: '12,469', desc: 'Novel swine flu strain caused the first pandemic in 40 years.' },
  { year: 2014, name: 'Ebola Response', severity: 'medium', type: 'Ebolavirus', deaths: '2', desc: 'Eleven patients treated on U.S. soil; tested national biocontainment capacity.' },
  { year: 2016, name: 'Zika Virus', severity: 'medium', type: 'Flavivirus', deaths: '0', desc: 'Mosquito-borne outbreak in Florida and Texas raised birth defect concerns.' },
  { year: 2020, name: 'COVID-19', severity: 'critical', type: 'SARS-CoV-2', deaths: '1.1M+', desc: 'Global pandemic causing unprecedented public health and economic disruption.' },
  { year: 2022, name: 'Mpox Outbreak', severity: 'medium', type: 'Monkeypox', deaths: '42', desc: 'First significant U.S. spread of mpox prompted emergency vaccination campaigns.' },
]

// ============================================
// OUTBREAK EVENTS — State-specific
// ============================================
export const STATE_EVENTS = {
  'Alabama': [
    { year: 1932, name: 'Tuskegee Study Begins', severity: 'high', type: 'Ethics', deaths: '—', desc: 'Infamous syphilis study that ran until 1972, reshaping medical ethics nationwide.' },
  ],
  'California': [
    { year: 1900, name: 'Plague in SF Chinatown', severity: 'high', type: 'Plague', deaths: '119', desc: 'First plague outbreak in the continental U.S., sparking quarantine debates.' },
    { year: 2015, name: 'Disneyland Measles', severity: 'medium', type: 'Measles', deaths: '0', desc: 'Multi-state outbreak originating at Disneyland reignited vaccine mandate debates.' },
  ],
  'Colorado': [
    { year: 2012, name: 'Pertussis Surge', severity: 'medium', type: 'Pertussis', deaths: '3', desc: 'Over 1,500 whooping cough cases, highest in 50 years.' },
  ],
  'Connecticut': [
    { year: 1975, name: 'Lyme Disease Identified', severity: 'medium', type: 'Borrelia', deaths: '0', desc: 'First described in Old Lyme, CT; now the most common tick-borne illness in the U.S.' },
  ],
  'Florida': [
    { year: 2016, name: 'Zika Epicenter', severity: 'high', type: 'Flavivirus', deaths: '0', desc: 'Local Zika transmission in Miami-Dade triggered travel advisories and aerial spraying.' },
    { year: 2021, name: 'Delta Surge', severity: 'high', type: 'SARS-CoV-2', deaths: '25,000+', desc: 'Florida became a national hotspot during the Delta variant wave.' },
  ],
  'Georgia': [
    { year: 2014, name: 'Ebola Patient Zero', severity: 'high', type: 'Ebolavirus', deaths: '0', desc: 'Emory University Hospital treated the first Ebola patients on U.S. soil near CDC HQ.' },
  ],
  'Kansas': [
    { year: 1918, name: 'Flu Ground Zero', severity: 'critical', type: 'Influenza', deaths: 'Unknown', desc: 'Fort Riley is considered a likely origin point of the 1918 pandemic.' },
  ],
  'Louisiana': [
    { year: 2005, name: 'Post-Katrina Health Crisis', severity: 'critical', type: 'Multi-pathogen', deaths: '1,836', desc: 'Hurricane Katrina destroyed healthcare infrastructure, causing cascading public health failures.' },
  ],
  'Maryland': [
    { year: 2001, name: 'Anthrax Attacks', severity: 'high', type: 'B. anthracis', deaths: '5', desc: 'Anthrax-laced letters sent from within the U.S. biodefense community shocked the nation.' },
  ],
  'Massachusetts': [
    { year: 1721, name: 'Smallpox Inoculation', severity: 'medium', type: 'Variola', deaths: '844', desc: 'Cotton Mather championed America\'s first smallpox inoculation campaign in Boston.' },
    { year: 2012, name: 'Meningitis Outbreak', severity: 'high', type: 'Fungal', deaths: '64', desc: 'Contaminated steroid injections from a Framingham pharmacy caused a national outbreak.' },
  ],
  'Michigan': [
    { year: 2014, name: 'Flint Water Crisis', severity: 'critical', type: 'Lead/Legionella', deaths: '12', desc: 'Lead-contaminated water and Legionnaire\'s disease outbreak became a symbol of environmental injustice.' },
  ],
  'Minnesota': [
    { year: 2017, name: 'Somali Measles Outbreak', severity: 'medium', type: 'Measles', deaths: '0', desc: 'Anti-vaccine misinformation in the Somali community led to 75 measles cases.' },
  ],
  'Mississippi': [
    { year: 1878, name: 'Yellow Fever Epidemic', severity: 'critical', type: 'Flavivirus', deaths: '4,600', desc: 'Devastating yellow fever swept through the Mississippi Valley, killing thousands.' },
  ],
  'Nebraska': [
    { year: 2014, name: 'Ebola Treatment Center', severity: 'medium', type: 'Ebolavirus', deaths: '0', desc: 'UNMC biocontainment unit successfully treated Ebola patients, proving the facility\'s capability.' },
  ],
  'New York': [
    { year: 1832, name: 'Cholera Pandemic', severity: 'critical', type: 'V. cholerae', deaths: '3,515', desc: 'Cholera devastated NYC; led to creation of the city\'s public health infrastructure.' },
    { year: 2020, name: 'COVID-19 Epicenter', severity: 'critical', type: 'SARS-CoV-2', deaths: '70,000+', desc: 'NYC became the early global epicenter with overwhelmed hospitals and mass burial sites.' },
  ],
  'North Carolina': [
    { year: 2018, name: 'Florence Health Crisis', severity: 'medium', type: 'Multi-pathogen', deaths: '53', desc: 'Hurricane Florence flooded hog waste lagoons, contaminating water supplies across eastern NC.' },
  ],
  'Ohio': [
    { year: 2019, name: 'Hepatitis A Surge', severity: 'medium', type: 'Hepatitis A', deaths: '15', desc: 'Person-to-person hepatitis A outbreak driven by homelessness and substance use disorders.' },
  ],
  'Oregon': [
    { year: 1984, name: 'Rajneeshee Bioterror', severity: 'high', type: 'Salmonella', deaths: '0', desc: 'The Rajneeshee cult deliberately contaminated salad bars in The Dalles, sickening 751 people.' },
  ],
  'Pennsylvania': [
    { year: 1793, name: 'Yellow Fever in Philadelphia', severity: 'critical', type: 'Flavivirus', deaths: '5,000', desc: 'Killed 10% of Philadelphia\'s population, the worst epidemic in early American history.' },
  ],
  'Texas': [
    { year: 2014, name: 'Ebola in Dallas', severity: 'high', type: 'Ebolavirus', deaths: '1', desc: 'First Ebola diagnosis on U.S. soil; Thomas Eric Duncan died at Texas Health Presbyterian.' },
    { year: 2021, name: 'Winter Storm Uri', severity: 'high', type: 'Infrastructure', deaths: '246', desc: 'Grid failure caused healthcare system collapse and hypothermia deaths across the state.' },
  ],
  'Washington': [
    { year: 2020, name: 'U.S. Patient Zero', severity: 'critical', type: 'SARS-CoV-2', deaths: '45', desc: 'First confirmed U.S. COVID case in Snohomish County; Kirkland nursing home became an early cluster.' },
  ],
  'West Virginia': [
    { year: 2021, name: 'Vaccine Rollout Leader', severity: 'low', type: 'SARS-CoV-2', deaths: '—', desc: 'Used independent pharmacies to vaccinate faster than any other state in the early rollout.' },
  ],
}

export const SEVERITY_COLORS = {
  critical: '#ff4060',
  high: '#f0a030',
  medium: '#0ea5e9',
  low: '#00ffcc',
}