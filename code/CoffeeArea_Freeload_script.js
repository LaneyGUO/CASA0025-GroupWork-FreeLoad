//--------------------- Step 1: Importing and Pre-Processing  --------------------------------
// Read Ermera boundary
var ermera = ee.FeatureCollection('users/chaillleexy/Ermera');

var start_o = '2022-01-01';
var end_o = '2022-12-31';

// Useable bands
var bands = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12'];

var sentinel = ee.ImageCollection('COPERNICUS/S2_SR')
                  .filterDate(start_o, end_o)
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 1))
                  .mean()
                  .select(bands)
                  
var visParams = {
  min: 0.0,
  max: 3000,
  bands: ['B4', 'B3', 'B2'],
  opacity: 1
};




// palette with the colors
var palette_vis= [
  '49cc47', 
  '0008ff',
  'fff700']

// name of the legend
//var names = ['Suitable coffee planting areas','Classified existing coffee planting areas'];
 
legend.add(makeRow('49cc47', 'Suitable coffee planting areas', '000000'));
legend.add(makeRow('2ff5ff', 'Classified existing coffee planting areas','0008ff'));







//////////////////////// "View Area Changes" button config.////////////////////////
var coffeeVisParams = {
  palette: '2ff5ff', // Set the color
  format: 'png',     // Set the output format
  opacity: 0.7       // Set transparency
};

var suitableVisParams = {
  palette: '49cc47', 
  format: 'png',     
  opacity: 0.7
};


var view_changes = ui.Button({
  style:{stretch: 'horizontal'},
  label: 'View Area Changes',
  onClick: 
  function chang_panel() {
    
    Map.setOptions("Satellite")
    Map.centerObject(ermera,10);
    var subtitle1 = ui.Label({
    value: '- View Area Changes',
    style: {
     fontWeight: 'bold',
     fontSize: '14px',
     margin: '0 0 4px 0',
     padding: '0'
     }
    });
    

///////// Design Detected Coffee by Years ///////////////////
    // Define a list of time ranges
    var years = ee.List.sequence(2018, 2024);

    var generateCoffeePrediction = function(start,end) {

      // Use the Sentinel-2 image set
      var sentinel = ee.ImageCollection('COPERNICUS/S2_SR')
                        .filterDate(start, end)
                        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 1))
                        .mean()
                        .select(bands);
    
      // Place your suitability mask and other related code here
      var coffeePrediction = model_training(start,end);
    
      // Return to the Kofi Prerediction layer
      return coffeePrediction.clip(ermera);
    };
    

    var daterangeVectors = function () {
      // Clear all layers on the map
      Map.layers().reset();
      // Get the date range from the date slider widget.
      var range = ee.DateRange(
        ee.Date(yearSlider.getValue()[0]),
        ee.Date(yearSlider.getValue()[1])
      );
    
      
      var start = range.start().format("YYYY-MM-dd");
      var end = range.end().format("YYYY-MM-dd");

      // Load MODIS land surface temperature dataset
      var dataset = ee.ImageCollection('MODIS/006/MOD11A2')
                        .filterDate(start, end)
                        .select('LST_Day_1km')
                        .map(function(image) {
                            return image.multiply(0.02).subtract(273.15); // Convert to Celsius
                        });
      // Create a temperature mask for the range 15°C to 24°C
      var tempMask = dataset.map(function(image) {
        return image.gte(15).and(image.lte(24));
      }).mean();
      var CoffeeDetect = generateCoffeePrediction(start,end)
      // Create a combined mask based on NDVI, NDMI, slope, and temperature
      var suitableMask = basicMask.and(ndmi.gte(0.2)).and(slopeMask).and(tempMask).and(elevationMask);

      // Apply the mask to the Sentinel-2 image
      var suitableImage = sentinel.updateMask(suitableMask);

      Map.addLayer(basicImage.clip(ermera), visParams, 'Basic Areas');
      Map.addLayer(CoffeeDetect, coffeeVisParams, 'Existing Coffee area');

  };

    
        // Create a year slider that allows the user to select a year
    var yearSlider = ui.DateSlider({
        value: "2021-01-01",
        start: "2018-01-01",
        end: "2023-12-31",
        // end: Date.now(),
        period: 365,
        onChange: daterangeVectors,
        style: { width: "95%" }
        });
        
    var ecoregions = ee.FeatureCollection([
      ee.Feature(null, {'2018': 6332, '2019': 6385, '2020': 6285, '2021': 6530, '2022': 6559, '2023':6418.2, 'label': 'Suitable'}),
      ee.Feature(null, {'2018':2243.6,'2019': 2999, '2020': 2699, '2021': 2292, '2022': 1387,'2023': 1841, 'label': 'Existing'})
    ]);
      print(ecoregions)
      // Define a dictionary that associates property names with values and labels.
      var precipInfo = {
        '2018': {v: '2018', f: '2018'},
        '2019': {v: '2019', f: '2019'},
        '2020': {v: '2020', f: '2020'},
        '2021': {v: '2021', f: '2021'},
        '2022': {v: '2022', f: '2022'},
        '2023': {v: '2023', f: '2023'}
      };
      
      // Organize property information into objects for defining x properties and
      // their tick labels.
      var xPropValDict = {};  // Dictionary to codify x-axis property names as values.
      var xPropLabels = [];   // Holds dictionaries that label codified x-axis values.
      for (var key in precipInfo) {
        xPropValDict[key] = precipInfo[key].v;
        xPropLabels.push(precipInfo[key]);
      }
      
      // Define the chart and print it to the console.
      var chart = ui.Chart.feature
                  .byProperty({
                    features: ecoregions,
                    xProperties: xPropValDict,
                    seriesProperty: 'label'
                  })
                  .setChartType('AreaChart')
                  .setOptions({
                    title: 'Statistics of existing and suitable coffee areas by yeas',
                    hAxis: {
                      title: 'Year',
                      titleTextStyle: {italic: false, bold: true},
                      ticks: xPropLabels
                    },
                    vAxis: {
                      title: 'Area (square hectares)',
                      titleTextStyle: {italic: false, bold: true}
                    },
                    colors: ['0f8755', '0008ff', 'f0af07'],
                    lineSize: 5,
                    pointSize: 0,
                    curveType: 'function'
                  });


    console.clear()
    console.add(title)
    console.add(subtitle1)
    console.add(ui.Label('View the distribution and total area of existing and suitable coffee planting areas for different years in Ermera.', {whiteSpace: 'wrap'}))
    console.add(yearSlider)
    console.add(chart)
    console.add(home_button)
  }

});
//////////////////////// "View Area Changes" button config.////////////////////////
