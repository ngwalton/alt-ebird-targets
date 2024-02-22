const querystring = require('node:querystring');

function get_query(req) {
  const base_url = `${req.protocol}://${req.headers.host}/`;
  const req_url = new URL(req.url, base_url);
  const query = req_url.search.replace('?', '');
  return querystring.parse(query);
}

// function to download general ebird data
async function get_ebird_data(url) {
  try {
    let myHeaders = new Headers();
    myHeaders.append('X-eBirdApiToken', process.env.EBIRD_API_KEY);

    let requestOptions = {
      method: 'GET',
      headers: myHeaders,
      redirect: 'follow',
    };

    const response = await fetch(url, requestOptions);
    const out = await response.json();

    return out;
  } catch (e) {
    console.error(e);
  }
}

// function to download hotspots for a given county
// US counties are specified by ebird using FIPS (e.g., "US-WI-055")
// ebird calls this "subnational2Code"
async function get_hotspots(fips) {
  try {
    let hotspots_url = `https://api.ebird.org/v2/ref/hotspot/${fips}?fmt=json`;
    let hotspots_array = await get_ebird_data(hotspots_url);

    let hotspot_geo = {
      type: 'FeatureCollection',
      features: [],
    };

    for (let hotspot of hotspots_array) {
      let feature = {
        type: 'Feature',
        name: 'hotspot_locations',
        geometry: {
          type: 'Point',
          coordinates: [hotspot.lng, hotspot.lat],
        },
        properties: {
          locId: hotspot.locId,
          locName: hotspot.locName,
          countryCode: hotspot.countryCode,
          subnational1Code: hotspot.subnational1Code,
          subnational2Code: hotspot.subnational2Code,
          numSpeciesAllTime: hotspot.numSpeciesAllTime,
        },
      };

      hotspot_geo.features.push(feature);
    }

    return hotspot_geo;
  } catch (e) {
    console.error(e);
  }
}

// function to download species list for a given region or hotspot
// returns a array of 6-letter common name alpha codes
// loc can be an ebird fips/subnational2Code or a hotspot id
async function get_species_list(loc) {
  try {
    const county_url = 'https://api.ebird.org/v2/product/spplist/' + loc;

    const species_list = await get_ebird_data(county_url);

    return species_list;
  } catch (e) {
    console.error(e);
  }
}

// function to download target species list for a given hotspot
// returns a array of 6-letter common name alpha codes
async function get_hotspot_target_list(fips, hotspot) {
  try {
    const county_list = await get_species_list(fips);
    const hotspot_list = await get_species_list(hotspot);

    // remove species from county_list that are in hotspot_list
    const hotspot_targets = county_list.filter(
      (x) => !hotspot_list.includes(x),
    );

    return hotspot_targets;
  } catch (e) {
    console.error(e);
  }
}

// function to download and parse ebird taxonomy for given list of species
// species_list is an array of 6-letter common name alpha codes
// returns an array of species objects
async function get_ebird_taxonomy(species_list) {
  try {
    const species_pattern = species_list.reduce((a, b) => a + ',' + b);
    const taxon_url =
      'https://api.ebird.org/v2/ref/taxonomy/ebird?species=' +
      species_pattern +
      '&version=2023.0&fmt=json';

    const taxon_raw = await get_ebird_data(taxon_url);

    // for taxonomic sort add x['taxonOrder'], but should already be in
    // taxonomic order
    const taxon = taxon_raw
      .filter((x) => x.category === 'species') // only include full species
      .map((x) => {
        return {
          sciName: x.sciName,
          comName: x.comName,
          speciesCode: x.speciesCode,
        };
      });

    return taxon;
  } catch (e) {
    console.error(e);
  }
}

// it seems this functionality is currently not supported by the ebird api
// at the subnational2Code scale
// function to download species list for adjacent regions (counties)
// async function get_adjacent_species_list(fips) {
//     try {
//         const url = `https://api.ebird.org/v2/ref/adjacent/${fips}`;
//         const adjacent_counties = get_ebird_data(url);

//         return adjacent_counties;
//     } catch {e} {
//         console.error(e);
//     }
// }

// exports.get_adjacent_species_list = get_adjacent_species_list;

// function to download species lists for all hotspots in a county and check if
// a given species has been confirmed at each
// returns an an array of hotspot objects where species alpha has not been
// confirmed
// alpha is a 6-letter common name alpha code
async function get_species_target_list(fips, alpha) {
  try {
    const hotspots = await get_hotspots(fips);

    const species_list_promises = hotspots.features.map((hotspot) =>
      get_species_list(hotspot.properties.locId),
    );

    const hotspot_species_lists = await Promise.all(
      species_list_promises,
    ).catch((_) => {
      console.log(`Attempting to download ${alpha} a second time`);
      return Promise.all(species_list_promises);
    });

    const hotspots_without_confirmed_obs = hotspots.features.filter(
      (_, i) => !hotspot_species_lists[i].includes(alpha),
    );

    return hotspots_without_confirmed_obs;
  } catch (e) {
    console.error(e);
  }
}

module.exports = {
  get_query,
  get_ebird_data,
  get_hotspots,
  get_species_list,
  get_hotspot_target_list,
  get_ebird_taxonomy,
  get_species_target_list,
};
