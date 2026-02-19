// ============================================
// TRANSMISSION CORRIDOR DATA
// ============================================
// Each state has 3-5 highest-risk transmission connections
// based on: border adjacency, interstate travel volume,
// airport hub connectivity, and population density factors.
//
// riskWeight: 0-1 composite score driving arc visual intensity
// factors: human-readable rationale (placeholder for AI model output)
// travelVolume: estimated daily interstate travelers (thousands)
// mechanism: primary transmission pathway
//

const TRANSMISSION_CORRIDORS = {
  'Alabama': [
    { target: 'Georgia', riskWeight: 0.82, travelVolume: 38, mechanism: 'I-85 corridor + ATL hub', factors: 'High-volume I-85 commuter traffic into Atlanta metro, major airport hub connectivity' },
    { target: 'Tennessee', riskWeight: 0.68, travelVolume: 24, mechanism: 'I-65 corridor', factors: 'Dense I-65 corridor connecting Birmingham to Nashville, shared Appalachian communities' },
    { target: 'Mississippi', riskWeight: 0.61, travelVolume: 18, mechanism: 'Border adjacency', factors: 'Extended shared border, similar rural population density patterns' },
    { target: 'Florida', riskWeight: 0.55, travelVolume: 22, mechanism: 'I-65 + seasonal', factors: 'Snowbird migration corridor, Gulf Coast tourism traffic' },
  ],
  'Alaska': [
    { target: 'Washington', riskWeight: 0.72, travelVolume: 15, mechanism: 'Air travel (SEA hub)', factors: 'Primary air gateway via Seattle-Tacoma, cruise ship corridor' },
    { target: 'California', riskWeight: 0.48, travelVolume: 8, mechanism: 'Air travel (LAX/SFO)', factors: 'Secondary air connections through major California hubs' },
  ],
  'Arizona': [
    { target: 'California', riskWeight: 0.85, travelVolume: 52, mechanism: 'I-10/I-8 corridor', factors: 'Massive I-10 traffic volume, LA-Phoenix commuter belt, shared desert communities' },
    { target: 'Nevada', riskWeight: 0.72, travelVolume: 35, mechanism: 'I-15 + US-93', factors: 'Las Vegas-Phoenix corridor, high recreational travel volume' },
    { target: 'New Mexico', riskWeight: 0.58, travelVolume: 14, mechanism: 'I-10/I-40 corridor', factors: 'Cross-border communities, shared Native American reservation populations' },
    { target: 'Colorado', riskWeight: 0.42, travelVolume: 10, mechanism: 'Air travel', factors: 'Denver hub connectivity, seasonal migration patterns' },
  ],
  'Arkansas': [
    { target: 'Tennessee', riskWeight: 0.70, travelVolume: 22, mechanism: 'I-40 corridor', factors: 'Memphis metro shared economy, I-40 cross-state traffic' },
    { target: 'Missouri', riskWeight: 0.65, travelVolume: 18, mechanism: 'I-55 corridor', factors: 'Springfield-Branson corridor, shared Ozark communities' },
    { target: 'Texas', riskWeight: 0.60, travelVolume: 20, mechanism: 'I-30 corridor', factors: 'Texarkana shared metro, Dallas-Little Rock commuter traffic' },
    { target: 'Mississippi', riskWeight: 0.52, travelVolume: 12, mechanism: 'Border adjacency', factors: 'Mississippi Delta shared communities, agricultural worker migration' },
  ],
  'California': [
    { target: 'Nevada', riskWeight: 0.88, travelVolume: 68, mechanism: 'I-15 corridor', factors: 'LA-Las Vegas corridor is one of the busiest interstate routes nationally, 68K+ daily' },
    { target: 'Arizona', riskWeight: 0.82, travelVolume: 52, mechanism: 'I-10/I-8 corridor', factors: 'LA-Phoenix mega-corridor, Yuma agricultural worker migration' },
    { target: 'Oregon', riskWeight: 0.70, travelVolume: 32, mechanism: 'I-5 corridor', factors: 'Pacific coast corridor, Sacramento-Portland commercial traffic' },
    { target: 'Texas', riskWeight: 0.65, travelVolume: 45, mechanism: 'Air travel (LAX-DFW)', factors: 'Two largest state economies, massive air travel volume between major hubs' },
    { target: 'New York', riskWeight: 0.58, travelVolume: 40, mechanism: 'Air travel (LAX-JFK)', factors: 'Highest-volume transcontinental air corridor in the US' },
  ],
  'Colorado': [
    { target: 'Texas', riskWeight: 0.72, travelVolume: 30, mechanism: 'Air travel (DEN-DFW)', factors: 'Denver hub to Dallas-Fort Worth, significant business travel corridor' },
    { target: 'Kansas', riskWeight: 0.62, travelVolume: 16, mechanism: 'I-70 corridor', factors: 'I-70 east corridor, agricultural and commercial traffic' },
    { target: 'Utah', riskWeight: 0.58, travelVolume: 18, mechanism: 'I-70/I-15', factors: 'Mountain west corridor, ski season migration, shared outdoor recreation' },
    { target: 'Nebraska', riskWeight: 0.50, travelVolume: 12, mechanism: 'I-76/I-80', factors: 'Northern corridor, agricultural supply chain' },
    { target: 'New Mexico', riskWeight: 0.48, travelVolume: 14, mechanism: 'I-25 corridor', factors: 'Front Range to Santa Fe/Albuquerque corridor' },
  ],
  'Connecticut': [
    { target: 'New York', riskWeight: 0.92, travelVolume: 85, mechanism: 'I-95 + Metro-North', factors: 'One of the densest commuter corridors in the US, 85K+ daily NYC commuters' },
    { target: 'Massachusetts', riskWeight: 0.78, travelVolume: 35, mechanism: 'I-95/I-84', factors: 'Northeast corridor, Hartford-Springfield shared metro' },
    { target: 'Rhode Island', riskWeight: 0.55, travelVolume: 12, mechanism: 'I-95', factors: 'Northeast corridor continuation, shared New England community' },
  ],
  'Delaware': [
    { target: 'Pennsylvania', riskWeight: 0.88, travelVolume: 62, mechanism: 'I-95 + commuter', factors: 'Philadelphia commuter belt, Wilmington-Philadelphia shared metro economy' },
    { target: 'Maryland', riskWeight: 0.75, travelVolume: 30, mechanism: 'I-95/US-13', factors: 'Delmarva Peninsula shared corridor, Baltimore proximity' },
    { target: 'New Jersey', riskWeight: 0.65, travelVolume: 25, mechanism: 'I-295 + ferry', factors: 'Delaware Memorial Bridge corridor, shared refinery communities' },
  ],
  'Florida': [
    { target: 'Georgia', riskWeight: 0.85, travelVolume: 55, mechanism: 'I-75/I-95 corridor', factors: 'Jacksonville-Atlanta mega-corridor, highest-volume southeast interstate' },
    { target: 'New York', riskWeight: 0.78, travelVolume: 48, mechanism: 'Air travel (MIA-JFK)', factors: 'Massive snowbird and tourism air corridor, year-round high volume' },
    { target: 'Alabama', riskWeight: 0.55, travelVolume: 18, mechanism: 'I-10 corridor', factors: 'Gulf Coast panhandle corridor, Pensacola-Mobile shared metro' },
    { target: 'Texas', riskWeight: 0.52, travelVolume: 30, mechanism: 'Air travel (MIA-DFW)', factors: 'Southern mega-state connectivity, business and tourism travel' },
  ],
  'Georgia': [
    { target: 'Florida', riskWeight: 0.85, travelVolume: 55, mechanism: 'I-75/I-95 corridor', factors: 'Atlanta hub feeds entire southeast, Jacksonville gateway' },
    { target: 'Alabama', riskWeight: 0.78, travelVolume: 38, mechanism: 'I-85/I-20 corridor', factors: 'Atlanta western sprawl, Birmingham commercial traffic' },
    { target: 'South Carolina', riskWeight: 0.70, travelVolume: 28, mechanism: 'I-85/I-20', factors: 'Augusta-Greenville corridor, shared Savannah River communities' },
    { target: 'Tennessee', riskWeight: 0.65, travelVolume: 32, mechanism: 'I-75 corridor', factors: 'Atlanta-Chattanooga-Knoxville corridor, Appalachian transit' },
    { target: 'North Carolina', riskWeight: 0.60, travelVolume: 25, mechanism: 'I-85 corridor', factors: 'Charlotte-Atlanta business corridor, I-85 industrial belt' },
  ],
  'Hawaii': [
    { target: 'California', riskWeight: 0.85, travelVolume: 35, mechanism: 'Air travel (HNL-LAX)', factors: 'Primary mainland gateway, highest Pacific air traffic volume' },
    { target: 'Washington', riskWeight: 0.45, travelVolume: 8, mechanism: 'Air travel (HNL-SEA)', factors: 'Secondary Pacific Northwest air connection' },
  ],
  'Idaho': [
    { target: 'Washington', riskWeight: 0.72, travelVolume: 20, mechanism: 'US-95/I-90', factors: 'Spokane-Moscow corridor, shared Palouse region' },
    { target: 'Utah', riskWeight: 0.65, travelVolume: 18, mechanism: 'I-15/I-84', factors: 'Boise-Salt Lake City corridor, Mormon cultural ties' },
    { target: 'Oregon', riskWeight: 0.55, travelVolume: 14, mechanism: 'I-84 corridor', factors: 'Snake River corridor, Boise-Portland commercial traffic' },
    { target: 'Montana', riskWeight: 0.48, travelVolume: 8, mechanism: 'US-93/I-90', factors: 'Northern Rockies corridor, shared wilderness communities' },
  ],
  'Illinois': [
    { target: 'Indiana', riskWeight: 0.85, travelVolume: 58, mechanism: 'I-65/I-94 corridor', factors: 'Chicago-Gary-Indianapolis mega-corridor, shared metro economy' },
    { target: 'Wisconsin', riskWeight: 0.78, travelVolume: 42, mechanism: 'I-94/I-90', factors: 'Chicago-Milwaukee corridor, dense commuter traffic' },
    { target: 'Missouri', riskWeight: 0.68, travelVolume: 28, mechanism: 'I-55/I-70', factors: 'St. Louis shared metro, I-55 corridor to Springfield' },
    { target: 'Iowa', riskWeight: 0.52, travelVolume: 15, mechanism: 'I-80/I-88', factors: 'Quad Cities shared metro, agricultural corridor' },
  ],
  'Indiana': [
    { target: 'Illinois', riskWeight: 0.85, travelVolume: 58, mechanism: 'I-65/I-94 corridor', factors: 'Chicago commuter belt extends deep into northwest Indiana' },
    { target: 'Ohio', riskWeight: 0.72, travelVolume: 35, mechanism: 'I-70/I-74', factors: 'Indianapolis-Columbus/Cincinnati corridor' },
    { target: 'Kentucky', riskWeight: 0.62, travelVolume: 22, mechanism: 'I-65 corridor', factors: 'Louisville shared metro, Southern Indiana commuters' },
    { target: 'Michigan', riskWeight: 0.55, travelVolume: 18, mechanism: 'I-69/I-94', factors: 'South Bend-Detroit corridor, shared Great Lakes economy' },
  ],
  'Iowa': [
    { target: 'Illinois', riskWeight: 0.68, travelVolume: 22, mechanism: 'I-80/I-88', factors: 'Quad Cities shared metro, Chicago-bound traffic' },
    { target: 'Nebraska', riskWeight: 0.60, travelVolume: 16, mechanism: 'I-80 corridor', factors: 'Council Bluffs-Omaha shared metro, I-80 transcontinental' },
    { target: 'Minnesota', riskWeight: 0.58, travelVolume: 18, mechanism: 'I-35 corridor', factors: 'Des Moines-Minneapolis corridor, agribusiness ties' },
    { target: 'Missouri', riskWeight: 0.52, travelVolume: 14, mechanism: 'I-35', factors: 'Kansas City proximity, agricultural corridor' },
  ],
  'Kansas': [
    { target: 'Missouri', riskWeight: 0.82, travelVolume: 55, mechanism: 'I-70/I-35 + KC metro', factors: 'Kansas City straddles the border — single unified metro area' },
    { target: 'Colorado', riskWeight: 0.58, travelVolume: 16, mechanism: 'I-70 corridor', factors: 'I-70 western corridor, agricultural and energy sector traffic' },
    { target: 'Nebraska', riskWeight: 0.50, travelVolume: 10, mechanism: 'US-77/US-81', factors: 'Northern agricultural corridor, shared Great Plains communities' },
    { target: 'Oklahoma', riskWeight: 0.48, travelVolume: 12, mechanism: 'I-35 corridor', factors: 'Wichita-Oklahoma City corridor, energy sector workers' },
  ],
  'Kentucky': [
    { target: 'Ohio', riskWeight: 0.82, travelVolume: 48, mechanism: 'I-75/I-71', factors: 'Cincinnati shared metro, Northern Kentucky commuter belt' },
    { target: 'Indiana', riskWeight: 0.75, travelVolume: 32, mechanism: 'I-65 corridor', factors: 'Louisville metro straddles border, dense commuter traffic' },
    { target: 'Tennessee', riskWeight: 0.68, travelVolume: 25, mechanism: 'I-75/I-65', factors: 'Knoxville-Lexington corridor, shared Appalachian communities' },
    { target: 'West Virginia', riskWeight: 0.52, travelVolume: 12, mechanism: 'I-64/US-23', factors: 'Shared Appalachian coal communities, Huntington-Ashland metro' },
  ],
  'Louisiana': [
    { target: 'Texas', riskWeight: 0.82, travelVolume: 45, mechanism: 'I-10 corridor', factors: 'Beaumont-Lake Charles petrochemical corridor, Houston proximity' },
    { target: 'Mississippi', riskWeight: 0.68, travelVolume: 22, mechanism: 'I-20/I-59', factors: 'Gulf Coast shared communities, New Orleans-Jackson corridor' },
    { target: 'Arkansas', riskWeight: 0.52, travelVolume: 14, mechanism: 'I-20 corridor', factors: 'Monroe-El Dorado corridor, timber industry workers' },
  ],
  'Maine': [
    { target: 'New Hampshire', riskWeight: 0.72, travelVolume: 18, mechanism: 'I-95/US-1', factors: 'Portsmouth-Kittery border community, coastal corridor' },
    { target: 'Massachusetts', riskWeight: 0.60, travelVolume: 15, mechanism: 'I-95 corridor', factors: 'Boston metro pull, seasonal tourism traffic' },
  ],
  'Maryland': [
    { target: 'Virginia', riskWeight: 0.90, travelVolume: 75, mechanism: 'I-95/I-495/I-66', factors: 'DC metro shared workforce, one of the densest commuter corridors nationally' },
    { target: 'Pennsylvania', riskWeight: 0.72, travelVolume: 35, mechanism: 'I-83/I-95', factors: 'Baltimore-York-Harrisburg corridor, I-95 northeast traffic' },
    { target: 'Delaware', riskWeight: 0.62, travelVolume: 22, mechanism: 'I-95/US-13', factors: 'Eastern Shore shared corridor, Chesapeake Bay communities' },
  ],
  'Massachusetts': [
    { target: 'Connecticut', riskWeight: 0.78, travelVolume: 35, mechanism: 'I-95/I-90', factors: 'Springfield shared metro, Hartford-Boston corridor' },
    { target: 'New York', riskWeight: 0.75, travelVolume: 38, mechanism: 'I-90/I-95', factors: 'Boston-NYC air and rail corridor, major business travel' },
    { target: 'New Hampshire', riskWeight: 0.68, travelVolume: 28, mechanism: 'I-93/I-95', factors: 'Southern NH is Boston commuter belt, Nashua-Lowell corridor' },
    { target: 'Rhode Island', riskWeight: 0.62, travelVolume: 22, mechanism: 'I-95/I-195', factors: 'Providence-Boston corridor, shared metro economy' },
  ],
  'Michigan': [
    { target: 'Ohio', riskWeight: 0.78, travelVolume: 38, mechanism: 'I-75/I-80', factors: 'Detroit-Toledo corridor, automotive supply chain' },
    { target: 'Indiana', riskWeight: 0.65, travelVolume: 22, mechanism: 'I-94/I-69', factors: 'Detroit-Chicago corridor through South Bend' },
    { target: 'Illinois', riskWeight: 0.60, travelVolume: 25, mechanism: 'I-94 lakeshore', factors: 'Lake Michigan corridor, Chicago metro pull' },
    { target: 'Wisconsin', riskWeight: 0.48, travelVolume: 12, mechanism: 'US-41/ferry', factors: 'Upper Peninsula connection, Green Bay corridor' },
  ],
  'Minnesota': [
    { target: 'Wisconsin', riskWeight: 0.82, travelVolume: 45, mechanism: 'I-94/I-35', factors: 'Twin Cities-western WI commuter belt, Minneapolis-Eau Claire corridor' },
    { target: 'Iowa', riskWeight: 0.60, travelVolume: 18, mechanism: 'I-35 corridor', factors: 'Minneapolis-Des Moines corridor, agricultural sector' },
    { target: 'North Dakota', riskWeight: 0.50, travelVolume: 10, mechanism: 'I-94 corridor', factors: 'Fargo-Moorhead shared metro, Red River Valley' },
    { target: 'South Dakota', riskWeight: 0.45, travelVolume: 8, mechanism: 'I-90/US-75', factors: 'Sioux Falls corridor, shared prairie communities' },
  ],
  'Mississippi': [
    { target: 'Alabama', riskWeight: 0.65, travelVolume: 18, mechanism: 'I-20/I-59', factors: 'Meridian-Birmingham corridor, shared rural communities' },
    { target: 'Tennessee', riskWeight: 0.62, travelVolume: 20, mechanism: 'US-78/US-45', factors: 'Memphis metro influence, northern Mississippi commuters' },
    { target: 'Louisiana', riskWeight: 0.58, travelVolume: 16, mechanism: 'I-20/I-55', factors: 'Gulf Coast shared communities, Vicksburg-Monroe corridor' },
  ],
  'Missouri': [
    { target: 'Kansas', riskWeight: 0.82, travelVolume: 55, mechanism: 'KC shared metro', factors: 'Kansas City metro spans both states equally' },
    { target: 'Illinois', riskWeight: 0.78, travelVolume: 45, mechanism: 'I-70/I-55', factors: 'St. Louis metro spans both states, East St. Louis commuters' },
    { target: 'Arkansas', riskWeight: 0.55, travelVolume: 14, mechanism: 'I-44/US-65', factors: 'Branson-Springfield tourism corridor' },
    { target: 'Tennessee', riskWeight: 0.50, travelVolume: 12, mechanism: 'I-55', factors: 'Memphis proximity from southern Missouri' },
  ],
  'Montana': [
    { target: 'Idaho', riskWeight: 0.55, travelVolume: 8, mechanism: 'I-90/US-93', factors: 'Missoula-Moscow corridor, shared Bitterroot communities' },
    { target: 'North Dakota', riskWeight: 0.50, travelVolume: 7, mechanism: 'US-2/I-94', factors: 'Oil patch worker migration, Bakken formation shared economy' },
    { target: 'Wyoming', riskWeight: 0.45, travelVolume: 6, mechanism: 'I-90', factors: 'Billings-Sheridan corridor, shared energy sector' },
  ],
  'Nebraska': [
    { target: 'Iowa', riskWeight: 0.75, travelVolume: 35, mechanism: 'I-80 + Omaha metro', factors: 'Omaha-Council Bluffs shared metro, I-80 bridge' },
    { target: 'Kansas', riskWeight: 0.55, travelVolume: 12, mechanism: 'US-77/US-81', factors: 'Lincoln-Manhattan corridor, agricultural trade' },
    { target: 'Colorado', riskWeight: 0.50, travelVolume: 14, mechanism: 'I-76/I-80', factors: 'I-80 western corridor, Denver metro pull' },
  ],
  'Nevada': [
    { target: 'California', riskWeight: 0.90, travelVolume: 72, mechanism: 'I-15 corridor', factors: 'LA-Vegas is one of the highest-volume corridors nationally' },
    { target: 'Arizona', riskWeight: 0.68, travelVolume: 28, mechanism: 'US-93', factors: 'Las Vegas-Phoenix corridor via Hoover Dam' },
    { target: 'Utah', riskWeight: 0.55, travelVolume: 16, mechanism: 'I-15 corridor', factors: 'Las Vegas-Salt Lake corridor, shared desert communities' },
  ],
  'New Hampshire': [
    { target: 'Massachusetts', riskWeight: 0.85, travelVolume: 42, mechanism: 'I-93/I-95', factors: 'Boston commuter belt, 42K+ daily cross-border commuters' },
    { target: 'Maine', riskWeight: 0.58, travelVolume: 12, mechanism: 'I-95', factors: 'Seacoast shared corridor, Portsmouth-Kittery community' },
    { target: 'Vermont', riskWeight: 0.52, travelVolume: 10, mechanism: 'I-89/I-91', factors: 'Upper Valley shared region, Dartmouth-Hitchcock medical hub' },
  ],
  'New Jersey': [
    { target: 'New York', riskWeight: 0.95, travelVolume: 120, mechanism: 'Tunnels/bridges + transit', factors: 'Highest cross-state commuter volume in the US, 120K+ daily via PATH/NJT/GWB' },
    { target: 'Pennsylvania', riskWeight: 0.82, travelVolume: 55, mechanism: 'I-95/NJ Turnpike', factors: 'Philadelphia metro overlap, Trenton corridor' },
    { target: 'Delaware', riskWeight: 0.55, travelVolume: 18, mechanism: 'NJ Turnpike/I-295', factors: 'Delaware Memorial Bridge corridor' },
  ],
  'New Mexico': [
    { target: 'Texas', riskWeight: 0.75, travelVolume: 25, mechanism: 'I-10/I-25', factors: 'El Paso shared metro, Las Cruces border community' },
    { target: 'Arizona', riskWeight: 0.62, travelVolume: 14, mechanism: 'I-40/I-10', factors: 'Cross-desert corridor, shared tribal communities' },
    { target: 'Colorado', riskWeight: 0.55, travelVolume: 14, mechanism: 'I-25 corridor', factors: 'Santa Fe-Trinidad corridor, Raton Pass traffic' },
  ],
  'New York': [
    { target: 'New Jersey', riskWeight: 0.95, travelVolume: 120, mechanism: 'Tunnels/bridges + transit', factors: 'NYC metro spans both states, densest corridor nationally' },
    { target: 'Connecticut', riskWeight: 0.85, travelVolume: 65, mechanism: 'I-95 + Metro-North', factors: 'Stamford-Greenwich NYC commuter belt' },
    { target: 'Pennsylvania', riskWeight: 0.68, travelVolume: 30, mechanism: 'I-81/I-80', factors: 'Scranton corridor, Catskills-Pocono shared region' },
    { target: 'Massachusetts', riskWeight: 0.62, travelVolume: 28, mechanism: 'I-90/air (BOS-JFK)', factors: 'Boston-NYC corridor, Amtrak + shuttle flights' },
    { target: 'Florida', riskWeight: 0.58, travelVolume: 42, mechanism: 'Air travel (JFK-MIA)', factors: 'Snowbird corridor, massive seasonal air volume' },
  ],
  'North Carolina': [
    { target: 'Virginia', riskWeight: 0.82, travelVolume: 42, mechanism: 'I-85/I-95 corridor', factors: 'Dense I-85 urban crescent connecting Charlotte-Greensboro-Raleigh to DC metro, 42K+ daily commuters' },
    { target: 'South Carolina', riskWeight: 0.75, travelVolume: 35, mechanism: 'I-85/I-77', factors: 'Charlotte metro extends into SC, Myrtle Beach tourism corridor' },
    { target: 'Georgia', riskWeight: 0.62, travelVolume: 25, mechanism: 'I-85 corridor', factors: 'Charlotte-Atlanta I-85 business corridor, Asheville-north GA connection' },
    { target: 'Tennessee', riskWeight: 0.55, travelVolume: 18, mechanism: 'I-40/I-26', factors: 'Asheville-Knoxville Appalachian corridor, shared mountain communities' },
    { target: 'Florida', riskWeight: 0.48, travelVolume: 22, mechanism: 'I-95 + air (CLT-MIA)', factors: 'I-95 coastal migration corridor, CLT airport hub connections' },
  ],
  'North Dakota': [
    { target: 'Minnesota', riskWeight: 0.72, travelVolume: 18, mechanism: 'I-94 corridor', factors: 'Fargo-Moorhead shared metro, Red River Valley' },
    { target: 'Montana', riskWeight: 0.48, travelVolume: 6, mechanism: 'I-94/US-2', factors: 'Oil patch shared economy, Bakken worker migration' },
    { target: 'South Dakota', riskWeight: 0.45, travelVolume: 5, mechanism: 'I-29', factors: 'I-29 corridor, shared agricultural communities' },
  ],
  'Ohio': [
    { target: 'Michigan', riskWeight: 0.78, travelVolume: 38, mechanism: 'I-75/I-80', factors: 'Toledo-Detroit corridor, automotive supply chain dependencies' },
    { target: 'Pennsylvania', riskWeight: 0.72, travelVolume: 32, mechanism: 'I-80/I-76', factors: 'Cleveland-Pittsburgh corridor, shared Rust Belt economy' },
    { target: 'Kentucky', riskWeight: 0.70, travelVolume: 35, mechanism: 'I-75/I-71', factors: 'Cincinnati metro spans both states, dense commuter flow' },
    { target: 'Indiana', riskWeight: 0.65, travelVolume: 28, mechanism: 'I-70/I-74', factors: 'Columbus-Indianapolis corridor, shared logistics economy' },
  ],
  'Oklahoma': [
    { target: 'Texas', riskWeight: 0.82, travelVolume: 42, mechanism: 'I-35 corridor', factors: 'OKC-Dallas corridor via I-35, major commercial and energy sector traffic' },
    { target: 'Kansas', riskWeight: 0.58, travelVolume: 14, mechanism: 'I-35 corridor', factors: 'Wichita-Oklahoma City corridor, shared wheat belt' },
    { target: 'Arkansas', riskWeight: 0.52, travelVolume: 12, mechanism: 'I-40 corridor', factors: 'Fort Smith shared community, I-40 cross-Ozark traffic' },
    { target: 'Missouri', riskWeight: 0.48, travelVolume: 10, mechanism: 'I-44 corridor', factors: 'Tulsa-Joplin-Springfield corridor, Route 66 belt' },
  ],
  'Oregon': [
    { target: 'Washington', riskWeight: 0.88, travelVolume: 48, mechanism: 'I-5 corridor', factors: 'Portland-Seattle mega-corridor, dense shared metro traffic' },
    { target: 'California', riskWeight: 0.68, travelVolume: 28, mechanism: 'I-5 corridor', factors: 'Pacific coast corridor, Sacramento-Medford traffic' },
    { target: 'Idaho', riskWeight: 0.52, travelVolume: 12, mechanism: 'I-84 corridor', factors: 'Boise-Portland commercial corridor via Blue Mountains' },
  ],
  'Pennsylvania': [
    { target: 'New Jersey', riskWeight: 0.85, travelVolume: 55, mechanism: 'I-95 + bridges', factors: 'Philadelphia metro shared economy, 6 bridge crossings' },
    { target: 'New York', riskWeight: 0.78, travelVolume: 35, mechanism: 'I-81/I-80', factors: 'Scranton-Binghamton corridor, Poconos-Catskills shared region' },
    { target: 'Ohio', riskWeight: 0.70, travelVolume: 30, mechanism: 'I-76/I-80', factors: 'Pittsburgh-Cleveland corridor, shared Rust Belt economy' },
    { target: 'Maryland', riskWeight: 0.62, travelVolume: 28, mechanism: 'I-83/I-95', factors: 'York-Baltimore corridor, Gettysburg-Frederick traffic' },
  ],
  'Rhode Island': [
    { target: 'Massachusetts', riskWeight: 0.82, travelVolume: 32, mechanism: 'I-95/I-195', factors: 'Providence is effectively part of greater Boston metro' },
    { target: 'Connecticut', riskWeight: 0.62, travelVolume: 15, mechanism: 'I-95', factors: 'Northeast corridor, shared New England coastal economy' },
  ],
  'South Carolina': [
    { target: 'North Carolina', riskWeight: 0.80, travelVolume: 38, mechanism: 'I-85/I-77', factors: 'Charlotte metro southern sprawl, Myrtle Beach tourism from NC' },
    { target: 'Georgia', riskWeight: 0.72, travelVolume: 28, mechanism: 'I-20/I-85', factors: 'Augusta-Greenville corridor, Savannah-Hilton Head tourism' },
    { target: 'Florida', riskWeight: 0.48, travelVolume: 15, mechanism: 'I-95 corridor', factors: 'I-95 coastal migration, seasonal tourism' },
  ],
  'South Dakota': [
    { target: 'Minnesota', riskWeight: 0.62, travelVolume: 12, mechanism: 'I-90/I-29', factors: 'Sioux Falls-Minneapolis corridor' },
    { target: 'North Dakota', riskWeight: 0.50, travelVolume: 6, mechanism: 'I-29', factors: 'Shared Dakota communities, I-29 corridor' },
    { target: 'Iowa', riskWeight: 0.48, travelVolume: 8, mechanism: 'I-29/I-90', factors: 'Sioux City shared metro area' },
    { target: 'Nebraska', riskWeight: 0.45, travelVolume: 7, mechanism: 'I-29/US-81', factors: 'Shared Missouri River communities' },
  ],
  'Tennessee': [
    { target: 'Georgia', riskWeight: 0.78, travelVolume: 35, mechanism: 'I-75/I-24', factors: 'Chattanooga-Atlanta corridor, dense I-75 traffic' },
    { target: 'Alabama', riskWeight: 0.68, travelVolume: 24, mechanism: 'I-65 corridor', factors: 'Nashville-Birmingham corridor, Huntsville growing metro' },
    { target: 'Kentucky', riskWeight: 0.65, travelVolume: 22, mechanism: 'I-75/I-65', factors: 'Nashville-Louisville and Knoxville-Lexington corridors' },
    { target: 'North Carolina', riskWeight: 0.58, travelVolume: 18, mechanism: 'I-40/I-26', factors: 'Knoxville-Asheville Appalachian corridor' },
    { target: 'Mississippi', riskWeight: 0.52, travelVolume: 16, mechanism: 'I-55/US-78', factors: 'Memphis metro influence extends into northern MS' },
  ],
  'Texas': [
    { target: 'Louisiana', riskWeight: 0.78, travelVolume: 42, mechanism: 'I-10 corridor', factors: 'Houston-Beaumont-Lake Charles petrochemical corridor' },
    { target: 'Oklahoma', riskWeight: 0.75, travelVolume: 38, mechanism: 'I-35 corridor', factors: 'Dallas-OKC corridor, dense commercial traffic' },
    { target: 'New Mexico', riskWeight: 0.60, travelVolume: 22, mechanism: 'I-10/I-25', factors: 'El Paso shared border metro, Las Cruces commuters' },
    { target: 'California', riskWeight: 0.58, travelVolume: 40, mechanism: 'Air travel (DFW-LAX)', factors: 'Two largest state economies, massive hub-to-hub air volume' },
    { target: 'Florida', riskWeight: 0.52, travelVolume: 32, mechanism: 'Air travel (DFW-MIA)', factors: 'Southern mega-state corridor, Gulf Coast communities' },
  ],
  'Utah': [
    { target: 'Nevada', riskWeight: 0.65, travelVolume: 18, mechanism: 'I-15 corridor', factors: 'Salt Lake-Las Vegas corridor, shared desert communities' },
    { target: 'Idaho', riskWeight: 0.60, travelVolume: 16, mechanism: 'I-15/I-84', factors: 'Pocatello-Salt Lake corridor, shared Mormon communities' },
    { target: 'Colorado', riskWeight: 0.58, travelVolume: 18, mechanism: 'I-70 corridor', factors: 'Mountain west corridor, ski season traffic, energy sector' },
    { target: 'Arizona', riskWeight: 0.48, travelVolume: 12, mechanism: 'I-15', factors: 'St. George-Flagstaff corridor, shared red rock region' },
  ],
  'Vermont': [
    { target: 'New Hampshire', riskWeight: 0.65, travelVolume: 14, mechanism: 'I-89/I-91', factors: 'Upper Valley shared medical region, Dartmouth community' },
    { target: 'Massachusetts', riskWeight: 0.55, travelVolume: 10, mechanism: 'I-91', factors: 'Connecticut River Valley, Springfield corridor' },
    { target: 'New York', riskWeight: 0.50, travelVolume: 8, mechanism: 'US-4/US-7', factors: 'Lake Champlain shared region, Burlington-Plattsburgh' },
  ],
  'Virginia': [
    { target: 'Maryland', riskWeight: 0.92, travelVolume: 82, mechanism: 'I-495/I-95/I-66', factors: 'DC metro shared workforce, Pentagon-Fort Meade-NSA corridor' },
    { target: 'North Carolina', riskWeight: 0.75, travelVolume: 38, mechanism: 'I-85/I-95', factors: 'Hampton Roads-Raleigh corridor, military base connections' },
    { target: 'West Virginia', riskWeight: 0.58, travelVolume: 18, mechanism: 'I-81/I-64', factors: 'Shenandoah Valley corridor, shared Appalachian communities' },
    { target: 'Tennessee', riskWeight: 0.45, travelVolume: 12, mechanism: 'I-81 corridor', factors: 'Bristol shared city, I-81 Appalachian corridor' },
  ],
  'Washington': [
    { target: 'Oregon', riskWeight: 0.88, travelVolume: 48, mechanism: 'I-5 corridor', factors: 'Seattle-Portland mega-corridor, densest Pacific NW route' },
    { target: 'California', riskWeight: 0.62, travelVolume: 25, mechanism: 'I-5 + air (SEA-LAX)', factors: 'West coast corridor, significant air and ground traffic' },
    { target: 'Idaho', riskWeight: 0.52, travelVolume: 14, mechanism: 'I-90/US-95', factors: 'Spokane-Moscow corridor, eastern WA shared communities' },
  ],
  'West Virginia': [
    { target: 'Virginia', riskWeight: 0.72, travelVolume: 22, mechanism: 'I-64/I-81', factors: 'Shared Shenandoah corridor, DC commuter exurbs expanding west' },
    { target: 'Kentucky', riskWeight: 0.62, travelVolume: 14, mechanism: 'I-64/US-23', factors: 'Huntington-Ashland shared metro, coal country communities' },
    { target: 'Pennsylvania', riskWeight: 0.58, travelVolume: 16, mechanism: 'I-79/I-68', factors: 'Morgantown-Pittsburgh corridor, WVU commuters' },
    { target: 'Ohio', riskWeight: 0.52, travelVolume: 12, mechanism: 'I-77', factors: 'Parkersburg-Marietta corridor, Ohio River communities' },
  ],
  'Wisconsin': [
    { target: 'Minnesota', riskWeight: 0.80, travelVolume: 42, mechanism: 'I-94 corridor', factors: 'Twin Cities pull on western WI, dense commuter traffic' },
    { target: 'Illinois', riskWeight: 0.78, travelVolume: 38, mechanism: 'I-94/I-90', factors: 'Milwaukee-Chicago corridor, lake shore commuters' },
    { target: 'Michigan', riskWeight: 0.48, travelVolume: 10, mechanism: 'US-41/ferry', factors: 'Upper Peninsula connection, Green Bay shared region' },
    { target: 'Iowa', riskWeight: 0.42, travelVolume: 8, mechanism: 'US-18/US-151', factors: 'Dubuque-Madison corridor, shared driftless region' },
  ],
  'Wyoming': [
    { target: 'Colorado', riskWeight: 0.62, travelVolume: 14, mechanism: 'I-25 corridor', factors: 'Cheyenne-Fort Collins corridor, Denver metro commuters' },
    { target: 'Montana', riskWeight: 0.48, travelVolume: 6, mechanism: 'I-90', factors: 'Sheridan-Billings corridor, shared energy sector' },
    { target: 'Utah', riskWeight: 0.42, travelVolume: 7, mechanism: 'I-80', factors: 'Evanston-Salt Lake corridor, shared mountain west' },
    { target: 'Idaho', riskWeight: 0.38, travelVolume: 5, mechanism: 'US-26/US-89', factors: 'Jackson-Idaho Falls corridor, Yellowstone gateway' },
  ],
}

export default TRANSMISSION_CORRIDORS