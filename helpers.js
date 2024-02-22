const querystring = require('node:querystring');

function getQuery(req) {
  const baseURL = `${req.protocol}://${req.headers.host}/`;
  const reqURL = new URL(req.url, baseURL);
  const query = reqURL.search.replace('?', '');
  return querystring.parse(query);
}

// function to download general ebird data
async function getEbirdData(url) {
  try {
    const myHeaders = new Headers();
    myHeaders.append('X-eBirdApiToken', process.env.EBIRD_API_KEY);

    const requestOptions = {
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
async function getHotspots(fips) {
  try {
    const hotspotsURL = `https://api.ebird.org/v2/ref/hotspot/${fips}?fmt=json`;
    const hotspotsArray = await getEbirdData(hotspotsURL);

    const hotspotGeo = {
      type: 'FeatureCollection',
      features: [],
    };

    for (const hotspot of hotspotsArray) {
      const feature = {
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

      hotspotGeo.features.push(feature);
    }

    return hotspotGeo;
  } catch (e) {
    console.error(e);
  }
}

// function to download species list for a given region or hotspot
// returns a array of 6-letter common name alpha codes
// loc can be an ebird fips/subnational2Code or a hotspot id
async function getSpeciesList(loc) {
  try {
    const countyURL = `https://api.ebird.org/v2/product/spplist/${loc}`;

    const speciesList = await getEbirdData(countyURL);

    return speciesList;
  } catch (e) {
    console.error(e);
  }
}

// function to download target species list for a given hotspot
// returns a array of 6-letter common name alpha codes
async function getHotspotTargetList(fips, hotspot) {
  try {
    const countyList = await getSpeciesList(fips);
    const hotspotList = await getSpeciesList(hotspot);

    // remove species from countyList that are in hotspotList
    const hotspotTargets = countyList.filter((x) => !hotspotList.includes(x));

    return hotspotTargets;
  } catch (e) {
    console.error(e);
  }
}

// function to download and parse ebird taxonomy for given list of species
// alpha6s is an array of 6-letter common name alpha codes
// returns an array of species objects
async function getEbirdTaxonomy(alpha6s) {
  try {
    const alpha6csv = alpha6s.reduce((a, b) => `${a},${b}`);
    const taxonURL = `https://api.ebird.org/v2/ref/taxonomy/ebird?species=${alpha6csv}&version=2023.0&fmt=json`;

    const taxonRaw = await getEbirdData(taxonURL);

    // for taxonomic sort add x['taxonOrder'], but should already be in
    // taxonomic order
    const taxon = taxonRaw
      .filter((x) => x.category === 'species') // only include full species
      .map((x) => ({
        sciName: x.sciName,
        comName: x.comName,
        speciesCode: x.speciesCode,
      }));

    return taxon;
  } catch (e) {
    console.error(e);
  }
}

// it seems this functionality is currently not supported by the ebird api
// at the subnational2Code scale
// function to download species list for adjacent regions (counties)
// async function getAdjacentSpeciesList(fips) {
//     try {
//         const url = `https://api.ebird.org/v2/ref/adjacent/${fips}`;
//         const adjacentCounties = getEbirdData(url);

//         return adjacentCounties;
//     } catch {e} {
//         console.error(e);
//     }
// }

// exports.getAdjacentSpeciesList = getAdjacentSpeciesList;

// function to download species lists for all hotspots in a county and check if
// a given species has been confirmed at each
// returns an an array of hotspot objects where species alpha has not been
// confirmed
// alpha is a 6-letter common name alpha code
async function getSpeciesTargetList(fips, alpha) {
  try {
    const hotspots = await getHotspots(fips);

    const speciesListPromises = hotspots.features.map((hotspot) =>
      getSpeciesList(hotspot.properties.locId),
    );

    const hotspotSpeciesLists = await Promise.all(speciesListPromises).catch(
      () => {
        console.log(`Attempting to download ${alpha} a second time`);
        return Promise.all(speciesListPromises);
      },
    );

    const hotspotsWithoutConfirmedObs = hotspots.features.filter(
      (_, i) => !hotspotSpeciesLists[i].includes(alpha),
    );

    return hotspotsWithoutConfirmedObs;
  } catch (e) {
    console.error(e);
  }
}

module.exports = {
  getQuery,
  getEbirdData,
  getHotspots,
  getSpeciesList,
  getHotspotTargetList,
  getEbirdTaxonomy,
  getSpeciesTargetList,
};
