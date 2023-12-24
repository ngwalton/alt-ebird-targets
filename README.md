# hotspot_targets

A web app to list bird species that have *not* been reported at a given
[eBird](https://ebird.org/home) [hotspot](https://ebird.org/hotspots).
After selecting a hotspot, the app displays a list of species reported from the
corresponding county minus those already reported from the hotspot.
This is in contrast to eBird's
[target species feature](https://ebird.org/targets) which lists species
confirmed from a hotspot or region but not reported by the user.
This web app can be helpful for targeting species to increase the species count
at your favorite eBird hotspots.

**In development -- currently returns and prints a JSON version of the hotspot
target species list.**

Currently setup to work only with hotspots in Jefferson Co, WI, but will be
generalized to WI and possibly to larger scales.

The following files are not under version control and will need to be added to
`./public`:

- [County_Boundaries_24K.geojson](https://data-wi-dnr.opendata.arcgis.com/datasets/wi-dnr::county-boundaries-24k/explore)
(Wisconsin county bounds) from WI DNR
- [leaflet.ajax.min.js](https://github.com/calvinmetcalf/leaflet-ajax/blob/gh-pages/dist/leaflet.ajax.min.js)
from [calvinmetcalf/leaflet-ajax](https://github.com/calvinmetcalf/leaflet-ajax)
(used for `L.GeoJSON.AJAX`)
