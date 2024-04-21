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

// Create the basic mask to identify areas that have both vegetation cover and are not water bodies
var ndvi = sentinel.normalizedDifference(['B8', 'B4']).rename('ndvi');
var ndwi = sentinel.normalizedDifference(['B3', 'B8']).rename('ndwi');
var basicMask = ndvi.gte(0.2).and(ndwi.lt(0.3));  // Maintain low NDWI values to exclude water bodies
var basicImage = sentinel.updateMask(basicMask);


// Create a suitable mask for precise classification of suitable coffee growing areas
// Calculate NDMI
var ndmi = sentinel.normalizedDifference(['B8', 'B11']).rename('ndmi'); 

// Load SRTM digital elevation model data
var dem = ee.Image('USGS/SRTMGL1_003');
// Calculate slope
var slope = ee.Terrain.slope(dem).rename('slope');
var slopeMask = slope.gte(5).and(slope.lt(20));

// Load MODIS land surface temperature dataset
var dataset = ee.ImageCollection('MODIS/006/MOD11A2')
                  .filterDate(start_o, end_o)
                  .select('LST_Day_1km')
                  .map(function(image) {
                      return image.multiply(0.02).subtract(273.15); // Convert to Celsius
                  });

// Create a temperature mask for the range 15°C to 24°C
var tempMask = dataset.map(function(image) {
  return image.gte(15).and(image.lte(24));
}).mean();


// Calculate elevation
var alosDem = ee.Image('JAXA/ALOS/AW3D30/V2_2');

// Select the elevation band
var elevation = alosDem.select('AVE_DSM');

// Create an altitude mask that excludes areas below 700m and above 1900m
var elevationMask = elevation.gte(700).and(elevation.lte(1900));

// Create a combined mask based on NDVI, NDMI, slope, and temperature and elevation
var suitableMask = basicMask.and(ndmi.gte(0.2)).and(slopeMask).and(tempMask).and(elevationMask);

// Apply the mask to the Sentinel-2 image
var suitableImage = sentinel.updateMask(suitableMask);
Map.addLayer(suitableImage.clip(ermera), visParams, 'Suitable areas for coffee planting');


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



/////////////////////// "District Statistics" button config.///////////////////////
var district_stats = ui.Button({
  style:{stretch: 'horizontal'},
  label: 'Suitable Areas Statistics',
  onClick: 
  function ward_stats_panel() {
    
    Map.setOptions("Satellite")
    
    var subtitle2 = ui.Label({
    value: '- Suitable Areas Statistics',
    style: {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '0 0 4px 0',
    padding: '0'
    }
    });
    Map.addLayer(basicImage.clip(ermera), visParams, 'Ermera areas');
    Map.addLayer(suitableMask.selfMask().clip(ermera), suitableVisParams, 'Suitable areas for coffee planting');
    
    
    function resetMap() {
      // Clear the drawing tool and all map layers
      Map.drawingTools().clear();
      Map.layers().reset();
  
      // Clear the console and re-add buttons and labels
      console.clear()
      console.add(title)
      console.add(subtitle2)
      console.add(draw);
      console.add(clear);
      console.add(home_button)
  
      // Re-add the basic vegetation and moisture mask layers
      Map.addLayer(basicImage.clip(ermera), visParams, 'Ermera areas');
  
      // Re-add layers that fit the planting area
      Map.addLayer(suitableMask.selfMask().clip(ermera), suitableVisParams, 'Suitable areas for coffee planting');
    }
    
    
    
    // Draw AOI
    var draw = ui.Button({
      label: 'Draw AOI',
      style:{stretch: 'horizontal'},
      onClick: function() {

        Map.drawingTools().clear();
        Map.drawingTools().setLinked(false);
        Map.drawingTools().setShape('rectangle');
        Map.drawingTools().draw();

        Map.drawingTools().onDraw(function(event) {
          calculateAndDisplayArea();  // Calculate area
        });
    
      }
    })
    
    // Calculate area
    function calculateAndDisplayArea() {
      var AOI = Map.drawingTools().layers().get(0).toGeometry();
      var suitable2 = suitableImage.select('B2').gt(0).multiply(ee.Image.pixelArea()).divide(10000);
      var result = suitable2.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: AOI,
        scale: 10, // Use an appropriate scale
        maxPixels: 1e12 // Maximum number of pixels
      });
      var totalResult = ee.Number(result.get('B2')).round();
      
      // Create a label
        var header = ui.Label({
            value: "Available area for planting coffee (square hectares):",
            style: {fontWeight: 'bold', margin: '10px 5px'}
        }); 
      console.add(header);  
      var area_sumLabel = ui.Label({
          value: 'Calculating...',
          style:{padding:'0px 50px'}
        })
        
      totalResult.evaluate(function(val){
        area_sumLabel.setValue(val)
        
      });        
    
      var results=ui.Panel({
            widgets: [area_sumLabel],
            layout: ui.Panel.Layout.Flow('horizontal')
          })
          
      console.add(results)
      
    }
    
    
    var clear = ui.Button({
    label: 'Clear',
    style:{stretch: 'horizontal'},
    onClick: function() {
        resetMap();
    }
    });
    
    console.clear()
    console.add(title)
    console.add(subtitle2)
    console.add(ui.Label('Draw the AOI to calculate the total area of land within that range that is suitable for planting coffee.', {whiteSpace: 'wrap'}))
    console.add(draw)
    console.add(clear)
    console.add(home_button)
  }
});
/////////////////////// "District Statistics" button config.///////////////////////

////////////////////////// "How it works" button config.//////////////////////
var how_works = ui.Button({
  style:{stretch: 'horizontal'},
  label: 'View Classification Distribution',
  onClick: 
  function ward_stats_panel() {
    
    Map.setOptions("Satellite")
    var subtitle3 = ui.Label({
      value: '- View Classification Distribution',
      style: {
      fontWeight: 'bold',
      fontSize: '14px',
      margin: '0 0 4px 0',
      padding: '0'
      }
    });
    
    var layer_intro_basic = ui.Label('This layer combines the Normalized Difference Vegetation Index and Normalized Difference Water Index to filter Sentinel-2 data to identify areas that had both vegetation cover and were not water bodies.', {whiteSpace: 'wrap'})
    
    // define checkbox
    var checkbox_basic = ui.Checkbox({
      label: 'Ermera areas',
      style: {
      fontWeight: 'bold',
      fontSize: '14px'
      },
      onChange: function(checked) {
        if (checked) {
          Map.addLayer(basicImage.clip(ermera), visParams, 'Ermera areas');
        } else {
          var layers = Map.layers();
          for (var i = 0; i < layers.length(); i++) {
            var layer = layers.get(i);
            if (layer.getName() === 'Ermera areas') {
              Map.remove(layer);
            }
          }
        }
      }
    }); 
    
    var layer_intro_suitable = ui.Label('This layer combines elevation, temperature, slope and Normalized Difference Moisture Index to further filter the "Ermera areas" layer and retain a healthy vegetated area.', {whiteSpace: 'wrap'})
    // Create a Area layer in Suitabour, click on the box
    // Select a single band that represents the appropriate area
    var singleBandSuitableImage = suitableImage.select('B2'); 

    // Define a checkbox
    var checkbox_suit = ui.Checkbox({
      label: 'Suitable coffee planting areas',
      style: {
      fontWeight: 'bold',
      fontSize: '14px'
      },
      onChange: function(checked) {
        // If the tick box is ticked
        if (checked) {
          // Add a single-band layer to the map
          Map.addLayer(singleBandSuitableImage.clip(ermera), suitableVisParams, 'Suitable coffee planting areas');
        } else {
          // If unchecked, remove the layer from the map
          var layers = Map.layers();
          for (var i = 0; i < layers.length(); i++) {
            var layer = layers.get(i);
            if (layer.getName() === 'Suitable coffee planting areas') {
              Map.remove(layer);
            }
          }
        }
      }
    });
    
    var layer_intro_coffee = ui.Label('This layer shows the distribution of existing coffee planting areas in Ermera identified by the random forest classifier.', {whiteSpace: 'wrap'})
    // Create Krasifeld Cofia Area layer click box
    // Define a checkbox
    var checkbox_coffee = ui.Checkbox({
      label: 'Classified existing coffee planting areas',
      style: {
      fontWeight: 'bold',
      fontSize: '14px'
      },
      onChange: function(checked) {
        // If the tick box is ticked
        if (checked) {
          // Add a single-band layer to the map
          Map.addLayer(coffeePrediction.clip(ermera), coffeeVisParams, 'Classified existing coffee planting areas');
        } else {
          // If unchecked, remove the layer from the map
          var layers = Map.layers();
          for (var i = 0; i < layers.length(); i++) {
            var layer = layers.get(i);
            if (layer.getName() === 'Classified existing coffee planting areas') {
              Map.remove(layer);
            }
          }
        }
      }
    });
    
    
    var layer_intro_forest = ui.Label('This layer shows the distribution of forest in Ermera identified by the random forest classifier.', {whiteSpace: 'wrap'})
    // Define a checkbox
    var checkbox_forest = ui.Checkbox({
      label: 'Classified forest areas',
      style: {
      fontWeight: 'bold',
      fontSize: '14px'
      },
      onChange: function(checked) {
        // If the tick box is ticked
        if (checked) {
          // Add a single-band layer to the map
          Map.addLayer(forestPrediction.clip(ermera), {palette:'pink'}, 'Classified forest areas');
        } else {
          // If unchecked, remove the layer from the map
          var layers = Map.layers();
          for (var i = 0; i < layers.length(); i++) {
            var layer = layers.get(i);
            if (layer.getName() === 'Classified forest areas') {
              Map.remove(layer);
            }
          }
        }
      }
    });

  var layer_intro_urban = ui.Label('This layer shows the distribution of urban in Ermera identified by the random forest classifier.', {whiteSpace: 'wrap'})
    // Define a checkbox
    var checkbox_urban = ui.Checkbox({
      label: 'Classified urban areas',
      style: {
      fontWeight: 'bold',
      fontSize: '14px'
      },
      onChange: function(checked) {
        // If the tick box is ticked
        if (checked) {
          // Add a single-band layer to the map
          Map.addLayer(urbanPrediction.clip(ermera), {palette:'purple'}, 'Classified urban areas');
        } else {
          // If unchecked, remove the layer from the map
          var layers = Map.layers();
          for (var i = 0; i < layers.length(); i++) {
            var layer = layers.get(i);
            if (layer.getName() === 'Classified urban areas') {
              Map.remove(layer);
            }
          }
        }
      }
    });
    
  
    console.clear()
    console.add(title)
    console.add(subtitle3)
    console.add(ui.Label('The following checkable layers show the distribution of the different land uses of Ermera in 2022.', {whiteSpace: 'wrap'}))
    
    console.add(checkbox_basic)
    console.add(layer_intro_basic)
    
    console.add(checkbox_suit)
    console.add(layer_intro_suitable)
    
    console.add(checkbox_coffee)
    console.add(layer_intro_coffee)
    
    console.add(checkbox_forest)
    console.add(layer_intro_forest)
    
    console.add(checkbox_urban)
    console.add(layer_intro_urban)

    console.add(home_button)
  }
});
