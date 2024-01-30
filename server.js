const express = require('express');
const {get_ebird_data, get_hotspots, get_query} = require('./helpers');
require('dotenv').config(); // load .env in process.env object

const app = express();

// put static files here, e.g. css, js, static html
app.use(express.static('public'));

// use ejs as the view manager
app.set('view engine', 'ejs');

// requesting hotspot targets
// query example: "?fips=US-WI-055&hotspot=L1460709"
app.get('/hotspot-targets', async (req, res) => {
    const query = get_query(req);

    // get the hotspot species list
    const hotspot_url =
        "https://api.ebird.org/v2/product/spplist/" + query.hotspot;
    const hotspot_list = await get_ebird_data(hotspot_url);

    // get the county species list
    const county_url =
        "https://api.ebird.org/v2/product/spplist/" + query.fips;
    const county_list = await get_ebird_data(county_url);

    // remove species from county_list that are in hotspot_list
    const hotspot_targets = county_list.filter(x => !hotspot_list.includes(x));

    // get the taxon list limited to the species in hotspot_targets
    const species_pattern = hotspot_targets.reduce((a, b) => a + ',' + b);
    const taxon_url =
        'https://api.ebird.org/v2/ref/taxonomy/ebird?species=' +
        species_pattern + '&version=2023.0&fmt=json';

    const taxon_raw = await get_ebird_data(taxon_url);
    // for taxonomic sort add x['taxonOrder'], but should already be in
    // taxonomic order 
    let taxon = taxon_raw
        .filter(x => x.category === 'species')
        .map(x => {
            return {'sciName': x['sciName'], 'comName': x['comName'],
            'speciesCode': x['speciesCode']}
    });

    taxon = JSON.stringify(taxon);

    res.send(taxon);
});

// return selected county hotspots
// query example "?fips=US-WI-055"
app.get('/get-county-hotspots', async (req, res) => {
    try {
        const query = get_query(req);

        let hotspot_geo = await get_hotspots(query.fips);
        hotspot_geo = JSON.stringify(hotspot_geo);

        res.send(hotspot_geo);
    } catch (e) {
        console.log(e);
    }
});

// index map
app.get('/', (req, res) => {
    res.render('index');
});

app.listen(process.env.PORT, () =>
    console.log(`Server listening on port ${process.env.PORT}`));
