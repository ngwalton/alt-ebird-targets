const querystring = require('node:querystring');

function get_query(req) {
    const base_url =  `${req.protocol}://${req.headers.host}/`;
    const req_url = new URL(req.url, base_url);
    const query = req_url.search.replace('\?', '');
    return querystring.parse(query);
}

exports.get_query = get_query;

// function to download general ebird data
async function get_ebird_data(url) {
    try {
        let myHeaders = new Headers();
        myHeaders.append("X-eBirdApiToken", process.env.EBIRD_API_KEY);

        let requestOptions = {
            method: 'GET',
            headers: myHeaders,
            redirect: 'follow'
        };

        const response = await fetch(url, requestOptions);
        const out = await response.json();

        return out;
    } catch (error) {
        console.error(error);
    }
}

exports.get_ebird_data = get_ebird_data;

// function to download hotspots for a given county
// US counties are specified by ebird using FIPS (e.g., "US-WI-055")
// ebird calls this "subnational2Code"
async function get_hotspots(fips) {
    let hotspots_url =
        `https://api.ebird.org/v2/ref/hotspot/${fips}?fmt=json`;
    let hotspots_array = await get_ebird_data(hotspots_url);

    let hotspot_geo = {
        "type": "FeatureCollection",
        "features": []
    };

    for (let hotspot of hotspots_array) {
        let feature = {
            "type": "Feature",
            "name": "hotspot_locations",
            "geometry": {
                "type": "Point",
                "coordinates": [hotspot.lng, hotspot.lat]
            },
            "properties": {
                "locId": hotspot.locId,
                "locName": hotspot.locName,
                "countryCode": hotspot.countryCode,
                "subnational1Code": hotspot.subnational1Code,
                "subnational2Code": hotspot.subnational2Code,
                "numSpeciesAllTime": hotspot.numSpeciesAllTime
            }
        };

        hotspot_geo.features.push(feature);
    }

    return hotspot_geo;
}

exports.get_hotspots = get_hotspots;
