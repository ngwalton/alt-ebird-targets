/* eslint-disable no-use-before-define -- chose to use hoisting */
/* eslint-disable no-undef -- L is defined in the leaflet library */
// create an empty map displayed in the div with corresponding id
const map = L.map('map', {
  center: [44.83201737692425, -89.84701988680985],
  zoom: 7,
  minZoom: 5,
  zoomControl: false,
});

// add open street map basemap
const basemap = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
  attribution:
    '&copy; <a href="http://osm.org/copyright">' +
    'OpenStreetMap</a> contributors',
});

basemap.addTo(map);

// add scale and zoom widgets
L.control.scale().addTo(map);
L.control.zoom({ position: 'topright' }).addTo(map);

// uncomment this to expose coBnds to global env for testing
// const coBnds;
// add county bounds to map and populate the county search list
getCoBnds()
  .then((coBndsJSON) => {
    // add bounds to map
    coBnds = L.geoJSON(coBndsJSON).on('click', zoomToCountyMakeUpdatesOnClick);
    coBnds.addTo(map);
    // zoom to fit county bounds -- makes sure entire state is visible as start
    map.flyToBounds(coBnds.getBounds());
    return coBndsJSON;
  })
  .then(populateCountySearch);

// add input event listener to search counties from search box
addSearchEventListener('county', 'startsWith');

// add event listener to search hotspots from search box
addSearchEventListener('hotspot', 'includes');

// add event listener to search species from search box
// uncomment when species list feature is added
addSearchEventListener('species', 'includes');

// on clicking the enter key, the first county in the results is placed in the
// search box and the map zooms to that county
addEnterEventListener('county', (county) => {
  // zoom to selected county
  map.eachLayer((layer) => {
    if (layer.feature?.properties?.COUNTY_NAME === county.textContent) {
      const bb = layer.getBounds();
      zoomToCountyMakeUpdates(county.textContent, county.id, bb);
    }
  });
});

addEnterEventListener(
  'hotspot',
  (hotspot) => {
    // show target species
    getTargets(hotspot.dataset.fips, hotspot.id);

    // click popup for selected hotspot
    map.eachLayer((layer) => {
      if (layer.feature?.properties?.locName === hotspot.textContent) {
        layer.fire('click');
      }
    });
  },
  'includes',
);

addEnterEventListener(
  'species',
  (species) => {
    getHotspotsForSpecies(species.dataset.fips, species.id).then((hotspots) => {
      clearHotspots();
      addHotspotsToMap(hotspots);
    });
  },
  'includes',
);

// event listener to clear/add hotspots on map based on selected target type
const radioInput = document.querySelector('#type-radio-form');
radioInput.addEventListener('change', () => {
  const countySearchInput = document.querySelector('#county-input');
  const countyEntered = countySearchInput.value.length;
  if (countyEntered) {
    updateVisibleSearchField();
    countySearchInput.dispatchEvent(enterEvent());
    return;
  }

  clearHotspots();
});

function updateVisibleSearchField() {
  if (!document.querySelector('#county-input').value.length) {
    return;
  }

  const type = getTargetType();
  const searchContainers = document.querySelectorAll(
    '.search-container:not([data-name="county"]',
  );

  searchContainers.forEach((container) => {
    const show = container.dataset.name === type;
    container.classList.toggle('show', show);
  });
}

// toggle hamburger menu open and closed
const toggleButton = document.querySelector('.toggle-button');
const navbarLinks = document.querySelector('.navbar-links');

toggleButton.addEventListener('click', () => {
  navbarLinks.classList.toggle('active');
});

/* functions */

/* map related functions */

// function to return WI County Bounds: if not found in localStorage, they are
// downloaded and saved to localStorage before returning the bounds
async function getCoBnds() {
  if (localStorage.coBnds) {
    console.log('Retrieved Co Bounds from local storage');
    return JSON.parse(localStorage.coBnds);
  }

  // metadata/api info:
  // https://data-wi-dnr.opendata.arcgis.com/datasets/wi-dnr::county-boundaries-24k/about
  const url =
    'https://dnrmaps.wi.gov/arcgis/rest/services/DW_Map_Dynamic/' +
    'EN_Basic_Basemap_WTM_Ext_Dynamic_L16/MapServer/3/' +
    'query?outFields=COUNTY_NAME,COUNTY_FIPS_CODE&where=1%3D1&outSR=4326&f=geojson';

  try {
    const res = await fetch(url);
    const coBndsJSON = await res.json();
    localStorage.coBnds = JSON.stringify(coBndsJSON);

    console.log('Downloaded Co Bounds and saved to local storage');
    return coBndsJSON;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// remove all hotspots from map
function clearHotspots() {
  map.eachLayer((layer) => {
    if (layer.feature?.name === 'hotspot_locations') {
      map.removeLayer(layer);
    }
  });
}

function zoomToCountyMakeUpdatesOnClick(click) {
  const coName = click.layer.feature.properties.COUNTY_NAME;

  // do nothing if the clicked county is currently selected
  if (document.querySelector('#county-input').value === coName) {
    return;
  }

  const bb = click.sourceTarget.getBounds();
  const fips = click.layer.feature.properties.COUNTY_FIPS_CODE.padStart(3, '0');
  zoomToCountyMakeUpdates(coName, `US-WI-${fips}`, bb);
}

function zoomToCountyMakeUpdates(coName, fips, bb) {
  // add selected county to county search box
  document.querySelector('#county-input').value = coName;

  map.fitBounds(bb);
  updateCountyOpacity(fips);

  // clear hotspots, inputs, and search results
  clearHotspots();
  clearSearchInput('hotspot');
  clearSearchInput('species');
  ['species', 'hotspot'].forEach((name) => {
    clearSearchInput(name);
    deleteAllSearchItems(name);
  });
  clearVisSearchItems('county');
  clearTargetsList();

  // add hotspots if hotspot targets is selected
  if (getTargetType() === 'hotspot') {
    getCountyHotspots(fips)
      .then(populateHotspotSearch)
      .then(addHotspotsToMap)
      .catch((e) => console.error(e));
  }

  if (getTargetType() === 'species') {
    populateSpeciesSearch(fips);
  }

  updateVisibleSearchField();
}

// add .clear to selected county
function updateCountyOpacity(fips) {
  map.eachLayer((layer) => {
    if (!layer.feature?.properties?.COUNTY_FIPS_CODE) {
      return;
    }

    const rawFIPS = parseInt(fips.replace(/\D/g, ''), 10).toString();
    isSelected = layer.feature.properties.COUNTY_FIPS_CODE === rawFIPS;
    // eslint-disable-next-line no-underscore-dangle -- access classlist
    layer._path.classList.toggle('clear', isSelected);
  });
}

// function to display hotspot name, n species reported, and link to
// open hotspot targets on hotspot popup
function onEachFeature(feature, layer) {
  const { locId, locName, subnational2Code, numSpeciesAllTime } =
    feature.properties;

  const popupContent = `<div class='pop-header'>
      <a href='https://ebird.org/hotspot/${locId}'
        target='_blank'>
        ${locName}
      </a>
    </div>
    <div class='n-species-obs'>
      <p>Species confirmed:
        ${numSpeciesAllTime || 0}</p>
    </div>
    <div>
      <button type='button' class='btn btn-primary'
        onclick="getTargetsUpdateInput(
          '${subnational2Code}',
          '${locId}',
          '${locName.replace(/'/g, "\\'")}'
        );">
        Target species
      </button>
    </div>`;

  layer.bindPopup(popupContent);
}

// eslint-disable-next-line no-unused-vars -- function is used in onEachFeature
function getTargetsUpdateInput(fips, id, name) {
  getTargets(fips, id);
  const hotspotInput = document.querySelector(`#hotspot-input`);
  hotspotInput.value = name;

  // update hotspots and set radio to hotspot
  if (getTargetType() !== 'hotspot') {
    document.querySelector('#type-hotspot').checked = true;

    getCountyHotspots(fips)
      .then(populateHotspotSearch)
      .then(addHotspotsToMap)
      .catch((e) => console.error(e));

    updateVisibleSearchField();
  }
}

// function to load county hotspots from ebird servers
async function getCountyHotspots(fips) {
  try {
    const query = `./get-county-hotspots?fips=${fips}`;
    const res = await fetch(query);
    const hotspots = await res.json();

    // return the hotspots geojson to pass to other functions
    return hotspots;
  } catch (e) {
    console.error(e);
    return null;
  } finally {
    console.log(`Getting hotspots for: ${fips}`);
  }
}

// function to take a hotspots geojson and add it to the map
function addHotspotsToMap(hotspots) {
  const hotspotGeo = L.geoJSON(hotspots, { onEachFeature });

  hotspotGeo.addTo(map);
}

/* eslint-enable no-undef -- done using L */

/* search related functions */

// function to add an input search event listener for each of the search boxes
// name is the name of the input and matchMethod should be one of "includes" or
// "startsWith"
function addSearchEventListener(name, matchMethod) {
  const searchInput = document.querySelector(`#${name}-input`);
  searchInput.addEventListener('input', (e) => {
    // avoid matching on the empty string
    const value = e.target.value.toLowerCase() || null;
    const listItems = document.querySelectorAll(`#${name}-search-list li`);
    listItems.forEach((item) => {
      let chosen = item.textContent.toLowerCase();
      chosen =
        matchMethod === 'includes'
          ? chosen.includes(value)
          : chosen.startsWith(value);

      item.classList.toggle('visible', chosen);
    });
  });
}

// function to return the currently selected target type
function getTargetType() {
  return document.querySelector('input[name="type-radio"]:checked').value;
}

// function to select the clicked search-list item and call enter
function searchListClick(name, event) {
  const searchInput = document.querySelector(`#${name}-input`);
  searchInput.value = event.currentTarget.textContent;
  searchInput.dispatchEvent(enterEvent());
}

// function to populate a li element for search results
// data is an optional object of data classes to add
// data should have the form: {'data-name': 'value', 'data-name2': 'value'}
// name is the name of the search input (i.e., county, hotspot, species)
function populateLi(id, textContent, name, data = {}) {
  const li = document.createElement('li');
  li.classList.add('search-item');
  li.id = id;

  if (Object.keys(data).length) {
    Object.entries(data).forEach(([key, value]) => {
      li.setAttribute(key, value);
    });
  }

  li.textContent = textContent;
  li.addEventListener('click', (event) => searchListClick(name, event));

  return li;
}

// function to populate county search box from geojson
function populateCountySearch(coBndsJSON) {
  const coProps = coBndsJSON.features.map((f) => f.properties);
  const coSearch = document.querySelector('#county-search-list');

  coProps.forEach((coProp) => {
    const id = `US-WI-${coProp.COUNTY_FIPS_CODE.padStart(3, '0')}`;
    const li = populateLi(id, coProp.COUNTY_NAME, 'county');
    coSearch.append(li);
  });
}

// function to populate hotspot search; hotspots is a hotspots geojson
function populateHotspotSearch(hotspots) {
  const props = hotspots.features.map((f) => f.properties);
  const search = document.querySelector('#hotspot-search-list');

  // remove any current hotspots
  deleteAllSearchItems('hotspot');

  props.forEach((prop) => {
    const data = { 'data-fips': prop.subnational2Code };
    const li = populateLi(prop.locId, prop.locName, 'hotspot', data);
    search.append(li);
  });

  return hotspots;
}

// to do: this is a place holder. need to finish placing the species in the
// search ul
// function to populate the species search
async function populateSpeciesSearch(fips) {
  try {
    const query = `county-species-list?fips=${fips}`;
    const res = await fetch(query);
    const species = await res.json();

    const search = document.querySelector('#species-search-list');

    // remove any current species
    deleteAllSearchItems('species');

    species.forEach((sp) => {
      const data = { 'data-fips': fips };
      const li = populateLi(sp.speciesCode, sp.comName, 'species', data);
      search.append(li);
    });
  } catch (e) {
    console.error(e);
  } finally {
    console.log(`Getting data for: ${fips}`);
  }
}

// function to use in an event listener to select the top result on clicking
// enter. returns the selected li after updating the input value and removing
// search results
function selectTopItemOnEnter(event, name, matchMethod) {
  // avoid matching on the empty string
  const value = event.target.value.toLowerCase() || null;
  const listItems = document.querySelectorAll(`#${name}-search-list li`);
  const selected = Array.from(listItems).filter((item) => {
    const chosen = item.textContent.toLowerCase();
    return matchMethod === 'includes'
      ? chosen.includes(value)
      : chosen.startsWith(value);
  })[0];

  const searchInput = document.querySelector(`#${name}-input`);
  searchInput.value = selected.textContent;
  clearVisSearchItems(name);

  return selected;
}

// on clicking the enter key, the first li in the results is placed in the
// search box and a search type specific function is run with the first li as
// the input
function addEnterEventListener(name, fn, matchMethod = 'startsWith') {
  const searchInput = document.querySelector(`#${name}-input`);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    try {
      // select the top menu result and get the corresponding li
      const selected = selectTopItemOnEnter(event, name, matchMethod);

      fn(selected);
    } catch (e) {
      // to do: this should be a popup or something more elegant
      console.error(e);
      alert(`Enter valid ${name}`);
    }
  });
}

// function to clear search input fields
function clearSearchInput(name) {
  document.querySelector(`#${name}-input`).value = '';
}

// function to clear visible search results
function clearVisSearchItems(name) {
  const searchItems = document.querySelectorAll(
    `#${name}-search-list > li.visible`,
  );

  searchItems.forEach((item) => {
    item.classList.toggle('visible', false);
  });
}

// function to delete all li items a parent search list
function deleteAllSearchItems(name) {
  const searchItems = document.querySelector(`#${name}-search-list`);
  searchItems.replaceChildren();
}

function clearTargetsList() {
  document.querySelector('#targets').replaceChildren();
}

function enterEvent() {
  return new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    which: 13,
    keyCode: 13,
  });
}

/* target results related functions */

// function to parse ebird species object and format as html
function parseSpecies(fips, targetsObj) {
  return targetsObj.reduce((markup, sp) => {
    const link = `https://ebird.org/wi/species/${sp.speciesCode}/${fips}`;

    // eslint-disable-next-line no-param-reassign
    markup += `<p><a href="${link}" target="_blank">
      <span class="comName">${sp.comName}</span>
      <span class="sciName">${sp.sciName}</span></a></p>`;

    return markup;
  }, '');
}

// function to parse ebird hotspot object and format as html
function parseHotspots(targetsObj) {
  return targetsObj.reduce((markup, hotspot) => {
    const link = `https://ebird.org/wi/hotspot/${hotspot.properties.locId}`;

    // eslint-disable-next-line no-param-reassign
    markup += `<p><a href="${link}" target="_blank">
      <span class="hotspot">${hotspot.properties.locName}</span></a></p>`;

    return markup;
  }, '');
}

// function to fetch target species for selected hotspot
async function getTargets(fips, locID) {
  try {
    const query = `hotspot-targets?fips=${fips}&hotspot=${locID}`;
    const res = await fetch(query);
    const targets = await res.json();
    const dest = document.querySelector('#targets');
    dest.innerHTML = parseSpecies(fips, targets);
  } catch (e) {
    console.error(e);
  } finally {
    console.log(`Getting data for: ${locID}`);
  }
}

// function to fetch target hotspots for selected species
async function getHotspotsForSpecies(fips, alpha) {
  try {
    const query = `species-target?fips=${fips}&alpha=${alpha}`;
    const res = await fetch(query);
    const targets = await res.json();
    const dest = document.querySelector('#targets');
    dest.innerHTML = parseHotspots(targets);
    return targets;
  } catch (e) {
    console.error(e);
    return null;
  } finally {
    console.log(`Getting data for: ${alpha}`);
  }
}

// scroll targets side panel back to top
// eslint-disable-next-line no-unused-vars -- function is used on button
function backToTop() {
  document.querySelector('#target-wrapper').scrollTop = 0;
}

// When the user scrolls down, show the button
document.querySelector('#target-wrapper').onscroll = () => {
  const backToTopButton = document.querySelector('#backToTopButton');
  const sidePanel = document.querySelector('#target-wrapper');
  backToTopButton.style.display = sidePanel.scrollTop > 250 ? 'block' : 'none';
};
