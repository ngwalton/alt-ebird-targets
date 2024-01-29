const express = require('express');
const {get_ebird_data, get_hotspots} = require('./helpers');
require('dotenv').config(); // load .env in process.env object

const app = express();

// put static files here, e.g. css, js, static html
app.use(express.static('public'));

// use ejs as the view manager
app.set('view engine', 'ejs');

// requesting hotspot targets
let region = 'US-WI-055';
app.get('/L*+', async (req, res) => {
    // get the hotspot species list
    const hotspot_id = req["url"];  // includes a forward slash at the beginning
    const hotspot_url = "https://api.ebird.org/v2/product/spplist" + hotspot_id;
    const hotspot_list = await get_ebird_data(hotspot_url);

    // get the county species list
    const county_url = "https://api.ebird.org/v2/product/spplist/" + region;
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
app.get('/US-WI-*+', async (req, res) => {
    const region = req["url"].replace('\/', '');

    let hotspot_geo = await get_hotspots(region);
    hotspot_geo = JSON.stringify(hotspot_geo);

    res.send(hotspot_geo);
});

// index map
app.get('/', (req, res) => {
    res.render('index');
});

app.listen(process.env.PORT, () =>
    console.log(`Server listening on port ${process.env.PORT}`));
