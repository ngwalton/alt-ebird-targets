const express = require('express');
const {
  get_hotspots,
  get_query,
  get_hotspot_target_list,
  get_ebird_taxonomy,
  get_species_target_list,
  get_species_list,
} = require('./helpers');
require('dotenv').config(); // load .env in process.env object

const app = express();

// put static files here, e.g. css, js, static html
app.use(express.static('public'));

// use ejs as the view manager
app.set('view engine', 'ejs');

// api endpoint requesting hotspot target species
// query example: "?fips=US-WI-055&hotspot=L1460709"
app.get('/hotspot-targets', async (req, res) => {
  try {
    const query = get_query(req);

    const hotspot_target_list = await get_hotspot_target_list(
      query.fips,
      query.hotspot,
    );

    const taxon = await get_ebird_taxonomy(hotspot_target_list);

    res.json(taxon);
  } catch (e) {
    console.error(e);
  }
});

// api endpoint to request hotspot locations for selected county
// query example "?fips=US-WI-055"
app.get('/get-county-hotspots', async (req, res) => {
  try {
    const query = get_query(req);

    const hotspot_geo = await get_hotspots(query.fips);

    res.json(hotspot_geo);
  } catch (e) {
    console.error(e);
  }
});

// api endpoint to request a species' target hotspots (i.e., hotspots where a
// given species has not been confirmed)
// query example "?fips=US-WI-055&alpha=amerob"
app.get('/species-target', async (req, res) => {
  try {
    const query = get_query(req);

    // array of hotspots where the species has not been confirmed
    const species_target_list = await get_species_target_list(
      query.fips,
      query.alpha,
    );

    // return an array of hotspot names
    // remove .map to return array of hotspot objects
    res.json(species_target_list);
  } catch (e) {
    console.error(e);
  }
});

// api endpoint to request county species list
// query example "?fips=US-WI-055"
app.get('/county-species-list', async (req, res) => {
  try {
    const query = get_query(req);
    const species_list = await get_species_list(query.fips);
    const taxon = await get_ebird_taxonomy(species_list);
    res.json(taxon);
  } catch (e) {
    console.error(e);
  }
});

// index map
app.get('/', (req, res) => res.render('index'));

app.listen(process.env.PORT, () =>
  console.log(`Server listening on port ${process.env.PORT}`),
);
