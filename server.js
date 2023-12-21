const express = require('express');
require('dotenv').config(); // load .env in process.env object

const app = express();

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

// get hot spots
let region = 'US-WI-055';
async function get_hotspots(region_code) {
    let hotspots_url = `https://api.ebird.org/v2/ref/hotspot/${region_code}?fmt=json`;
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

// put static files here, e.g. css, js, static html
app.use(express.static('public'));

// use ejs as the view manager
app.set('view engine', 'ejs');

app.get('/', async (req, res) => {
    let hotspot_geo = await get_hotspots(region);
    hotspot_geo = JSON.stringify(hotspot_geo);

    res.render('index', {hotspot_geo: hotspot_geo});
});

app.listen(process.env.PORT, () => console.log(`Server listening on port ${process.env.PORT}`));
