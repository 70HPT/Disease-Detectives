// ============================================
// SHARED STATE DATA — Health grades, facts, timeline events
// Used by StatePanel (mobile), StateHealthRings, StateTimeline
// ============================================

// ============================================
// STATE FACTS DATABASE
// ============================================
export const STATE_FACTS = {
  'Alabama': { capital: 'Montgomery', region: 'Southeast', statehood: 1819, fact: 'UAB Hospital in Birmingham performed the first kidney transplant in the Deep South in 1968 and remains one of the nation\'s top transplant centers.' },
  'Alaska': { capital: 'Juneau', region: 'Pacific', statehood: 1959, fact: 'Has the lowest population density in the U.S., which led to the Community Health Aide Program serving more than 170 remote villages.' },
  'Arizona': { capital: 'Phoenix', region: 'Southwest', statehood: 1912, fact: 'The dry climate made it a historic destination for tuberculosis patients seeking recovery in the early 20th century.' },
  'Arkansas': { capital: 'Little Rock', region: 'South', statehood: 1836, fact: 'Hot Springs National Park was once prescribed by doctors as a therapeutic destination for various ailments.' },
  'California': { capital: 'Sacramento', region: 'West', statehood: 1850, fact: 'Leads the nation in biomedical research, filing roughly 40% of all U.S. life sciences patents.' },
  'Colorado': { capital: 'Denver', region: 'Mountain', statehood: 1876, fact: 'Consistently ranks among the leanest states, with studies linking its high elevation to lower obesity rates.' },
  'Connecticut': { capital: 'Hartford', region: 'Northeast', statehood: 1788, fact: 'Yale established one of America\'s first graduate public health programs in 1915 under C.-E.A. Winslow.' },
  'Delaware': { capital: 'Dover', region: 'Mid-Atlantic', statehood: 1787, fact: 'Home to Nemours Children\'s Hospital, founded in 1940 through Alfred I. du Pont\'s bequest and now a top pediatric center.' },
  'Florida': { capital: 'Tallahassee', region: 'Southeast', statehood: 1845, fact: 'Home to nearly 5 million residents over 65, driving some of the country\'s most advanced geriatric care models.' },
  'Georgia': { capital: 'Atlanta', region: 'Southeast', statehood: 1788, fact: 'Atlanta is home to the CDC headquarters, the nation\'s leading public health agency.' },
  'Hawaii': { capital: 'Honolulu', region: 'Pacific', statehood: 1959, fact: 'Has the longest average life expectancy in the U.S. at roughly 80 years.' },
  'Idaho': { capital: 'Boise', region: 'Mountain', statehood: 1890, fact: 'One of the fastest-growing states, rapidly expanding its rural telemedicine infrastructure.' },
  'Illinois': { capital: 'Springfield', region: 'Midwest', statehood: 1818, fact: 'Upton Sinclair\'s exposé of Chicago\'s meatpacking industry in 1906 prompted the Pure Food and Drug Act and created the FDA.' },
  'Indiana': { capital: 'Indianapolis', region: 'Midwest', statehood: 1816, fact: 'Eli Lilly, headquartered in Indianapolis, produced the world\'s first mass-marketed insulin in 1923.' },
  'Iowa': { capital: 'Des Moines', region: 'Midwest', statehood: 1846, fact: 'The Ponseti Method for treating clubfoot, developed at the University of Iowa, is now the global gold standard.' },
  'Kansas': { capital: 'Topeka', region: 'Central', statehood: 1861, fact: 'The 1918 flu pandemic\'s first documented case was recorded at Fort Riley\'s Camp Funston on March 4, 1918.' },
  'Kentucky': { capital: 'Frankfort', region: 'South', statehood: 1792, fact: 'Mary Breckinridge founded the Frontier Nursing Service in Leslie County in 1925, pioneering nurse-midwifery in rural America.' },
  'Louisiana': { capital: 'Baton Rouge', region: 'South', statehood: 1812, fact: 'Established the nation\'s first permanent state board of health in 1855, created in response to devastating yellow fever epidemics.' },
  'Maine': { capital: 'Augusta', region: 'New England', statehood: 1820, fact: 'Has the lowest violent crime rate in the U.S. and ranks highly in mental health access.' },
  'Maryland': { capital: 'Annapolis', region: 'Mid-Atlantic', statehood: 1788, fact: 'Johns Hopkins Hospital, opened in 1889, pioneered the modern teaching hospital and gave American medicine its residency system.' },
  'Massachusetts': { capital: 'Boston', region: 'New England', statehood: 1788, fact: 'Enacted the first state-level universal coverage mandate in 2006, a model that later inspired the Affordable Care Act.' },
  'Michigan': { capital: 'Lansing', region: 'Midwest', statehood: 1837, fact: 'The Flint water crisis became a landmark case in environmental public health awareness.' },
  'Minnesota': { capital: 'St. Paul', region: 'Midwest', statehood: 1858, fact: 'Home to the Mayo Clinic in Rochester, repeatedly ranked the top hospital in the world by Newsweek.' },
  'Mississippi': { capital: 'Jackson', region: 'South', statehood: 1817, fact: 'Has the lowest life expectancy in the U.S., making it a focal point for federal and faith-based community health initiatives.' },
  'Missouri': { capital: 'Jefferson City', region: 'Midwest', statehood: 1821, fact: 'Washington University in St. Louis has produced 17 Nobel laureates in Physiology or Medicine, more than most countries.' },
  'Montana': { capital: 'Helena', region: 'Mountain', statehood: 1889, fact: 'Has one of the highest rates of outdoor recreation participation, linked to lower cardiovascular disease.' },
  'Nebraska': { capital: 'Lincoln', region: 'Central', statehood: 1867, fact: 'UNMC in Omaha houses the nation\'s largest biocontainment unit and the only federal quarantine facility, which treated Ebola patients in 2014.' },
  'Nevada': { capital: 'Carson City', region: 'West', statehood: 1864, fact: 'The Nevada Test Site\'s Cold War nuclear detonations produced generations of "downwinders" still eligible for federal radiation-exposure compensation.' },
  'New Hampshire': { capital: 'Concord', region: 'New England', statehood: 1788, fact: 'Ranks among the top states for healthcare access and has some of the lowest out-of-pocket medical spending in the country.' },
  'New Jersey': { capital: 'Trenton', region: 'Mid-Atlantic', statehood: 1787, fact: 'Home to 5,600+ life sciences establishments, including the headquarters of Johnson & Johnson, Merck, and Bristol Myers Squibb.' },
  'New Mexico': { capital: 'Santa Fe', region: 'Southwest', statehood: 1912, fact: 'Project ECHO, developed at UNM in 2003, revolutionized telemedicine for underserved rural communities worldwide.' },
  'New York': { capital: 'Albany', region: 'Northeast', statehood: 1788, fact: 'NYC\'s Metropolitan Board of Health, founded in 1866, was the first modern municipal public health authority in the U.S.' },
  'North Carolina': { capital: 'Raleigh', region: 'Southeast', statehood: 1789, fact: 'Research Triangle Park anchors one of the country\'s largest life sciences clusters, with GSK, Biogen, and Novo Nordisk all operating there.' },
  'North Dakota': { capital: 'Bismarck', region: 'Central', statehood: 1889, fact: 'Relies heavily on volunteer EMS crews, who make up the majority of rural first responders across its sparsely populated counties.' },
  'Ohio': { capital: 'Columbus', region: 'Midwest', statehood: 1803, fact: 'Cleveland Clinic performs over 5,600 heart surgeries a year, one of the highest cardiac volumes of any hospital on Earth.' },
  'Oklahoma': { capital: 'Oklahoma City', region: 'South Central', statehood: 1907, fact: 'The Cherokee Nation operates the largest tribally-managed health system in the U.S., serving over 2 million patient visits a year.' },
  'Oregon': { capital: 'Salem', region: 'Pacific NW', statehood: 1859, fact: 'First state to legalize physician-assisted end-of-life care, with the Death with Dignity Act taking effect in 1997.' },
  'Pennsylvania': { capital: 'Harrisburg', region: 'Mid-Atlantic', statehood: 1787, fact: 'Home to Pennsylvania Hospital, the nation\'s first chartered hospital, founded by Benjamin Franklin and Thomas Bond in 1751.' },
  'Rhode Island': { capital: 'Providence', region: 'New England', statehood: 1790, fact: 'Smallest state by area but has one of the highest physician-per-capita ratios in the country.' },
  'South Carolina': { capital: 'Columbia', region: 'Southeast', statehood: 1788, fact: 'MUSC in Charleston runs one of only two federally recognized National Telehealth Centers of Excellence, anchoring stroke care across rural ERs.' },
  'South Dakota': { capital: 'Pierre', region: 'Central', statehood: 1889, fact: 'Sioux Falls-based Sanford Health is the largest rural health system in the U.S., serving patients across 320,000 square miles.' },
  'Tennessee': { capital: 'Nashville', region: 'South', statehood: 1796, fact: 'Nashville is the corporate heart of American healthcare, home to HCA and 16 publicly traded health companies generating $97 billion in global revenue.' },
  'Texas': { capital: 'Austin', region: 'South Central', statehood: 1845, fact: 'The Texas Medical Center in Houston is the world\'s largest medical complex, with 21 hospitals and 10 million patient encounters a year.' },
  'Utah': { capital: 'Salt Lake City', region: 'Mountain', statehood: 1896, fact: 'Has the lowest adult smoking rate in the U.S. at 8.9%, the only state in single digits.' },
  'Vermont': { capital: 'Montpelier', region: 'New England', statehood: 1791, fact: 'The Blueprint for Health, launched statewide in 2008, linked every primary care practice to community health teams of social workers and nurses.' },
  'Virginia': { capital: 'Richmond', region: 'Southeast', statehood: 1788, fact: 'The Medical College of Virginia in Richmond performed the South\'s first heart transplant in 1968 and trained the surgeon who later did the world\'s first.' },
  'Washington': { capital: 'Olympia', region: 'Pacific NW', statehood: 1889, fact: 'The first confirmed COVID-19 case in the U.S. was detected in Snohomish County on January 20, 2020.' },
  'West Virginia': { capital: 'Charleston', region: 'Appalachian', statehood: 1863, fact: 'Led the nation in early COVID-19 vaccine rollout by partnering with local pharmacies instead of CVS and Walgreens.' },
  'Wisconsin': { capital: 'Madison', region: 'Midwest', statehood: 1848, fact: 'UW-Madison biochemist Harry Steenbock\'s 1923 UV-irradiation process fortified milk with vitamin D and nearly eliminated rickets.' },
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