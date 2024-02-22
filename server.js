const express = require('express');
const {
  getHotspots,
  getQuery,
  getHotspotTargetList,
  getEbirdTaxonomy,
  getSpeciesTargetList,
  getSpeciesList,
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
    const query = getQuery(req);

    const hotspotTargetList = await getHotspotTargetList(
      query.fips,
      query.hotspot,
    );

    const taxon = await getEbirdTaxonomy(hotspotTargetList);

    res.json(taxon);
  } catch (e) {
    console.error(e);
  }
});

// api endpoint to request hotspot locations for selected county
// query example "?fips=US-WI-055"
app.get('/get-county-hotspots', async (req, res) => {
  try {
    const query = getQuery(req);

    const hotspotGeo = await getHotspots(query.fips);

    res.json(hotspotGeo);
  } catch (e) {
    console.error(e);
  }
});

// api endpoint to request a species' target hotspots (i.e., hotspots where a
// given species has not been confirmed)
// query example "?fips=US-WI-055&alpha=amerob"
app.get('/species-target', async (req, res) => {
  try {
    const query = getQuery(req);

    // array of hotspots where the species has not been confirmed
    const speciesTargetList = await getSpeciesTargetList(
      query.fips,
      query.alpha,
    );

    // return an array of hotspot names
    // remove .map to return array of hotspot objects
    res.json(speciesTargetList);
  } catch (e) {
    console.error(e);
  }
});

// api endpoint to request county species list
// query example "?fips=US-WI-055"
app.get('/county-species-list', async (req, res) => {
  try {
    const query = getQuery(req);
    const speciesList = await getSpeciesList(query.fips);
    const taxon = await getEbirdTaxonomy(speciesList);
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
