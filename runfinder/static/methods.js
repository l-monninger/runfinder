//Globals and constants
let $PY_ROOT = $('#pyapp').attr('data-app-directory');
let $output_path = null; //this won't necessarily be constant
let user_location = null;

//Progress bar function
function progress(){
    current_text = $('#dots').text();
    if(current_text == "..."){
        $('#dots').text(".");
    } else if (current_text == ".."){
        $('#dots').text("...");
    } else if(current_text == "."){
        $('#dots').text("..");
    }
}


////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//utility functions and classes
function Coord(){
    this.lat = null;
    this.lng = null;
    
    this.set = function(lat, lng){
        this.lat = lat;
        this.lng = lng;
        this.lnglat = [lng, lat]
    }
    
    this.print = function(){
        console.log(this.lat + ", " + this.lng);
    }
    
    this.inBounds = function(bounds){
        if((this.lng >= bounds.southwest.lng && this.lng <= bounds.southeast.lng) && (this.lat >= bounds.southwest.lat && this.lat <= bounds.northwest.lat)){
            return true;
        } else return false;
    }
}

function RecBounds(){
    
    this.northeast = new Coord();
    this.southwest = new Coord();
    this.northwest = new Coord();
    this.southeast = new Coord();
    this.tuple_bounds = null;
    this.bounds = null;
    
    this.set = function(northeast, southwest){
        this.northeast.set(northeast.lat, northeast.lng);
        this.southwest.set(southwest.lat, southwest.lng);
        this.northwest.set(northeast.lat, southwest.lng);
        this.southeast.set(southwest.lat, northeast.lng);
        this.tuple_bounds = [this.northwest, this.northeast, this.southwest, this.northeast];
        this.bounds = [this.southwest.lng, this.southwest.lat, this.northeast.lng, this.northwest.lat]
        
        return this.bounds;
    }
    
    this.print = function(){
        console.log(this.bounds);
        return this.bounds;
    }
    
}

function UserSettings(){
    this.k = null;
    this.R = null;
    this.MAX_ELEV_DROP_REDUCER = null;
    this.MAX_SLOPE = null;
    this.SLOPE_LIKE = null;
    this.FLOWY = null;
    this.WINDY = null;
    this.TYPE_WEIGHT = null;
    this.STEEPNESS_WEIGHT = null;
    
    this.get = function(){
        // get k
        // k is going to be 1 - 10 ^ -x; the faster the user wants to get down the mountain, the lesser k should be
        // since the user will be inputting values which are, in fact, larger when they want to get down the mountain faster, we have to flip this
        // we will limit the user to 1 - 10 ^ -10
        // the more
        K_POWER_LIM = 10;
        user_input_k = $('#global_downhill').val();
        HTML_K_MAX = $('#global_downhill').attr('max');
        k_power = -(K_POWER_LIM - ((user_input_k/HTML_K_MAX) * K_POWER_LIM));
        this.k = 1.0 - Math.pow(10, k_power);
        
        // get R
        // we want R to be greater than .9, but less than ~1.3
        R_MIN = .9;
        R_RANGE = .4
        user_input_R = $('#local_downhill').val();
        HTML_R_MAX = $('#local_downhill').attr('max');
        r_add = (user_input_R/HTML_R_MAX) * R_RANGE;
        this.R = R_MIN + r_add;
        
        //get MAX_ELEV_DROP_REDUCER
        // we want this to be 1 to 100
        EMR_MIN = 1;
        EMR_RANGE = 99;
        user_input_emr = $('#downhill_reducer').val();
        HTML_EMR_MAX = $('#downhill_reducer').attr('max');
        emr_add = (user_input_emr/HTML_EMR_MAX) * EMR_RANGE;
        this.MAX_ELEV_DROP_REDUCER = EMR_MIN + emr_add;
        
        // get MAX_SLOPE
        // we want this to be 0 to 90
        SLOPE_MAX = 90;
        user_input_max_slope = $('#max_slope').val();
        HTML_SLOPE_MAX = $('#max_slope').attr('max');
        this.MAX_SLOPE = (user_input_max_slope/HTML_SLOPE_MAX) * SLOPE_MAX;
        
        // get MAX_SLOPE
        // we want this to be 1 to 90
        SLOPE_LIKE_MIN = 1;
        SLOPE_LIKE_RANGE = 89;
        user_input_slope_like = $('#slope_like').val();
        HTML_SLOPE_LIKE_MAX = $('#slope_like').attr('max');
        this.SLOPE_LIKE = SLOPE_LIKE_MIN + (user_input_slope_like/HTML_SLOPE_LIKE_MAX) * SLOPE_LIKE_RANGE;
        
        
        //Confusing use of zeros and ones for display purposes; 0 on the range display is 1 in boolean terms, so I'll be converting below
        //get Flowy
        // flowy is on; gnarly is off
        FLOWY_VALUE = $('#flowy').val();
        this.FLOWY = !Boolean(Number(FLOWY_VALUE));
        
        // get WINDY
        // windy is on; direct is off
        WINDY_VALUE = $('#windy').val();
        this.WINDY = !Boolean(Number(WINDY_VALUE));
        
        // get TYPE_WEIGHT
        // this should be between 0 and 100
        user_input_tw = $('#type_weight').val();
        HTML_TW_MAX = $('#type_weight').attr('max');
        this.TYPE_WEIGHT = user_input_tw/HTML_TW_MAX;
        
        // get STEEPNESS_WEIGHT
        // this should be 0 to 100
        SW_MAX = 100;
        user_input_sw = $('#steepness_weight').val();
        HTML_SW_MAX = $('#steepness_weight').attr('max');
        this.STEEPNESS_WEIGHT = (user_input_sw/HTML_SW_MAX) * SW_MAX
    }
}

//////////////////////////////////////////////////////////////////////////
//Core function: getRun()



function getRun(event){
    $('#progress').html("<span id='#request_status'>Working on your request</span><span id='dots'>...</span>");
    $('#progress p').css('color', '#778899');
    $('#progress').css('display', 'block');
    $('#map').css('display', 'none');
    $('#request_submit').css('display', 'none');
    $('.setting').css('display', 'none');
    progress_bar = setInterval(function(){
        progress();
    }, 400);
    event.data.user_settings.get();
    $.ajax({
            type : "POST",
            url : $PY_ROOT + '/runfinder',
            data: JSON.stringify({
                bounds: event.data.bounds,
                marker: event.data.marker,
                user_settings: event.data.user_settings
            }),
            dataType: "json",
            contentType: 'application/json;charset=UTF-8',
            success: function(data) {
                
                clearInterval(progress_bar);
                output_items.eachLayer(function(old_layer){
                    output_items.removeLayer(old_layer);
                })
                
                //load up success page
                $('#progress').css('display', 'none');
                $('#map').css('display', 'block');
                $('.setting').css('display', 'block')
                $('#download').css('display', 'block');
                $('#reset').css('display', 'block');
                
                // locate the resources and update resource_path element
                $output_path = data;
                $("#resource_path").attr('href', '/return-files?temp=' + $output_path.split('/')[2]);
                
                $.get($output_path + '/display_run.wkt', function(data){
                    output_items.addLayer(omnivore.wkt.parse(data));
                    map.fitBounds(output_items.getBounds());
                })
                
            },
            error: function(data) {
                clearInterval(progress_bar)
                $('#request_status').text("An error occurred while computing your run. Please reset or referesh the page.");
                $('#progress p').css('color', 'red');
                $('#reset').css('display', 'block');
            }
        });
}


//////////////////////////////////////////////////////////////////////////////////////////
//initializations
let drawn_marker = new Coord();
let drawn_bounds = new RecBounds();
let selected_user_settings = new UserSettings();

//leaflet map initialization
let map = L.map('map').setView([41.409420, -122.194882], 12);//leaflet onload specifided by L.; this is the top of Mt. Shasta

// Keeping the mapBox tile code here for legacy
/*L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.satellite',
    accessToken: 'pk.eyJ1IjoibG1vbm5pbmdlciIsImEiOiJjanYxZGJsN2MwMTByNDVsNTRyMGV5YXVqIn0.zDgOXVJpTQhvdzfFcGFAQQ'
}).addTo(map);*/

L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3'],
    attribution: 'Map data and imagery courtesy of &copy; <a href="https://developers.google.com/maps/documentation/">Google Maps</a>'
}).addTo(map);

let drawn_items = new L.FeatureGroup();
map.addLayer(drawn_items);

let output_items = new L.FeatureGroup();
map.addLayer(output_items);


//draw options
let draw_options = {
    position: 'topright',
    draw: {
        rectangle: {
            allowIntersection: false,
            shapeOptions: {
                color: '#97009c'
            }
        },
        polygon: false,
        circle: false,
        polyline: false,
        circlemarker: false
    },
    edit: {
        featureGroup: drawn_items,
        remove: false
    }
}
let draw_control = new L.Control.Draw(draw_options);
map.addControl(draw_control);

//search options
let search_options = {
		url: 'https://nominatim.openstreetmap.org/search?format=json&q={s}',
		jsonpParam: 'json_callback',
		propertyName: 'display_name',
		propertyLoc: ['lat','lon'],
		marker: L.circleMarker([0,0],{radius:30}),
		autoCollapse: true,
		autoType: false,
		minLength: 2
	}
let search_control = new L.Control.Search(search_options);
map.addControl(search_control);

//whenever a drawing is created, check if it meets the requirements and act accordingly
map.on('draw:created', function(e) {
    $('#progess').css('display', 'none');
    $('#download').css('display', 'none');
    $('#reset').css('display', 'none');
    $('#map').css('display', 'block');
    $('#request_submit').css('background-color', '#ff6961');
    $('#request_submit').attr('value', "Invalid Marker or Bounds");
    $('#request_submit').attr('value', "Invalid Marker or Bounds");
    $('#request_submit').css('display', 'block');
    
    let type = e.layerType,
    layer = e.layer;
    
    // clear out old output
    output_items.eachLayer(function(old_layer){
        output_items.removeLayer(old_layer);
    })

    if(type == 'marker')  {
        //remove old marker
        map.eachLayer(function(old_layer){
          if(old_layer instanceof L.Marker){
              map.removeLayer(old_layer);
          }
        })
        drawn_marker.set(layer.getLatLng().lat, layer.getLatLng().lng);
    } else if (type == 'rectangle'){ //remove old selection box
        //remove old selection box
        map.eachLayer(function(old_layer){
          if(old_layer instanceof L.Rectangle){
              map.removeLayer(old_layer);
          }
        })
        drawn_bounds.set(layer.getBounds()._northEast, layer.getBounds()._southWest);
    }
    
    drawn_items.addLayer(layer);
    
    if(drawn_marker.inBounds(drawn_bounds)){
        $('#request_submit').css('background-color', '#778899');
        $('#request_submit').attr('value', "Submit");
        $('#request_submit').on('click', {bounds : drawn_bounds.bounds, marker: drawn_marker.lnglat, user_settings: selected_user_settings}, getRun)
    } else{
        $('#request_submit').css('background-color', '#ff6961');
        $('#request_submit').attr('value', "Invalid Marker or Bounds");
        $('#request_submit').off('click', getRun)
    }

});

////////////////////////////////////////////////////////////////////////////////////
// Style scripting

/*
This function changes the color of the slidebar based on the selected range
*/
$("input[type=range]").on('input', function(){
    value = $(this).val();
    max = $(this).attr('max');
    value = (value/max) * 255;
    red = 255;
    green = 255;
    blue = 30;
    if(value >= 128){
        green = green - ((value - 128)*2); // green should be decreased by however much the value is over 128
    } else if (value <= 127){
        red = red - ((127 - value )*2); // red should be decreaeed by however much the value is under 127
    }
    red = parseInt(red).toString();
    green = parseInt(green).toString();
    blue = blue.toString()
    $(this).css('background', 'rgb(' + red + ', ' + green + ', ' + blue + ')' );
}); //set function to run whenver the input is changed


////////////////////////////////////////////////////////////////////////////////
//Page reset
/*
This function resets the page.
*/
function reset(){
    $('#progress').css('display', 'none');
    $('#download').css('display', 'none');
    $('#reset').css('display', 'none');
    $('#map').css('display', 'block');
    $('#request_submit').css('background-color', '#ff6961');
    $('#request_submit').attr('value', "Invalid Marker or Bounds");
    $('#request_submit').css('display', 'block');
    map.eachLayer(function(old_layer){
        if(old_layer instanceof L.Marker || old_layer instanceof L.Rectangle || old_layer instanceof L.Polyline){// remove any selection boxes, markers or generated output
          map.removeLayer(old_layer);
        }
    })
}