// Known counties that currently have outbreak_history rows in Jacob's seed.
// As of the current seeding pass, this is exactly one county per state —
// every state's XX001 FIPS (and DC's 11001).
//
// When Jacob seeds more counties, append their FIPS codes to this Set and
// the county map will automatically highlight them.
//
// Verified via:
//   SELECT l.fips FROM outbreak_history oh
//   JOIN locations l ON oh.location_id = l.id
//   WHERE oh.disease_type = 'influenza' AND l.fips NOT LIKE '__000'
//   GROUP BY l.fips;

export const COUNTIES_WITH_SURVEILLANCE = new Set([
  '01001', // Alabama — Autauga
  '02013', // Alaska — Aleutians East
  '04001', // Arizona — Apache
  '05001', // Arkansas — Arkansas
  '06001', // California — Alameda
  '08001', // Colorado — Adams
  '09110', // Connecticut — Capitol Planning Region
  '10001', // Delaware — Kent
  '11001', // District of Columbia
  '12001', // Florida — Alachua
  '13001', // Georgia — Appling
  '15001', // Hawaii — Hawaii
  '16001', // Idaho — Ada
  '17001', // Illinois — Adams
  '18001', // Indiana — Adams
  '19001', // Iowa — Adair
  '20001', // Kansas — Allen
  '21001', // Kentucky — Adair
  '22001', // Louisiana — Acadia
  '23001', // Maine — Androscoggin
  '24001', // Maryland — Allegany
  '25001', // Massachusetts — Barnstable
  '26001', // Michigan — Alcona
  '27001', // Minnesota — Aitkin
  '28001', // Mississippi — Adams
  '29001', // Missouri — Adair
  '30001', // Montana — Beaverhead
  '31001', // Nebraska — Adams
  '32001', // Nevada — Churchill
  '33001', // New Hampshire — Belknap
  '34001', // New Jersey — Atlantic
  '35001', // New Mexico — Bernalillo
  '36001', // New York — Albany
  '37001', // North Carolina — Alamance
  '38001', // North Dakota — Adams
  '39001', // Ohio — Adams
  '40001', // Oklahoma — Adair
  '41001', // Oregon — Baker
  '42001', // Pennsylvania — Adams
  '44001', // Rhode Island — Bristol
  '45001', // South Carolina — Abbeville
  '46001', // South Dakota — Aurora
  '47001', // Tennessee — Anderson
  '48001', // Texas — Anderson
  '49001', // Utah — Beaver
  '50001', // Vermont — Addison
  '51001', // Virginia — Accomack
  '53001', // Washington — Adams
  '54001', // West Virginia — Barbour
  '55001', // Wisconsin — Adams
  '56001', // Wyoming — Albany
])

export function hasSurveillanceData(fips) {
  return COUNTIES_WITH_SURVEILLANCE.has(fips)
}
