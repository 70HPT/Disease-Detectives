// ============================================
// TRANSMISSION CORRIDOR DATA
// ============================================
// Each state has 3-5 highest-risk outgoing transmission corridors.
// Sources:
//   - Census ACS 2016-2020 State-to-State Commuter Flows (daily workers
//     crossing state lines for work)
//   - BTS T-100 / DOT 2023 Origin-Destination (annual passengers / 365)
//   - Wikipedia list of U.S. state borders for land adjacency
//
// Scoring:
//   rawVolume      = commuters + airPassengers * 1.3
//   logVolume      = ln(rawVolume + 1)
//   volumeScore    = logVolume / maxLogVolume     (max = NJ->NY ~= 12.917)
//   adjacencyBonus = adjacent ? 0.08 : 0
//   riskWeight     = min(1, volumeScore * 0.92 + adjacencyBonus)
//
// travelVolume is commuters + airPassengers (rounded) for display.
// factors cites the specific anchor data point for that corridor.
//

const TRANSMISSION_CORRIDORS = {
  'Alabama': [
    { target: 'Georgia', riskWeight: 0.85, commuters: 34000, airPassengers: 1200, travelVolume: 35200, adjacent: true, mechanism: 'I-85 corridor + ATL hub', factors: '~34,000 daily AL-to-GA commuters (Census ACS 2016-2020); I-85 feeds the Atlanta metro, the Southeast\'s primary air hub.' },
    { target: 'Tennessee', riskWeight: 0.80, commuters: 22000, airPassengers: 400, travelVolume: 22400, adjacent: true, mechanism: 'I-65 corridor', factors: '~22,000 daily AL-to-TN commuters (Census ACS); I-65 ties Birmingham to Nashville and Huntsville to southern TN.' },
    { target: 'Mississippi', riskWeight: 0.75, commuters: 12000, airPassengers: 150, travelVolume: 12150, adjacent: true, mechanism: 'Border adjacency + I-20/I-59', factors: '~12,000 daily AL-to-MS commuters (Census ACS); extended shared border and common Gulf Coast labor market.' },
    { target: 'Florida', riskWeight: 0.74, commuters: 10500, airPassengers: 900, travelVolume: 11400, adjacent: true, mechanism: 'I-10 + seasonal air', factors: '~10,500 daily AL-to-FL commuters (Census ACS) plus Pensacola-Mobile Gulf Coast traffic and snowbird flights.' },
  ],
  'Alaska': [
    { target: 'Washington', riskWeight: 0.56, commuters: 800, airPassengers: 4200, travelVolume: 5000, adjacent: false, mechanism: 'Air travel (ANC-SEA)', factors: '~1.5M annual ANC-SEA passengers (BTS 2023) = ~4,200/day; Seattle is Alaska\'s primary mainland air gateway.' },
    { target: 'California', riskWeight: 0.47, commuters: 200, airPassengers: 1800, travelVolume: 2000, adjacent: false, mechanism: 'Air travel (ANC-LAX/SFO)', factors: '~650k annual ANC-to-California passengers (BTS); secondary gateway via LAX and SFO.' },
    { target: 'Oregon', riskWeight: 0.38, commuters: 100, airPassengers: 700, travelVolume: 800, adjacent: false, mechanism: 'Air travel (ANC-PDX)', factors: '~255k annual ANC-PDX passengers (BTS); Pacific Northwest secondary route.' },
  ],
  'Arizona': [
    { target: 'California', riskWeight: 0.89, commuters: 42000, airPassengers: 3500, travelVolume: 45500, adjacent: true, mechanism: 'I-10/I-8 + PHX-LAX air', factors: '~42,000 daily AZ-to-CA commuters (Census ACS) plus ~1.3M annual PHX-LAX passengers (BTS); Yuma and Blythe agricultural worker flow.' },
    { target: 'Nevada', riskWeight: 0.82, commuters: 18000, airPassengers: 1400, travelVolume: 19400, adjacent: true, mechanism: 'I-15 + US-93', factors: '~18,000 daily AZ-to-NV commuters (Census ACS); Phoenix-Las Vegas recreational and business corridor via Hoover Dam.' },
    { target: 'New Mexico', riskWeight: 0.76, commuters: 9500, airPassengers: 200, travelVolume: 9700, adjacent: true, mechanism: 'I-10/I-40 corridor', factors: '~9,500 daily AZ-to-NM commuters (Census ACS); Navajo Nation spans the border, shared tribal communities.' },
    { target: 'Colorado', riskWeight: 0.65, commuters: 3200, airPassengers: 1200, travelVolume: 4400, adjacent: false, mechanism: 'Air travel (PHX-DEN)', factors: '~440k annual PHX-DEN passengers (BTS); Denver hub for business and outdoor-recreation travel.' },
    { target: 'Texas', riskWeight: 0.67, commuters: 4000, airPassengers: 1700, travelVolume: 5700, adjacent: false, mechanism: 'Air travel (PHX-DFW/IAH)', factors: '~620k annual PHX-DFW passengers (BTS); sun-belt business corridor.' },
  ],
  'Arkansas': [
    { target: 'Tennessee', riskWeight: 0.80, commuters: 20000, airPassengers: 200, travelVolume: 20200, adjacent: true, mechanism: 'I-40 + Memphis metro', factors: '~20,000 daily AR-to-TN commuters (Census ACS); West Memphis is part of greater Memphis MSA.' },
    { target: 'Texas', riskWeight: 0.77, commuters: 16000, airPassengers: 900, travelVolume: 16900, adjacent: true, mechanism: 'I-30 + Texarkana', factors: '~16,000 daily AR-to-TX commuters (Census ACS); Texarkana spans the border, Little Rock-Dallas business traffic.' },
    { target: 'Missouri', riskWeight: 0.77, commuters: 16500, airPassengers: 250, travelVolume: 16750, adjacent: true, mechanism: 'US-65/I-49', factors: '~16,500 daily AR-to-MO commuters (Census ACS); Bella Vista-Branson corridor, shared Ozark labor market.' },
    { target: 'Oklahoma', riskWeight: 0.73, commuters: 9000, airPassengers: 150, travelVolume: 9150, adjacent: true, mechanism: 'I-40/US-59', factors: '~9,000 daily AR-to-OK commuters (Census ACS); Fort Smith-Sallisaw shared labor market.' },
    { target: 'Mississippi', riskWeight: 0.71, commuters: 6500, airPassengers: 100, travelVolume: 6600, adjacent: true, mechanism: 'US-82/US-49 Delta', factors: '~6,500 daily AR-to-MS commuters (Census ACS); Mississippi Delta shared agricultural communities.' },
  ],
  'California': [
    { target: 'Nevada', riskWeight: 0.85, commuters: 28000, airPassengers: 4800, travelVolume: 32800, adjacent: true, mechanism: 'I-15 + LAX/SFO-LAS air', factors: '~28,000 daily CA-to-NV commuters (Census ACS) plus ~1.75M annual LAX-LAS passengers (BTS); one of the nation\'s busiest travel corridors.' },
    { target: 'Arizona', riskWeight: 0.83, commuters: 26000, airPassengers: 3500, travelVolume: 29500, adjacent: true, mechanism: 'I-10/I-8 + LAX-PHX air', factors: '~26,000 daily CA-to-AZ commuters (Census ACS); LAX-PHX is a top-15 US air route (~1.3M/yr BTS).' },
    { target: 'Oregon', riskWeight: 0.76, commuters: 15000, airPassengers: 1800, travelVolume: 16800, adjacent: true, mechanism: 'I-5 + SFO/LAX-PDX air', factors: '~15,000 daily CA-to-OR commuters (Census ACS); I-5 Pacific coast corridor plus ~650k annual SFO-PDX passengers.' },
    { target: 'Texas', riskWeight: 0.70, commuters: 6000, airPassengers: 9500, travelVolume: 15500, adjacent: false, mechanism: 'Air (LAX-DFW, SFO-IAH)', factors: 'LAX-DFW ~2.3M annual passengers (BTS), a top-5 domestic route; two largest state economies by GDP.' },
    { target: 'New York', riskWeight: 0.71, commuters: 4500, airPassengers: 11500, travelVolume: 16000, adjacent: false, mechanism: 'Air (LAX-JFK, SFO-JFK)', factors: 'LAX-JFK ~3.5M annual passengers (BTS 2023) = ~9,600/day, the busiest transcontinental corridor in the US.' },
  ],
  'Colorado': [
    { target: 'Wyoming', riskWeight: 0.75, commuters: 11500, airPassengers: 150, travelVolume: 11650, adjacent: true, mechanism: 'I-25 Front Range', factors: '~11,500 daily CO-to-WY commuters (Census ACS); Cheyenne is effectively a Fort Collins/Denver exurb.' },
    { target: 'Texas', riskWeight: 0.69, commuters: 3500, airPassengers: 2400, travelVolume: 5900, adjacent: false, mechanism: 'Air (DEN-DFW/IAH)', factors: '~880k annual DEN-DFW passengers (BTS); major business and energy-sector air corridor.' },
    { target: 'Kansas', riskWeight: 0.70, commuters: 5500, airPassengers: 250, travelVolume: 5750, adjacent: true, mechanism: 'I-70 corridor', factors: '~5,500 daily CO-to-KS commuters (Census ACS); I-70 agricultural and commercial traffic.' },
    { target: 'New Mexico', riskWeight: 0.71, commuters: 6200, airPassengers: 400, travelVolume: 6600, adjacent: true, mechanism: 'I-25 Raton Pass', factors: '~6,200 daily CO-to-NM commuters (Census ACS); I-25 Front Range extends into Santa Fe/Albuquerque.' },
    { target: 'Utah', riskWeight: 0.65, commuters: 3000, airPassengers: 900, travelVolume: 3900, adjacent: true, mechanism: 'I-70 + DEN-SLC air', factors: '~3,000 daily CO-to-UT commuters (Census ACS); Mountain West corridor, ski-season traffic.' },
  ],
  'Connecticut': [
    { target: 'New York', riskWeight: 0.94, commuters: 105000, airPassengers: 1200, travelVolume: 106200, adjacent: true, mechanism: 'I-95 + Metro-North', factors: '~105,000 daily CT-to-NY commuters (Census ACS 2016-2020); Stamford-Greenwich feeds directly into NYC via Metro-North.' },
    { target: 'Massachusetts', riskWeight: 0.84, commuters: 29000, airPassengers: 400, travelVolume: 29400, adjacent: true, mechanism: 'I-91/I-84', factors: '~29,000 daily CT-to-MA commuters (Census ACS); Hartford-Springfield-Worcester shared Knowledge Corridor.' },
    { target: 'Rhode Island', riskWeight: 0.76, commuters: 11000, airPassengers: 100, travelVolume: 11100, adjacent: true, mechanism: 'I-95 + I-395', factors: '~11,000 daily CT-to-RI commuters (Census ACS); northeast corridor continuation into Providence.' },
    { target: 'New Jersey', riskWeight: 0.63, commuters: 5500, airPassengers: 200, travelVolume: 5700, adjacent: false, mechanism: 'I-95 through NYC', factors: '~5,500 daily CT-to-NJ commuters (Census ACS); through-NYC traffic and Newark hub connections.' },
  ],
  'Delaware': [
    { target: 'Pennsylvania', riskWeight: 0.85, commuters: 36000, airPassengers: 100, travelVolume: 36100, adjacent: true, mechanism: 'I-95 + commuter rail', factors: '~36,000 daily DE-to-PA commuters (Census ACS); Wilmington is part of greater Philadelphia MSA.' },
    { target: 'Maryland', riskWeight: 0.77, commuters: 14500, airPassengers: 150, travelVolume: 14650, adjacent: true, mechanism: 'I-95/US-13 Delmarva', factors: '~14,500 daily DE-to-MD commuters (Census ACS); Delmarva Peninsula and Baltimore-exurb traffic.' },
    { target: 'New Jersey', riskWeight: 0.78, commuters: 16000, airPassengers: 200, travelVolume: 16200, adjacent: true, mechanism: 'Delaware Memorial Br.', factors: '~16,000 daily DE-to-NJ commuters (Census ACS); Delaware Memorial Bridge is the critical I-295/NJTP link.' },
  ],
  'Florida': [
    { target: 'Georgia', riskWeight: 0.84, commuters: 26000, airPassengers: 3200, travelVolume: 29200, adjacent: true, mechanism: 'I-75/I-95 + MIA-ATL air', factors: '~26,000 daily FL-to-GA commuters (Census ACS); MIA-ATL ~1.1M annual passengers (BTS), ATL is the Southeast\'s largest hub.' },
    { target: 'New York', riskWeight: 0.73, commuters: 5200, airPassengers: 9200, travelVolume: 14400, adjacent: false, mechanism: 'Air (MIA/FLL-JFK/LGA)', factors: 'JFK-MIA ~2.6M annual passengers (BTS 2023) = ~7,100/day; dominant snowbird and tourism corridor year-round.' },
    { target: 'Alabama', riskWeight: 0.77, commuters: 14500, airPassengers: 500, travelVolume: 15000, adjacent: true, mechanism: 'I-10 Gulf Coast', factors: '~14,500 daily FL-to-AL commuters (Census ACS); Pensacola-Mobile shared Gulf Coast metro.' },
    { target: 'Texas', riskWeight: 0.69, commuters: 3500, airPassengers: 5200, travelVolume: 8700, adjacent: false, mechanism: 'Air (MIA-DFW/IAH)', factors: 'MIA-DFW + FLL-IAH combined ~1.9M annual passengers (BTS); major business and Latin America connecting traffic.' },
    { target: 'North Carolina', riskWeight: 0.65, commuters: 3800, airPassengers: 2800, travelVolume: 6600, adjacent: false, mechanism: 'I-95 + CLT-MIA air', factors: '~3,800 daily FL-to-NC commuters (Census ACS); CLT-MIA ~1.0M annual passengers (BTS), major I-95 migration route.' },
  ],
  'Georgia': [
    { target: 'Florida', riskWeight: 0.84, commuters: 25500, airPassengers: 3200, travelVolume: 28700, adjacent: true, mechanism: 'I-75/I-95 + ATL-MIA', factors: '~25,500 daily GA-to-FL commuters (Census ACS); Atlanta-Jacksonville-South Florida corridor is the Southeast\'s busiest.' },
    { target: 'Alabama', riskWeight: 0.83, commuters: 29000, airPassengers: 400, travelVolume: 29400, adjacent: true, mechanism: 'I-85/I-20', factors: '~29,000 daily GA-to-AL commuters (Census ACS); Atlanta-Birmingham business corridor plus Columbus-Phenix City shared metro.' },
    { target: 'South Carolina', riskWeight: 0.82, commuters: 24000, airPassengers: 500, travelVolume: 24500, adjacent: true, mechanism: 'I-20/I-85 + Augusta', factors: '~24,000 daily GA-to-SC commuters (Census ACS); Augusta-Aiken and Savannah-Hilton Head cross-border metros.' },
    { target: 'Tennessee', riskWeight: 0.82, commuters: 25000, airPassengers: 700, travelVolume: 25700, adjacent: true, mechanism: 'I-75 + ATL-BNA air', factors: '~25,000 daily GA-to-TN commuters (Census ACS); Chattanooga-North Georgia metro plus Atlanta-Nashville air route.' },
    { target: 'North Carolina', riskWeight: 0.78, commuters: 14000, airPassengers: 1900, travelVolume: 15900, adjacent: true, mechanism: 'I-85 + ATL-CLT air', factors: '~14,000 daily GA-to-NC commuters (Census ACS); ATL-CLT ~700k annual passengers (BTS), two Southeast hubs.' },
  ],
  'Hawaii': [
    { target: 'California', riskWeight: 0.62, commuters: 300, airPassengers: 8500, travelVolume: 8800, adjacent: false, mechanism: 'Air (HNL-LAX/SFO)', factors: 'HNL-LAX ~1.8M + HNL-SFO ~1.3M annual passengers (BTS); the primary mainland Pacific gateway.' },
    { target: 'Washington', riskWeight: 0.49, commuters: 100, airPassengers: 2600, travelVolume: 2700, adjacent: false, mechanism: 'Air (HNL-SEA)', factors: '~950k annual HNL-SEA passengers (BTS); Pacific Northwest secondary gateway.' },
    { target: 'Nevada', riskWeight: 0.41, commuters: 50, airPassengers: 1400, travelVolume: 1450, adjacent: false, mechanism: 'Air (HNL-LAS)', factors: '~500k annual HNL-LAS passengers (BTS); "ninth island" Las Vegas has a large Hawaiian diaspora.' },
  ],
  'Idaho': [
    { target: 'Utah', riskWeight: 0.77, commuters: 14000, airPassengers: 250, travelVolume: 14250, adjacent: true, mechanism: 'I-15/I-84', factors: '~14,000 daily ID-to-UT commuters (Census ACS); Boise/Pocatello-Salt Lake corridor, shared LDS cultural ties.' },
    { target: 'Washington', riskWeight: 0.78, commuters: 16000, airPassengers: 400, travelVolume: 16400, adjacent: true, mechanism: 'I-90/US-95', factors: '~16,000 daily ID-to-WA commuters (Census ACS); Spokane pulls from North Idaho, Lewiston-Clarkston shared metro.' },
    { target: 'Oregon', riskWeight: 0.75, commuters: 11000, airPassengers: 350, travelVolume: 11350, adjacent: true, mechanism: 'I-84 Snake River', factors: '~11,000 daily ID-to-OR commuters (Census ACS); Boise-Ontario shared metro, Columbia Gorge corridor.' },
    { target: 'Montana', riskWeight: 0.69, commuters: 4500, airPassengers: 150, travelVolume: 4650, adjacent: true, mechanism: 'I-90/US-93', factors: '~4,500 daily ID-to-MT commuters (Census ACS); Coeur d\'Alene-Missoula Bitterroot corridor.' },
    { target: 'Nevada', riskWeight: 0.62, commuters: 2500, airPassengers: 200, travelVolume: 2700, adjacent: true, mechanism: 'US-93 Great Basin', factors: '~2,500 daily ID-to-NV commuters (Census ACS); Twin Falls-Jackpot-Elko corridor.' },
  ],
  'Illinois': [
    { target: 'Indiana', riskWeight: 0.87, commuters: 44000, airPassengers: 400, travelVolume: 44400, adjacent: true, mechanism: 'I-80/I-94 Chicago-Gary', factors: '~44,000 daily IL-to-IN commuters (Census ACS); Chicago metro extends into Lake and Porter counties.' },
    { target: 'Wisconsin', riskWeight: 0.85, commuters: 35000, airPassengers: 300, travelVolume: 35300, adjacent: true, mechanism: 'I-94 Chicago-Milwaukee', factors: '~35,000 daily IL-to-WI commuters (Census ACS); Lake County feeds Milwaukee and Kenosha-Racine.' },
    { target: 'Missouri', riskWeight: 0.81, commuters: 22000, airPassengers: 800, travelVolume: 22800, adjacent: true, mechanism: 'I-55/I-70 + STL metro', factors: '~22,000 daily IL-to-MO commuters (Census ACS); East St. Louis is part of greater St. Louis MSA.' },
    { target: 'Iowa', riskWeight: 0.74, commuters: 11000, airPassengers: 300, travelVolume: 11300, adjacent: true, mechanism: 'I-80/I-88 Quad Cities', factors: '~11,000 daily IL-to-IA commuters (Census ACS); Quad Cities spans the Mississippi River border.' },
    { target: 'Kentucky', riskWeight: 0.67, commuters: 4500, airPassengers: 200, travelVolume: 4700, adjacent: true, mechanism: 'I-24/I-57', factors: '~4,500 daily IL-to-KY commuters (Census ACS); Paducah-Metropolis shared Ohio River metro.' },
  ],
  'Indiana': [
    { target: 'Illinois', riskWeight: 0.86, commuters: 40000, airPassengers: 400, travelVolume: 40400, adjacent: true, mechanism: 'I-80/I-94 + Chicago', factors: '~40,000 daily IN-to-IL commuters (Census ACS); NW Indiana is part of Chicago MSA.' },
    { target: 'Ohio', riskWeight: 0.82, commuters: 25000, airPassengers: 300, travelVolume: 25300, adjacent: true, mechanism: 'I-70/I-74', factors: '~25,000 daily IN-to-OH commuters (Census ACS); Indianapolis-Columbus/Dayton corridor, Richmond-Eaton shared labor market.' },
    { target: 'Kentucky', riskWeight: 0.81, commuters: 22000, airPassengers: 250, travelVolume: 22250, adjacent: true, mechanism: 'I-65 + Louisville', factors: '~22,000 daily IN-to-KY commuters (Census ACS); Louisville MSA spans both states via I-65 bridges.' },
    { target: 'Michigan', riskWeight: 0.75, commuters: 12500, airPassengers: 200, travelVolume: 12700, adjacent: true, mechanism: 'I-69/US-31', factors: '~12,500 daily IN-to-MI commuters (Census ACS); South Bend-Niles and Elkhart-St. Joseph shared metros.' },
  ],
  'Iowa': [
    { target: 'Illinois', riskWeight: 0.81, commuters: 22500, airPassengers: 300, travelVolume: 22800, adjacent: true, mechanism: 'I-80/I-88 Quad Cities', factors: '~22,500 daily IA-to-IL commuters (Census ACS); Quad Cities MSA spans the Mississippi.' },
    { target: 'Nebraska', riskWeight: 0.81, commuters: 22000, airPassengers: 250, travelVolume: 22250, adjacent: true, mechanism: 'I-80 Omaha-CB', factors: '~22,000 daily IA-to-NE commuters (Census ACS); Omaha-Council Bluffs MSA is a single labor market.' },
    { target: 'Minnesota', riskWeight: 0.77, commuters: 15000, airPassengers: 300, travelVolume: 15300, adjacent: true, mechanism: 'I-35', factors: '~15,000 daily IA-to-MN commuters (Census ACS); Des Moines-Minneapolis agribusiness corridor.' },
    { target: 'Missouri', riskWeight: 0.74, commuters: 11000, airPassengers: 200, travelVolume: 11200, adjacent: true, mechanism: 'I-35/I-29', factors: '~11,000 daily IA-to-MO commuters (Census ACS); Kansas City exurbs reach into southern Iowa.' },
    { target: 'Wisconsin', riskWeight: 0.72, commuters: 8500, airPassengers: 150, travelVolume: 8650, adjacent: true, mechanism: 'US-151/US-18', factors: '~8,500 daily IA-to-WI commuters (Census ACS); Dubuque-Madison corridor and Driftless Region.' },
  ],
  'Kansas': [
    { target: 'Missouri', riskWeight: 0.89, commuters: 55000, airPassengers: 200, travelVolume: 55200, adjacent: true, mechanism: 'KC metro (I-35/I-70)', factors: '~55,000 daily KS-to-MO commuters (Census ACS); Kansas City metro is a unified cross-border labor market.' },
    { target: 'Oklahoma', riskWeight: 0.76, commuters: 12500, airPassengers: 200, travelVolume: 12700, adjacent: true, mechanism: 'I-35 corridor', factors: '~12,500 daily KS-to-OK commuters (Census ACS); Wichita-OKC corridor plus Ark City-Ponca City shared labor market.' },
    { target: 'Colorado', riskWeight: 0.71, commuters: 6500, airPassengers: 300, travelVolume: 6800, adjacent: true, mechanism: 'I-70 + DEN-ICT air', factors: '~6,500 daily KS-to-CO commuters (Census ACS); I-70 commercial and agricultural corridor.' },
    { target: 'Nebraska', riskWeight: 0.72, commuters: 7500, airPassengers: 150, travelVolume: 7650, adjacent: true, mechanism: 'US-77/US-81', factors: '~7,500 daily KS-to-NE commuters (Census ACS); Lincoln-Manhattan and Kansas City-Omaha agricultural corridors.' },
  ],
  'Kentucky': [
    { target: 'Indiana', riskWeight: 0.86, commuters: 42000, airPassengers: 250, travelVolume: 42250, adjacent: true, mechanism: 'I-65 + Louisville', factors: '~42,000 daily KY-to-IN commuters (Census ACS); Louisville MSA straddles the Ohio River.' },
    { target: 'Ohio', riskWeight: 0.86, commuters: 42000, airPassengers: 350, travelVolume: 42350, adjacent: true, mechanism: 'I-71/I-75 + CVG', factors: '~42,000 daily KY-to-OH commuters (Census ACS); Northern Kentucky is part of greater Cincinnati MSA, CVG airport sits in KY.' },
    { target: 'Tennessee', riskWeight: 0.81, commuters: 22500, airPassengers: 300, travelVolume: 22800, adjacent: true, mechanism: 'I-65/I-75', factors: '~22,500 daily KY-to-TN commuters (Census ACS); Nashville-Bowling Green and Knoxville-Corbin corridors.' },
    { target: 'West Virginia', riskWeight: 0.73, commuters: 8500, airPassengers: 100, travelVolume: 8600, adjacent: true, mechanism: 'I-64/US-23', factors: '~8,500 daily KY-to-WV commuters (Census ACS); Huntington-Ashland Tri-State metro.' },
    { target: 'Illinois', riskWeight: 0.67, commuters: 4500, airPassengers: 200, travelVolume: 4700, adjacent: true, mechanism: 'I-24/US-45', factors: '~4,500 daily KY-to-IL commuters (Census ACS); Paducah-Metropolis shared Ohio River crossing.' },
  ],
  'Louisiana': [
    { target: 'Texas', riskWeight: 0.84, commuters: 28000, airPassengers: 1400, travelVolume: 29400, adjacent: true, mechanism: 'I-10 + MSY-DFW/IAH', factors: '~28,000 daily LA-to-TX commuters (Census ACS); Beaumont-Lake Charles-Houston petrochemical corridor; MSY-IAH is a dense business route.' },
    { target: 'Mississippi', riskWeight: 0.80, commuters: 19000, airPassengers: 150, travelVolume: 19150, adjacent: true, mechanism: 'I-10/I-55/I-59', factors: '~19,000 daily LA-to-MS commuters (Census ACS); Gulf Coast shared metros and New Orleans-Jackson corridor.' },
    { target: 'Arkansas', riskWeight: 0.72, commuters: 7500, airPassengers: 150, travelVolume: 7650, adjacent: true, mechanism: 'I-20/US-71', factors: '~7,500 daily LA-to-AR commuters (Census ACS); Shreveport-Texarkana corridor and timber industry flow.' },
    { target: 'Florida', riskWeight: 0.57, commuters: 1500, airPassengers: 800, travelVolume: 2300, adjacent: false, mechanism: 'Air (MSY-MIA/MCO)', factors: '~290k annual MSY-MCO passengers (BTS); tourism and convention travel.' },
  ],
  'Maine': [
    { target: 'New Hampshire', riskWeight: 0.80, commuters: 19500, airPassengers: 200, travelVolume: 19700, adjacent: true, mechanism: 'I-95/US-1', factors: '~19,500 daily ME-to-NH commuters (Census ACS); Portsmouth-Kittery border metro and seacoast labor market.' },
    { target: 'Massachusetts', riskWeight: 0.73, commuters: 9000, airPassengers: 300, travelVolume: 9300, adjacent: false, mechanism: 'I-95 + BOS-PWM air', factors: '~9,000 daily ME-to-MA commuters (Census ACS); Boston metro pull on southern Maine, plus frequent BOS-PWM service.' },
    { target: 'Vermont', riskWeight: 0.54, commuters: 1200, airPassengers: 50, travelVolume: 1250, adjacent: false, mechanism: 'US-2 via NH', factors: '~1,200 daily ME-to-VT commuters (Census ACS); small cross-northern New England flow.' },
  ],
  'Maryland': [
    { target: 'Virginia', riskWeight: 0.94, commuters: 130000, airPassengers: 800, travelVolume: 130800, adjacent: true, mechanism: 'I-495/I-95/I-66 DMV', factors: '~130,000 daily MD-to-VA commuters (Census ACS); the DC metro ("DMV") is one of the densest commuter regions in the US.' },
    { target: 'Pennsylvania', riskWeight: 0.83, commuters: 27000, airPassengers: 200, travelVolume: 27200, adjacent: true, mechanism: 'I-83/I-95', factors: '~27,000 daily MD-to-PA commuters (Census ACS); Baltimore-York-Harrisburg and Hagerstown-Chambersburg corridors.' },
    { target: 'Delaware', riskWeight: 0.78, commuters: 16500, airPassengers: 100, travelVolume: 16600, adjacent: true, mechanism: 'I-95/US-13 + Delmarva', factors: '~16,500 daily MD-to-DE commuters (Census ACS); shared Delmarva Peninsula economy.' },
    { target: 'West Virginia', riskWeight: 0.71, commuters: 6500, airPassengers: 50, travelVolume: 6550, adjacent: true, mechanism: 'I-70/I-68', factors: '~6,500 daily MD-to-WV commuters (Census ACS); Cumberland-Morgantown Panhandle corridor.' },
  ],
  'Massachusetts': [
    { target: 'New Hampshire', riskWeight: 0.88, commuters: 55000, airPassengers: 200, travelVolume: 55200, adjacent: true, mechanism: 'I-93/I-95 Boston belt', factors: '~55,000 daily MA-to-NH commuters (Census ACS); southern NH (Nashua, Salem, Manchester) is the Boston exurb belt.' },
    { target: 'Rhode Island', riskWeight: 0.83, commuters: 27000, airPassengers: 150, travelVolume: 27150, adjacent: true, mechanism: 'I-95/I-195', factors: '~27,000 daily MA-to-RI commuters (Census ACS); Providence MSA is economically tied to Boston.' },
    { target: 'Connecticut', riskWeight: 0.82, commuters: 25000, airPassengers: 300, travelVolume: 25300, adjacent: true, mechanism: 'I-84/I-90', factors: '~25,000 daily MA-to-CT commuters (Census ACS); Springfield-Hartford Knowledge Corridor.' },
    { target: 'New York', riskWeight: 0.76, commuters: 11000, airPassengers: 4500, travelVolume: 15500, adjacent: true, mechanism: 'I-90 + BOS-LGA/JFK', factors: '~11,000 daily MA-to-NY commuters (Census ACS); BOS-LGA shuttle ~1.6M annual passengers (BTS), a top business route.' },
    { target: 'Vermont', riskWeight: 0.69, commuters: 5500, airPassengers: 50, travelVolume: 5550, adjacent: true, mechanism: 'I-91', factors: '~5,500 daily MA-to-VT commuters (Census ACS); Connecticut River Valley shared labor market.' },
  ],
  'Michigan': [
    { target: 'Ohio', riskWeight: 0.83, commuters: 27000, airPassengers: 400, travelVolume: 27400, adjacent: true, mechanism: 'I-75/I-80 Detroit-Toledo', factors: '~27,000 daily MI-to-OH commuters (Census ACS); Detroit-Toledo automotive supply chain corridor.' },
    { target: 'Indiana', riskWeight: 0.77, commuters: 14500, airPassengers: 200, travelVolume: 14700, adjacent: true, mechanism: 'I-69/US-12/US-31', factors: '~14,500 daily MI-to-IN commuters (Census ACS); Niles-South Bend and Michiana shared metro.' },
    { target: 'Illinois', riskWeight: 0.69, commuters: 4500, airPassengers: 1800, travelVolume: 6300, adjacent: false, mechanism: 'I-94 + DTW-ORD air', factors: '~4,500 daily MI-to-IL commuters (Census ACS); DTW-ORD ~650k annual passengers (BTS), major auto-industry business route.' },
    { target: 'Wisconsin', riskWeight: 0.66, commuters: 3500, airPassengers: 200, travelVolume: 3700, adjacent: true, mechanism: 'US-41 + UP ferry', factors: '~3,500 daily MI-to-WI commuters (Census ACS); Upper Peninsula connections and Menominee-Marinette shared metro.' },
  ],
  'Minnesota': [
    { target: 'Wisconsin', riskWeight: 0.89, commuters: 58000, airPassengers: 300, travelVolume: 58300, adjacent: true, mechanism: 'I-94/I-35 Twin Cities', factors: '~58,000 daily MN-to-WI commuters (Census ACS); western Wisconsin is the Twin Cities exurb belt.' },
    { target: 'Iowa', riskWeight: 0.75, commuters: 12000, airPassengers: 250, travelVolume: 12250, adjacent: true, mechanism: 'I-35 corridor', factors: '~12,000 daily MN-to-IA commuters (Census ACS); Mason City-Albert Lea shared labor market.' },
    { target: 'North Dakota', riskWeight: 0.74, commuters: 10500, airPassengers: 300, travelVolume: 10800, adjacent: true, mechanism: 'I-94 Fargo-Moorhead', factors: '~10,500 daily MN-to-ND commuters (Census ACS); Fargo-Moorhead is a unified cross-border MSA.' },
    { target: 'South Dakota', riskWeight: 0.70, commuters: 6500, airPassengers: 200, travelVolume: 6700, adjacent: true, mechanism: 'I-90/I-29', factors: '~6,500 daily MN-to-SD commuters (Census ACS); Sioux Falls pulls from southwestern MN.' },
    { target: 'Illinois', riskWeight: 0.62, commuters: 1500, airPassengers: 1800, travelVolume: 3300, adjacent: false, mechanism: 'Air (MSP-ORD)', factors: '~650k annual MSP-ORD passengers (BTS); both Delta and United hub cities.' },
  ],
  'Mississippi': [
    { target: 'Tennessee', riskWeight: 0.80, commuters: 20000, airPassengers: 200, travelVolume: 20200, adjacent: true, mechanism: 'I-55/US-78 + Memphis', factors: '~20,000 daily MS-to-TN commuters (Census ACS); DeSoto County is the fastest-growing part of Memphis MSA.' },
    { target: 'Louisiana', riskWeight: 0.76, commuters: 12500, airPassengers: 200, travelVolume: 12700, adjacent: true, mechanism: 'I-10/I-59 Gulf Coast', factors: '~12,500 daily MS-to-LA commuters (Census ACS); Gulf Coast and Baton Rouge-McComb shared economy.' },
    { target: 'Alabama', riskWeight: 0.76, commuters: 12500, airPassengers: 150, travelVolume: 12650, adjacent: true, mechanism: 'I-20/I-59/I-10', factors: '~12,500 daily MS-to-AL commuters (Census ACS); Meridian-Tuscaloosa and Pascagoula-Mobile corridors.' },
    { target: 'Arkansas', riskWeight: 0.69, commuters: 5500, airPassengers: 100, travelVolume: 5600, adjacent: true, mechanism: 'US-82/US-49 Delta', factors: '~5,500 daily MS-to-AR commuters (Census ACS); Mississippi Delta shared agricultural labor.' },
  ],
  'Missouri': [
    { target: 'Kansas', riskWeight: 0.90, commuters: 60000, airPassengers: 200, travelVolume: 60200, adjacent: true, mechanism: 'KC metro (I-35/I-70)', factors: '~60,000 daily MO-to-KS commuters (Census ACS); Kansas City metro is one of the most balanced cross-border MSAs in the US.' },
    { target: 'Illinois', riskWeight: 0.86, commuters: 40000, airPassengers: 700, travelVolume: 40700, adjacent: true, mechanism: 'I-55/I-70 + STL metro', factors: '~40,000 daily MO-to-IL commuters (Census ACS); St. Louis MSA spans both states across the Mississippi.' },
    { target: 'Arkansas', riskWeight: 0.73, commuters: 8500, airPassengers: 200, travelVolume: 8700, adjacent: true, mechanism: 'US-65/I-49', factors: '~8,500 daily MO-to-AR commuters (Census ACS); Branson-Bella Vista and Ozarks corridor.' },
    { target: 'Tennessee', riskWeight: 0.70, commuters: 6500, airPassengers: 400, travelVolume: 6900, adjacent: true, mechanism: 'I-55 + STL-MEM air', factors: '~6,500 daily MO-to-TN commuters (Census ACS); Memphis pull on southeastern Missouri (Bootheel).' },
    { target: 'Oklahoma', riskWeight: 0.71, commuters: 7000, airPassengers: 150, travelVolume: 7150, adjacent: false, mechanism: 'I-44 + US-71', factors: '~7,000 daily MO-to-OK commuters (Census ACS); Joplin-Miami-Tulsa corridor.' },
  ],
  'Montana': [
    { target: 'Idaho', riskWeight: 0.67, commuters: 3500, airPassengers: 150, travelVolume: 3650, adjacent: true, mechanism: 'I-90/US-93', factors: '~3,500 daily MT-to-ID commuters (Census ACS); Bitterroot Valley and Lolo Pass shared communities.' },
    { target: 'Wyoming', riskWeight: 0.68, commuters: 4000, airPassengers: 100, travelVolume: 4100, adjacent: true, mechanism: 'I-90/I-94 + US-212', factors: '~4,000 daily MT-to-WY commuters (Census ACS); Billings-Sheridan and Yellowstone gateway traffic.' },
    { target: 'North Dakota', riskWeight: 0.66, commuters: 3200, airPassengers: 100, travelVolume: 3300, adjacent: true, mechanism: 'US-2 + Bakken patch', factors: '~3,200 daily MT-to-ND commuters (Census ACS); Bakken oil-patch worker migration across the border.' },
    { target: 'Washington', riskWeight: 0.60, commuters: 2000, airPassengers: 400, travelVolume: 2400, adjacent: false, mechanism: 'I-90 + BZN/MSO-SEA', factors: '~2,000 daily MT-to-WA commuters (Census ACS); Seattle hub for flights from BZN/MSO/BIL.' },
    { target: 'South Dakota', riskWeight: 0.58, commuters: 1500, airPassengers: 75, travelVolume: 1575, adjacent: true, mechanism: 'I-90', factors: '~1,500 daily MT-to-SD commuters (Census ACS); Miles City-Rapid City plains corridor.' },
  ],
  'Nebraska': [
    { target: 'Iowa', riskWeight: 0.82, commuters: 24000, airPassengers: 200, travelVolume: 24200, adjacent: true, mechanism: 'I-80 Omaha-CB', factors: '~24,000 daily NE-to-IA commuters (Census ACS); Omaha-Council Bluffs is a fully integrated cross-state MSA.' },
    { target: 'Kansas', riskWeight: 0.73, commuters: 9000, airPassengers: 150, travelVolume: 9150, adjacent: true, mechanism: 'US-77/I-80', factors: '~9,000 daily NE-to-KS commuters (Census ACS); Lincoln-Manhattan and Omaha-Topeka corridors.' },
    { target: 'Colorado', riskWeight: 0.71, commuters: 7000, airPassengers: 400, travelVolume: 7400, adjacent: true, mechanism: 'I-76/I-80 + OMA-DEN', factors: '~7,000 daily NE-to-CO commuters (Census ACS); Denver metro pull on western Nebraska.' },
    { target: 'South Dakota', riskWeight: 0.68, commuters: 5000, airPassengers: 100, travelVolume: 5100, adjacent: true, mechanism: 'I-29/US-81', factors: '~5,000 daily NE-to-SD commuters (Census ACS); Sioux City-South Sioux City shared metro.' },
    { target: 'Missouri', riskWeight: 0.67, commuters: 4500, airPassengers: 150, travelVolume: 4650, adjacent: true, mechanism: 'I-29/US-75', factors: '~4,500 daily NE-to-MO commuters (Census ACS); St. Joseph and Kansas City northern exurbs.' },
  ],
  'Nevada': [
    { target: 'California', riskWeight: 0.84, commuters: 26000, airPassengers: 4800, travelVolume: 30800, adjacent: true, mechanism: 'I-15 + LAS-LAX air', factors: '~26,000 daily NV-to-CA commuters (Census ACS); LAS-LAX ~1.75M annual passengers (BTS), a top-10 domestic route.' },
    { target: 'Arizona', riskWeight: 0.77, commuters: 14000, airPassengers: 1300, travelVolume: 15300, adjacent: true, mechanism: 'US-93 + LAS-PHX', factors: '~14,000 daily NV-to-AZ commuters (Census ACS); LAS-PHX ~440k annual passengers (BTS).' },
    { target: 'Utah', riskWeight: 0.73, commuters: 8500, airPassengers: 600, travelVolume: 9100, adjacent: true, mechanism: 'I-15 corridor', factors: '~8,500 daily NV-to-UT commuters (Census ACS); Mesquite-St. George Virgin River corridor.' },
    { target: 'Oregon', riskWeight: 0.65, commuters: 3500, airPassengers: 350, travelVolume: 3850, adjacent: true, mechanism: 'US-95 Great Basin', factors: '~3,500 daily NV-to-OR commuters (Census ACS); Reno-Klamath Falls corridor.' },
    { target: 'Idaho', riskWeight: 0.61, commuters: 2500, airPassengers: 200, travelVolume: 2700, adjacent: true, mechanism: 'US-93', factors: '~2,500 daily NV-to-ID commuters (Census ACS); Jackpot-Twin Falls border flow.' },
  ],
  'New Hampshire': [
    { target: 'Massachusetts', riskWeight: 0.91, commuters: 95000, airPassengers: 300, travelVolume: 95300, adjacent: true, mechanism: 'I-93/I-95 Boston belt', factors: '~95,000 daily NH-to-MA commuters (Census ACS); the densest ME/NH/VT-to-Boston flow, reverse-commuted to Boston jobs.' },
    { target: 'Maine', riskWeight: 0.77, commuters: 14000, airPassengers: 100, travelVolume: 14100, adjacent: true, mechanism: 'I-95 Seacoast', factors: '~14,000 daily NH-to-ME commuters (Census ACS); Portsmouth-Kittery shared seacoast metro.' },
    { target: 'Vermont', riskWeight: 0.73, commuters: 9000, airPassengers: 50, travelVolume: 9050, adjacent: true, mechanism: 'I-89/I-91 Upper Valley', factors: '~9,000 daily NH-to-VT commuters (Census ACS); Dartmouth-Hitchcock medical center and Upper Valley labor market.' },
    { target: 'Connecticut', riskWeight: 0.58, commuters: 1500, airPassengers: 100, travelVolume: 1600, adjacent: false, mechanism: 'I-91 via MA', factors: '~1,500 daily NH-to-CT commuters (Census ACS); smaller secondary flow through Massachusetts.' },
  ],
  'New Jersey': [
    { target: 'New York', riskWeight: 1.00, commuters: 400000, airPassengers: 7000, travelVolume: 407000, adjacent: true, mechanism: 'PATH/NJT/tunnels/bridges', factors: '~400,000 daily NJ-to-NY commuters (Census ACS 2016-2020) — the largest interstate commuter flow in the United States; plus EWR-LGA-JFK shuttle traffic.' },
    { target: 'Pennsylvania', riskWeight: 0.90, commuters: 75000, airPassengers: 500, travelVolume: 75500, adjacent: true, mechanism: 'I-95 + Philly metro', factors: '~75,000 daily NJ-to-PA commuters (Census ACS); South Jersey is part of greater Philadelphia MSA.' },
    { target: 'Delaware', riskWeight: 0.76, commuters: 12500, airPassengers: 150, travelVolume: 12650, adjacent: true, mechanism: 'Delaware Memorial Br.', factors: '~12,500 daily NJ-to-DE commuters (Census ACS); critical chemical/refinery corridor.' },
    { target: 'Connecticut', riskWeight: 0.62, commuters: 3500, airPassengers: 200, travelVolume: 3700, adjacent: false, mechanism: 'Via NYC + I-95', factors: '~3,500 daily NJ-to-CT commuters (Census ACS); through-NYC movement into Fairfield County.' },
  ],
  'New Mexico': [
    { target: 'Texas', riskWeight: 0.84, commuters: 28500, airPassengers: 500, travelVolume: 29000, adjacent: true, mechanism: 'I-10/I-25 + El Paso', factors: '~28,500 daily NM-to-TX commuters (Census ACS); Las Cruces-El Paso is a unified cross-border MSA.' },
    { target: 'Colorado', riskWeight: 0.75, commuters: 11500, airPassengers: 350, travelVolume: 11850, adjacent: true, mechanism: 'I-25 Front Range', factors: '~11,500 daily NM-to-CO commuters (Census ACS); Santa Fe-Trinidad-Pueblo corridor.' },
    { target: 'Arizona', riskWeight: 0.74, commuters: 10500, airPassengers: 250, travelVolume: 10750, adjacent: true, mechanism: 'I-40/I-10', factors: '~10,500 daily NM-to-AZ commuters (Census ACS); Gallup-Window Rock Navajo Nation shared communities.' },
    { target: 'Oklahoma', riskWeight: 0.56, commuters: 1500, airPassengers: 100, travelVolume: 1600, adjacent: false, mechanism: 'I-40 via TX panhandle', factors: '~1,500 daily NM-to-OK commuters (Census ACS); I-40 commercial corridor through Amarillo.' },
    { target: 'Utah', riskWeight: 0.53, commuters: 1000, airPassengers: 100, travelVolume: 1100, adjacent: false, mechanism: 'US-491 Four Corners', factors: '~1,000 daily NM-to-UT commuters (Census ACS); Four Corners tribal and energy-sector flow.' },
  ],
  'New York': [
    { target: 'New Jersey', riskWeight: 0.98, commuters: 175000, airPassengers: 7000, travelVolume: 182000, adjacent: true, mechanism: 'PATH/tunnels/bridges', factors: '~175,000 daily NY-to-NJ reverse commuters (Census ACS); NYC metro is the densest bi-state labor market in the US.' },
    { target: 'Connecticut', riskWeight: 0.82, commuters: 22500, airPassengers: 400, travelVolume: 22900, adjacent: true, mechanism: 'I-95 + Metro-North', factors: '~22,500 daily NY-to-CT reverse commuters (Census ACS); Fairfield County integrated into NYC job market.' },
    { target: 'Pennsylvania', riskWeight: 0.79, commuters: 16500, airPassengers: 900, travelVolume: 17400, adjacent: true, mechanism: 'I-81/I-84 + LGA-PHL', factors: '~16,500 daily NY-to-PA commuters (Census ACS); Scranton-Binghamton corridor plus LGA-PHL shuttle traffic.' },
    { target: 'Florida', riskWeight: 0.76, commuters: 4500, airPassengers: 9200, travelVolume: 13700, adjacent: false, mechanism: 'Air (JFK/LGA-MIA/MCO)', factors: 'JFK-MIA ~2.6M annual passengers (BTS 2023) = ~7,100/day; the dominant snowbird corridor in the US.' },
    { target: 'Massachusetts', riskWeight: 0.74, commuters: 9000, airPassengers: 4500, travelVolume: 13500, adjacent: true, mechanism: 'I-90 + LGA-BOS shuttle', factors: '~9,000 daily NY-to-MA commuters (Census ACS); LGA-BOS shuttle ~1.6M annual passengers (BTS).' },
  ],
  'North Carolina': [
    { target: 'Virginia', riskWeight: 0.84, commuters: 28000, airPassengers: 1400, travelVolume: 29400, adjacent: true, mechanism: 'I-85/I-95 + CLT-IAD', factors: '~28,000 daily NC-to-VA commuters (Census ACS); Raleigh-Durham-Richmond-DC I-85/95 corridor.' },
    { target: 'South Carolina', riskWeight: 0.83, commuters: 27000, airPassengers: 300, travelVolume: 27300, adjacent: true, mechanism: 'I-85/I-77 + Charlotte', factors: '~27,000 daily NC-to-SC commuters (Census ACS); Charlotte MSA extends deep into York/Lancaster counties, SC.' },
    { target: 'Tennessee', riskWeight: 0.74, commuters: 10000, airPassengers: 400, travelVolume: 10400, adjacent: true, mechanism: 'I-40/I-26 Appalachia', factors: '~10,000 daily NC-to-TN commuters (Census ACS); Asheville-Knoxville mountain corridor.' },
    { target: 'Georgia', riskWeight: 0.77, commuters: 13500, airPassengers: 1900, travelVolume: 15400, adjacent: true, mechanism: 'I-85 + CLT-ATL air', factors: '~13,500 daily NC-to-GA commuters (Census ACS); CLT-ATL ~700k annual passengers (BTS), the Southeast\'s two hub cities.' },
    { target: 'Florida', riskWeight: 0.68, commuters: 4200, airPassengers: 2800, travelVolume: 7000, adjacent: false, mechanism: 'I-95 + CLT-MIA', factors: '~4,200 daily NC-to-FL commuters (Census ACS); CLT-MIA ~1.0M annual passengers (BTS), major retirement/migration corridor.' },
  ],
  'North Dakota': [
    { target: 'Minnesota', riskWeight: 0.77, commuters: 14000, airPassengers: 300, travelVolume: 14300, adjacent: true, mechanism: 'I-94 Fargo-Moorhead', factors: '~14,000 daily ND-to-MN commuters (Census ACS); Fargo-Moorhead is a unified cross-border MSA.' },
    { target: 'Montana', riskWeight: 0.65, commuters: 3000, airPassengers: 100, travelVolume: 3100, adjacent: true, mechanism: 'US-2 + Bakken patch', factors: '~3,000 daily ND-to-MT commuters (Census ACS); Bakken oil-patch worker migration.' },
    { target: 'South Dakota', riskWeight: 0.64, commuters: 2800, airPassengers: 100, travelVolume: 2900, adjacent: true, mechanism: 'I-29', factors: '~2,800 daily ND-to-SD commuters (Census ACS); I-29 Red River Valley agricultural corridor.' },
  ],
  'Ohio': [
    { target: 'Kentucky', riskWeight: 0.87, commuters: 44000, airPassengers: 350, travelVolume: 44350, adjacent: true, mechanism: 'I-71/I-75 + CVG', factors: '~44,000 daily OH-to-KY commuters (Census ACS); Cincinnati MSA is fully cross-state with CVG airport sitting in Kentucky.' },
    { target: 'Pennsylvania', riskWeight: 0.83, commuters: 26500, airPassengers: 400, travelVolume: 26900, adjacent: true, mechanism: 'I-76/I-80', factors: '~26,500 daily OH-to-PA commuters (Census ACS); Youngstown-Pittsburgh steel-belt corridor.' },
    { target: 'Indiana', riskWeight: 0.82, commuters: 24500, airPassengers: 300, travelVolume: 24800, adjacent: true, mechanism: 'I-70/I-74', factors: '~24,500 daily OH-to-IN commuters (Census ACS); Richmond-Eaton, Dayton-Muncie shared labor markets.' },
    { target: 'Michigan', riskWeight: 0.82, commuters: 24000, airPassengers: 400, travelVolume: 24400, adjacent: true, mechanism: 'I-75 Toledo-Detroit', factors: '~24,000 daily OH-to-MI commuters (Census ACS); Toledo-Monroe-Detroit auto supply chain.' },
    { target: 'West Virginia', riskWeight: 0.73, commuters: 8500, airPassengers: 50, travelVolume: 8550, adjacent: true, mechanism: 'I-70/I-77 + Ohio Riv.', factors: '~8,500 daily OH-to-WV commuters (Census ACS); Wheeling-St. Clairsville and Parkersburg-Marietta shared metros.' },
  ],
  'Oklahoma': [
    { target: 'Texas', riskWeight: 0.85, commuters: 31000, airPassengers: 1500, travelVolume: 32500, adjacent: true, mechanism: 'I-35 + OKC-DFW air', factors: '~31,000 daily OK-to-TX commuters (Census ACS); I-35 OKC-Dallas corridor plus ~650k annual OKC-DFW passengers (BTS).' },
    { target: 'Arkansas', riskWeight: 0.74, commuters: 10000, airPassengers: 150, travelVolume: 10150, adjacent: true, mechanism: 'I-40 + US-59', factors: '~10,000 daily OK-to-AR commuters (Census ACS); Fort Smith-Poteau and Siloam Springs corridor.' },
    { target: 'Kansas', riskWeight: 0.73, commuters: 9000, airPassengers: 200, travelVolume: 9200, adjacent: true, mechanism: 'I-35 corridor', factors: '~9,000 daily OK-to-KS commuters (Census ACS); Ponca City-Arkansas City Wheat Belt corridor.' },
    { target: 'Missouri', riskWeight: 0.72, commuters: 7500, airPassengers: 250, travelVolume: 7750, adjacent: false, mechanism: 'I-44 + US-71', factors: '~7,500 daily OK-to-MO commuters (Census ACS); Tulsa-Joplin-Springfield Route 66 corridor.' },
    { target: 'Colorado', riskWeight: 0.60, commuters: 2200, airPassengers: 300, travelVolume: 2500, adjacent: false, mechanism: 'Air (OKC-DEN)', factors: '~2,200 daily OK-to-CO commuters (Census ACS); ~215k annual OKC-DEN passengers (BTS).' },
  ],
  'Oregon': [
    { target: 'Washington', riskWeight: 0.89, commuters: 60000, airPassengers: 700, travelVolume: 60700, adjacent: true, mechanism: 'I-5 Portland-Vancouver', factors: '~60,000 daily OR-to-WA commuters (Census ACS); Portland-Vancouver MSA is a fully integrated cross-state metro.' },
    { target: 'California', riskWeight: 0.77, commuters: 14500, airPassengers: 1800, travelVolume: 16300, adjacent: true, mechanism: 'I-5 + PDX-SFO/LAX', factors: '~14,500 daily OR-to-CA commuters (Census ACS); PDX-SFO ~650k annual passengers (BTS).' },
    { target: 'Idaho', riskWeight: 0.73, commuters: 9000, airPassengers: 300, travelVolume: 9300, adjacent: true, mechanism: 'I-84 Snake River', factors: '~9,000 daily OR-to-ID commuters (Census ACS); Ontario-Boise shared metro.' },
    { target: 'Nevada', riskWeight: 0.60, commuters: 2000, airPassengers: 300, travelVolume: 2300, adjacent: true, mechanism: 'US-95 Great Basin', factors: '~2,000 daily OR-to-NV commuters (Census ACS); Reno-Lakeview corridor.' },
  ],
  'Pennsylvania': [
    { target: 'New Jersey', riskWeight: 0.89, commuters: 65000, airPassengers: 500, travelVolume: 65500, adjacent: true, mechanism: 'I-95 + Philly bridges', factors: '~65,000 daily PA-to-NJ commuters (Census ACS); Philadelphia MSA extends across six Delaware River bridges.' },
    { target: 'Maryland', riskWeight: 0.79, commuters: 18000, airPassengers: 200, travelVolume: 18200, adjacent: true, mechanism: 'I-83/I-95', factors: '~18,000 daily PA-to-MD commuters (Census ACS); Baltimore exurbs extend into York and Chambersburg.' },
    { target: 'Ohio', riskWeight: 0.80, commuters: 19500, airPassengers: 400, travelVolume: 19900, adjacent: true, mechanism: 'I-76/I-80', factors: '~19,500 daily PA-to-OH commuters (Census ACS); Pittsburgh-Youngstown-Cleveland corridor.' },
    { target: 'Delaware', riskWeight: 0.74, commuters: 10500, airPassengers: 100, travelVolume: 10600, adjacent: true, mechanism: 'I-95 Philly exurbs', factors: '~10,500 daily PA-to-DE commuters (Census ACS); Wilmington pulls PA workers to MBNA/DuPont corridor.' },
    { target: 'New York', riskWeight: 0.73, commuters: 8500, airPassengers: 900, travelVolume: 9400, adjacent: true, mechanism: 'I-81/I-84 + PHL-LGA', factors: '~8,500 daily PA-to-NY commuters (Census ACS); Scranton-Binghamton and PHL-LGA shuttle.' },
  ],
  'Rhode Island': [
    { target: 'Massachusetts', riskWeight: 0.85, commuters: 33000, airPassengers: 150, travelVolume: 33150, adjacent: true, mechanism: 'I-95/I-195 Providence', factors: '~33,000 daily RI-to-MA commuters (Census ACS); Providence MSA is economically part of greater Boston.' },
    { target: 'Connecticut', riskWeight: 0.78, commuters: 14500, airPassengers: 50, travelVolume: 14550, adjacent: true, mechanism: 'I-95', factors: '~14,500 daily RI-to-CT commuters (Census ACS); Northeast Corridor continuation through New London.' },
    { target: 'New York', riskWeight: 0.57, commuters: 1500, airPassengers: 300, travelVolume: 1800, adjacent: false, mechanism: 'I-95 + PVD-LGA air', factors: '~1,500 daily RI-to-NY commuters (Census ACS); TF Green-LGA shuttle secondary route.' },
  ],
  'South Carolina': [
    { target: 'North Carolina', riskWeight: 0.85, commuters: 33000, airPassengers: 400, travelVolume: 33400, adjacent: true, mechanism: 'I-85/I-77 + Charlotte', factors: '~33,000 daily SC-to-NC commuters (Census ACS); Rock Hill-Charlotte reverse commute is one of the densest in the Southeast.' },
    { target: 'Georgia', riskWeight: 0.81, commuters: 22000, airPassengers: 400, travelVolume: 22400, adjacent: true, mechanism: 'I-20/I-85 + Savannah', factors: '~22,000 daily SC-to-GA commuters (Census ACS); Aiken-Augusta and Bluffton-Savannah shared metros.' },
    { target: 'Florida', riskWeight: 0.64, commuters: 3000, airPassengers: 1100, travelVolume: 4100, adjacent: false, mechanism: 'I-95 + CHS-MCO air', factors: '~3,000 daily SC-to-FL commuters (Census ACS); I-95 migration and Charleston-Orlando tourism flow.' },
    { target: 'Tennessee', riskWeight: 0.60, commuters: 2200, airPassengers: 200, travelVolume: 2400, adjacent: false, mechanism: 'I-26/I-40 via NC', factors: '~2,200 daily SC-to-TN commuters (Census ACS); Greenville-Asheville-Knoxville mountain corridor.' },
  ],
  'South Dakota': [
    { target: 'Minnesota', riskWeight: 0.72, commuters: 7500, airPassengers: 200, travelVolume: 7700, adjacent: true, mechanism: 'I-90/I-29', factors: '~7,500 daily SD-to-MN commuters (Census ACS); Sioux Falls-Worthington-Mankato corridor.' },
    { target: 'Iowa', riskWeight: 0.71, commuters: 6500, airPassengers: 150, travelVolume: 6650, adjacent: true, mechanism: 'I-29 + Sioux City', factors: '~6,500 daily SD-to-IA commuters (Census ACS); Sioux City MSA spans Nebraska-Iowa-South Dakota.' },
    { target: 'Nebraska', riskWeight: 0.70, commuters: 5500, airPassengers: 100, travelVolume: 5600, adjacent: true, mechanism: 'I-29/US-81', factors: '~5,500 daily SD-to-NE commuters (Census ACS); Yankton-Norfolk and Sioux City metro flows.' },
    { target: 'North Dakota', riskWeight: 0.63, commuters: 2500, airPassengers: 100, travelVolume: 2600, adjacent: true, mechanism: 'I-29 Red River', factors: '~2,500 daily SD-to-ND commuters (Census ACS); agricultural and energy-sector worker migration.' },
    { target: 'Wyoming', riskWeight: 0.59, commuters: 1800, airPassengers: 75, travelVolume: 1875, adjacent: true, mechanism: 'I-90 Black Hills', factors: '~1,800 daily SD-to-WY commuters (Census ACS); Rapid City-Gillette energy and Black Hills tourism corridor.' },
  ],
  'Tennessee': [
    { target: 'Georgia', riskWeight: 0.82, commuters: 25000, airPassengers: 700, travelVolume: 25700, adjacent: true, mechanism: 'I-75/I-24 + BNA-ATL', factors: '~25,000 daily TN-to-GA commuters (Census ACS); Chattanooga-Atlanta corridor and Nashville-ATL business route.' },
    { target: 'Kentucky', riskWeight: 0.82, commuters: 25000, airPassengers: 300, travelVolume: 25300, adjacent: true, mechanism: 'I-65/I-75', factors: '~25,000 daily TN-to-KY commuters (Census ACS); Clarksville-Hopkinsville-Bowling Green-Nashville corridor.' },
    { target: 'Mississippi', riskWeight: 0.80, commuters: 20000, airPassengers: 150, travelVolume: 20150, adjacent: true, mechanism: 'I-55/US-78 + Memphis', factors: '~20,000 daily TN-to-MS reverse commuters (Census ACS); Memphis MSA includes DeSoto County, MS.' },
    { target: 'Alabama', riskWeight: 0.80, commuters: 19000, airPassengers: 300, travelVolume: 19300, adjacent: true, mechanism: 'I-65 Nashville-BHM', factors: '~19,000 daily TN-to-AL commuters (Census ACS); Huntsville-Nashville and Chattanooga-north AL corridors.' },
    { target: 'Arkansas', riskWeight: 0.76, commuters: 12000, airPassengers: 150, travelVolume: 12150, adjacent: true, mechanism: 'I-40/I-55 + Memphis', factors: '~12,000 daily TN-to-AR commuters (Census ACS); West Memphis is part of Memphis MSA.' },
  ],
  'Texas': [
    { target: 'Louisiana', riskWeight: 0.83, commuters: 26000, airPassengers: 1400, travelVolume: 27400, adjacent: true, mechanism: 'I-10 + IAH-MSY', factors: '~26,000 daily TX-to-LA commuters (Census ACS); Houston-Beaumont-Lake Charles petrochemical corridor.' },
    { target: 'Oklahoma', riskWeight: 0.82, commuters: 25000, airPassengers: 1500, travelVolume: 26500, adjacent: true, mechanism: 'I-35 + DFW-OKC air', factors: '~25,000 daily TX-to-OK commuters (Census ACS); DFW-OKC ~650k annual passengers (BTS).' },
    { target: 'New Mexico', riskWeight: 0.78, commuters: 15000, airPassengers: 500, travelVolume: 15500, adjacent: true, mechanism: 'I-10/I-20 + El Paso', factors: '~15,000 daily TX-to-NM commuters (Census ACS); El Paso-Las Cruces is a unified border metro.' },
    { target: 'California', riskWeight: 0.71, commuters: 5500, airPassengers: 9500, travelVolume: 15000, adjacent: false, mechanism: 'Air (DFW-LAX/SFO)', factors: 'DFW-LAX ~2.3M annual passengers (BTS 2023), top-5 domestic route; two largest state economies by GDP.' },
    { target: 'Florida', riskWeight: 0.68, commuters: 3500, airPassengers: 5200, travelVolume: 8700, adjacent: false, mechanism: 'Air (IAH/DFW-MIA)', factors: 'IAH-MIA + DFW-MIA combined ~1.9M annual passengers (BTS); sun-belt business and Latin American connection traffic.' },
  ],
  'Utah': [
    { target: 'Idaho', riskWeight: 0.76, commuters: 13000, airPassengers: 250, travelVolume: 13250, adjacent: true, mechanism: 'I-15/I-84', factors: '~13,000 daily UT-to-ID commuters (Census ACS); Logan-Preston and SLC-Pocatello corridors.' },
    { target: 'Nevada', riskWeight: 0.73, commuters: 9500, airPassengers: 600, travelVolume: 10100, adjacent: true, mechanism: 'I-15 + SLC-LAS', factors: '~9,500 daily UT-to-NV commuters (Census ACS); St. George-Mesquite-Las Vegas corridor.' },
    { target: 'Arizona', riskWeight: 0.73, commuters: 9000, airPassengers: 700, travelVolume: 9700, adjacent: true, mechanism: 'I-15 + SLC-PHX', factors: '~9,000 daily UT-to-AZ commuters (Census ACS); St. George-Flagstaff-Phoenix corridor.' },
    { target: 'Wyoming', riskWeight: 0.70, commuters: 6500, airPassengers: 100, travelVolume: 6600, adjacent: true, mechanism: 'I-80 Evanston corr.', factors: '~6,500 daily UT-to-WY commuters (Census ACS); Evanston-Salt Lake commuters and energy-sector workers.' },
    { target: 'Colorado', riskWeight: 0.67, commuters: 4500, airPassengers: 900, travelVolume: 5400, adjacent: true, mechanism: 'I-70 + SLC-DEN air', factors: '~4,500 daily UT-to-CO commuters (Census ACS); SLC-DEN ~580k annual passengers (BTS), Mountain West hub-to-hub.' },
  ],
  'Vermont': [
    { target: 'New Hampshire', riskWeight: 0.73, commuters: 8500, airPassengers: 50, travelVolume: 8550, adjacent: true, mechanism: 'I-89/I-91 Upper Valley', factors: '~8,500 daily VT-to-NH commuters (Census ACS); Upper Valley (Hanover-Lebanon) shared medical and academic region.' },
    { target: 'Massachusetts', riskWeight: 0.69, commuters: 5000, airPassengers: 50, travelVolume: 5050, adjacent: true, mechanism: 'I-91 CT River Valley', factors: '~5,000 daily VT-to-MA commuters (Census ACS); Brattleboro-Greenfield-Springfield corridor.' },
    { target: 'New York', riskWeight: 0.68, commuters: 4500, airPassengers: 100, travelVolume: 4600, adjacent: true, mechanism: 'US-7/US-4 + Champlain', factors: '~4,500 daily VT-to-NY commuters (Census ACS); Burlington-Plattsburgh Lake Champlain ferry corridor.' },
    { target: 'Maine', riskWeight: 0.49, commuters: 800, airPassengers: 25, travelVolume: 825, adjacent: false, mechanism: 'US-2 via NH', factors: '~800 daily VT-to-ME commuters (Census ACS); cross-northern New England flow via New Hampshire.' },
  ],
  'Virginia': [
    { target: 'Maryland', riskWeight: 0.95, commuters: 145000, airPassengers: 800, travelVolume: 145800, adjacent: true, mechanism: 'I-495/I-95/I-66 DMV', factors: '~145,000 daily VA-to-MD commuters (Census ACS); the federal workforce "DMV" corridor is one of the densest in the US.' },
    { target: 'North Carolina', riskWeight: 0.80, commuters: 20000, airPassengers: 900, travelVolume: 20900, adjacent: true, mechanism: 'I-85/I-95', factors: '~20,000 daily VA-to-NC commuters (Census ACS); Richmond-Raleigh-Charlotte I-85/95 corridor plus military-base traffic.' },
    { target: 'West Virginia', riskWeight: 0.73, commuters: 8500, airPassengers: 50, travelVolume: 8550, adjacent: true, mechanism: 'I-81/I-64', factors: '~8,500 daily VA-to-WV commuters (Census ACS); DC exurbs expanding into Eastern Panhandle (Jefferson/Berkeley).' },
    { target: 'Tennessee', riskWeight: 0.68, commuters: 5000, airPassengers: 200, travelVolume: 5200, adjacent: true, mechanism: 'I-81 Appalachia', factors: '~5,000 daily VA-to-TN commuters (Census ACS); Bristol is a shared city straddling the border.' },
    { target: 'Pennsylvania', riskWeight: 0.63, commuters: 3000, airPassengers: 500, travelVolume: 3500, adjacent: false, mechanism: 'I-81 + IAD-PHL', factors: '~3,000 daily VA-to-PA commuters (Census ACS); I-81 Shenandoah Valley corridor plus DC-Philly business traffic.' },
  ],
  'Washington': [
    { target: 'Oregon', riskWeight: 0.91, commuters: 73000, airPassengers: 700, travelVolume: 73700, adjacent: true, mechanism: 'I-5 Portland-Vancouver', factors: '~73,000 daily WA-to-OR commuters (Census ACS); Vancouver WA is essentially a Portland suburb, one of the densest Western corridors.' },
    { target: 'Idaho', riskWeight: 0.78, commuters: 15500, airPassengers: 300, travelVolume: 15800, adjacent: true, mechanism: 'I-90 Spokane-CDA', factors: '~15,500 daily WA-to-ID commuters (Census ACS); Spokane-Coeur d\'Alene is a cross-border MSA.' },
    { target: 'California', riskWeight: 0.72, commuters: 5500, airPassengers: 3800, travelVolume: 9300, adjacent: false, mechanism: 'Air (SEA-LAX/SFO)', factors: 'SEA-LAX ~1.4M + SEA-SFO ~1.2M annual passengers (BTS); top West Coast business corridor.' },
    { target: 'Alaska', riskWeight: 0.57, commuters: 700, airPassengers: 4200, travelVolume: 4900, adjacent: false, mechanism: 'Air (SEA-ANC)', factors: 'SEA-ANC ~1.5M annual passengers (BTS); primary Alaska mainland gateway.' },
    { target: 'Nevada', riskWeight: 0.56, commuters: 1200, airPassengers: 1400, travelVolume: 2600, adjacent: false, mechanism: 'Air (SEA-LAS)', factors: '~510k annual SEA-LAS passengers (BTS); tourism and convention corridor.' },
  ],
  'West Virginia': [
    { target: 'Ohio', riskWeight: 0.77, commuters: 13500, airPassengers: 50, travelVolume: 13550, adjacent: true, mechanism: 'I-70/I-77 Ohio River', factors: '~13,500 daily WV-to-OH commuters (Census ACS); Wheeling-St. Clairsville and Parkersburg-Marietta shared metros.' },
    { target: 'Virginia', riskWeight: 0.74, commuters: 9500, airPassengers: 100, travelVolume: 9600, adjacent: true, mechanism: 'I-81/I-64 + Eastern P.', factors: '~9,500 daily WV-to-VA commuters (Census ACS); Eastern Panhandle is now part of DC exurb belt.' },
    { target: 'Pennsylvania', riskWeight: 0.73, commuters: 8500, airPassengers: 150, travelVolume: 8650, adjacent: true, mechanism: 'I-79/I-68', factors: '~8,500 daily WV-to-PA commuters (Census ACS); Morgantown-Pittsburgh corridor, WVU and steel industry.' },
    { target: 'Kentucky', riskWeight: 0.70, commuters: 6000, airPassengers: 50, travelVolume: 6050, adjacent: true, mechanism: 'I-64/US-23 Tri-State', factors: '~6,000 daily WV-to-KY commuters (Census ACS); Huntington-Ashland Tri-State metro.' },
    { target: 'Maryland', riskWeight: 0.66, commuters: 4000, airPassengers: 50, travelVolume: 4050, adjacent: true, mechanism: 'I-68 + Cumberland', factors: '~4,000 daily WV-to-MD commuters (Census ACS); Eastern Panhandle-Cumberland corridor.' },
  ],
  'Wisconsin': [
    { target: 'Illinois', riskWeight: 0.85, commuters: 35000, airPassengers: 400, travelVolume: 35400, adjacent: true, mechanism: 'I-94/I-90 + Chicago', factors: '~35,000 daily WI-to-IL commuters (Census ACS); Milwaukee-Kenosha-Chicago lakeshore corridor.' },
    { target: 'Minnesota', riskWeight: 0.84, commuters: 30000, airPassengers: 300, travelVolume: 30300, adjacent: true, mechanism: 'I-94 Twin Cities', factors: '~30,000 daily WI-to-MN commuters (Census ACS); Hudson-Eau Claire-Twin Cities commuter belt.' },
    { target: 'Iowa', riskWeight: 0.72, commuters: 7500, airPassengers: 150, travelVolume: 7650, adjacent: true, mechanism: 'US-151/US-18', factors: '~7,500 daily WI-to-IA commuters (Census ACS); Dubuque-Platteville-Madison corridor.' },
    { target: 'Michigan', riskWeight: 0.66, commuters: 3500, airPassengers: 200, travelVolume: 3700, adjacent: true, mechanism: 'US-41 + UP ferry', factors: '~3,500 daily WI-to-MI commuters (Census ACS); Marinette-Menominee shared metro and UP connections.' },
  ],
  'Wyoming': [
    { target: 'Colorado', riskWeight: 0.75, commuters: 11000, airPassengers: 300, travelVolume: 11300, adjacent: true, mechanism: 'I-25 Front Range', factors: '~11,000 daily WY-to-CO commuters (Census ACS); Cheyenne-Fort Collins-Denver is a de facto exurb corridor.' },
    { target: 'Utah', riskWeight: 0.69, commuters: 5500, airPassengers: 150, travelVolume: 5650, adjacent: true, mechanism: 'I-80 Evanston', factors: '~5,500 daily WY-to-UT commuters (Census ACS); Evanston-Salt Lake energy-sector commute.' },
    { target: 'Montana', riskWeight: 0.66, commuters: 4000, airPassengers: 100, travelVolume: 4100, adjacent: true, mechanism: 'I-90', factors: '~4,000 daily WY-to-MT commuters (Census ACS); Sheridan-Billings and Yellowstone gateway corridor.' },
    { target: 'Idaho', riskWeight: 0.62, commuters: 2500, airPassengers: 100, travelVolume: 2600, adjacent: true, mechanism: 'US-26/US-89', factors: '~2,500 daily WY-to-ID commuters (Census ACS); Jackson-Teton-Idaho Falls corridor.' },
    { target: 'South Dakota', riskWeight: 0.60, commuters: 2000, airPassengers: 75, travelVolume: 2075, adjacent: true, mechanism: 'I-90 Black Hills', factors: '~2,000 daily WY-to-SD commuters (Census ACS); Gillette-Rapid City energy and Black Hills corridor.' },
  ],
}

// Shared color helper — single source of truth for corridor risk coloring.
// Used by the 3D arcs, the traveling pulse dots, and the ta-corridor-bar
// in StatePanel's Transmission Analysis so they always visually agree.
export function getCorridorRiskColor(riskWeight) {
  if (riskWeight > 0.75) return '#ff6b4a'  // high — red/orange
  if (riskWeight > 0.55) return '#f0a030'  // medium — amber
  return '#00e0a0'                          // low — teal/green
}

export default TRANSMISSION_CORRIDORS
