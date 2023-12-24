const express = require('express');
require('dotenv').config(); // load .env in process.env object

const app = express();

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

// function to download hotspot geographic data
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

// requesting hotspot needs
app.get('/L*+', async (req, res) => {
    // get the hotspot species list
    const hotspot_id = req["url"];  // includes a forward slash at the beginning
    const hotspot_url = "https://api.ebird.org/v2/product/spplist" + hotspot_id;
    const hotspot_list = await get_ebird_data(hotspot_url);

    // get the county species list
    const county_url = "https://api.ebird.org/v2/product/spplist/" + region;
    const county_list = await get_ebird_data(county_url);

    // remove species from county_list that are in hotspot_list
    const hotspot_needs = county_list.filter(x => !hotspot_list.includes(x));

    // get the taxon list limited to the species in hotspot_needs
    const species_pattern = hotspot_needs.reduce((a, b) => a + ',' + b);
    const taxon_url = `https://api.ebird.org/v2/ref/taxonomy/ebird?species=${species_pattern}&version=2023.0&fmt=json`;

    const taxon_raw = await get_ebird_data(taxon_url);
    let taxon = taxon_raw
        .filter(x => x.category === 'species')
        .map(x => {
            return {'sciName': x['sciName'], 'comName': x['comName'], 'speciesCode': x['speciesCode']}
    });  // for taxonomic sort use x['taxonOrder'], but should be in taxonomic order already

    taxon = JSON.stringify(taxon);

    res.send(taxon);
});

// index map
app.get('/', async (req, res) => {
    let hotspot_geo = await get_hotspots(region);
    hotspot_geo = JSON.stringify(hotspot_geo);

    res.render('index', {hotspot_geo: hotspot_geo});
});

app.listen(process.env.PORT, () => console.log(`Server listening on port ${process.env.PORT}`));
