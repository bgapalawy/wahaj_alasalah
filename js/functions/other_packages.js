//water mark
L.Control.Watermark = L.Control.extend({
  onAdd: function (map) {
    var img = L.DomUtil.create("img");

    img.classList.add("logostyle");

    return img;
  },

  onRemove: function (map) {
    // Nothing to do here
  },
});
L.control.watermark = function (opts) {
  return new L.Control.Watermark(opts);
};

L.control.watermark({ position: "bottomleft" }).addTo(map);

// control search
var search_Controller = new L.Control.Search({
  layer: villa_data_layer,
  propertyName: "villaID",
  textErr: "Input Not Vallid",
  casesensitive: false,
  hideMarkerOnCollapse: true,
  position: "topleft",
  textPlaceholder: "Search By VillaID",
  moveToLocation: function (latLng, title, map) {
    map.setView([-0.004768967622973434, 0.00407695770263672], 3);
  },
});
map.addControl(search_Controller);








