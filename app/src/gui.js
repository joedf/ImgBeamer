/* globals
dat, Utils
G_UpdateFilters
G_UpdateRuler
G_UpdateStageSettings
G_Update_GroundTruth
G_UpdateResampled
G_update_ImgMetrics
G_Update_InfoDisplays
G_UpdateVirtualSEMConfig

ResampleFullImage

G_APP_NAME
G_DEBUG
G_STAGES
G_INPUT_IMAGE
G_VSEM_PAUSED
G_VSEM_IMAGE_CACHE
G_IMG_METRICS
G_IMG_METRIC_ENABLED
G_PRELOADED_IMAGES
G_PRELOADED_IMAGES_ROOT
G_SHOW_SUBREGION_OVERLAY
*/

/* exported
G_GUI_Controller
G_Export_img_count
*/

/* allow global reassign and magic number as this where
we configure most if not all default values. */

/* eslint-disable no-magic-numbers, no-global-assign */

// hide the old UI for now...
if (G_DEBUG) {
	$('#options-full-resample-anchor').show();
}

// handler for generate full image, currently only used by old UI
$('#generateFull').click(function(){
	$('#loadspinner_full').show();
	
	setTimeout(function(){
		ResampleFullImage();
		$('#loadspinner_full').hide();
	}, 250);
});

// Setup the main UI and settings/options GUI controller
const G_INPUT_IMG_CTRL_SELECTOR = '#_fileImgInput';
const gui = new dat.GUI({autoPlace: false});

/**
 * The main GUI controller
 */
const G_GUI_Controller = new function() {
	this.pixelCountX = 8;
	this.pixelCountY = 8;
	this.brightness = 0;
	this.contrast = 0;
	this.digitalMag = "1.00x";
	this.advancedMode = false;
	this.updateViews = function(){
		G_UpdateVirtualSEMConfig();
		G_UpdateResampled();
		G_Update_GroundTruth();
		G_Update_InfoDisplays();
	};
	this.updateFilters = function(){ G_UpdateFilters(); },
	this.globalBC = true;
	this.resetBC = function(){
		let cGui = G_GUI_Controller.controls;
		cGui.brightness.setValue(0);
		cGui.contrast.setValue(0);
		G_UpdateFilters();
	},
	this.groundTruthImg = 'grains2tl.png';
	this.pause_vSEM = G_VSEM_PAUSED;
	this.imageSmoothing = true;
	this.doImageMetric = G_IMG_METRIC_ENABLED;
	this.subregionOverlay = G_SHOW_SUBREGION_OVERLAY;
	this.imageMetricAlgo = 'iNRMSE';
	this.exportResultImg = function(){ exportResultImage(); };
	this.exportResultTrueImage = function(){ exportResultTrueImage(); };
	this.importImage = function(){
		// getInputImage();
		$(G_INPUT_IMG_CTRL_SELECTOR).click();
	};
	this.aboutMessage = function(){ Utils.ShowAboutMessage(); };
	this.pixelSize_nm = 500; // nm/px default;
	this.previewOpacity = 0.4;
	this.showRuler = false;
	this.controls = {};
};

// setup the submenus or "folders"
var gui_ip = gui.addFolder('Imaging Parameters');
gui_ip.add(G_GUI_Controller, 'pixelCountX', 1, 64, 1).onChange(G_GUI_Controller.updateViews);
gui_ip.add(G_GUI_Controller, 'pixelCountY', 1, 64, 1).onChange(G_GUI_Controller.updateViews);
G_GUI_Controller.controls.brightness = gui_ip
	.add(G_GUI_Controller, 'brightness', -1, 1, 0.01)
	.onChange(G_GUI_Controller.updateFilters);
G_GUI_Controller.controls.contrast = gui_ip
	.add(G_GUI_Controller, 'contrast', -100, 100, 0.1)
	.onChange(G_GUI_Controller.updateFilters);
gui_ip.add(G_GUI_Controller, 'globalBC')
	.name('Global B/C')
	.onChange(G_GUI_Controller.updateFilters);
gui_ip.add(G_GUI_Controller, 'resetBC').name('Reset Brightness / Contrast');
gui_ip.add(G_GUI_Controller, 'digitalMag').listen();
G_GUI_Controller.controls.pixelSize_nm = gui_ip
.add(G_GUI_Controller, 'pixelSize_nm', 1, 1000, 1).onChange(function(){
	G_GUI_Controller.updateViews();
	G_UpdateRuler();
});
gui_ip.add(G_GUI_Controller, 'showRuler').onChange(function(){
	G_UpdateRuler();
});
gui_ip.open();

var gui_do = gui.addFolder('Display Options');
gui_do.add(G_GUI_Controller, 'advancedMode').onChange(function(){
	Utils.updateAdvancedMode();
});
gui_do.add(G_GUI_Controller, 'pause_vSEM').onChange(function(){
	G_VSEM_PAUSED = G_GUI_Controller.pause_vSEM;
});
gui_do.add(G_GUI_Controller, 'imageSmoothing').onChange(function(){
	G_UpdateStageSettings();
});
gui_do.add(G_GUI_Controller, 'subregionOverlay').onChange(function(){
	G_SHOW_SUBREGION_OVERLAY = G_GUI_Controller.subregionOverlay;
	G_GUI_Controller.updateViews();
});
gui_do.add(G_GUI_Controller, 'previewOpacity', 0, 1, 0.01).onChange(function(){
	G_UpdateResampled();
});
gui_do.add(G_GUI_Controller, 'doImageMetric').onChange(function(){
	G_IMG_METRIC_ENABLED = G_GUI_Controller.doImageMetric;
	G_update_ImgMetrics();
});
gui_do.add(G_GUI_Controller, 'imageMetricAlgo', G_IMG_METRICS);

var gui_io = gui.addFolder('Input / Export Image');
gui_io.add(G_GUI_Controller, 'groundTruthImg', G_PRELOADED_IMAGES).listen().onChange(function(){
	var fname = Utils.getGroundtruthImage();
	if (fname.length > 0) {
		G_INPUT_IMAGE = G_PRELOADED_IMAGES_ROOT + fname;
		console.log("Ground Truth Image changed to: "+G_INPUT_IMAGE);
		$(document.body).trigger('OnGroundtruthImageChange');
	}
});
gui_io.add(G_GUI_Controller, 'importImage');
gui_io.add(G_GUI_Controller, 'exportResultImg');
gui_io.add(G_GUI_Controller, 'exportResultTrueImage').name('exportResultImg (actual size)');
var aboutBtn = gui.add(G_GUI_Controller, 'aboutMessage');
aboutBtn.name("About " + G_APP_NAME + " / Credits");
gui_io.open();


// sets up the archoring position for the options UI and makes it draggable
$("#options").append(gui.domElement)
	.position({at:'right bottom', my:'right bottom', of: '#options-anchor'})
	.draggable({handle: '#options-handle'});


// used to auto-name the export files with a counter
var G_Export_img_count = 0;
function exportResultImage(){
	// Export image (as displayed) as file download
	// https://konvajs.org/docs/data_and_serialization/High-Quality-Export.html

	// get the image without the row/draw indicator
	var stageFinal = G_STAGES[G_STAGES.length - 1];
	var finalImage = Utils.getVirtualSEM_KonvaImage(stageFinal);

	// export the image
	var url = finalImage.toDataURL({pixelRatio:1});
	var filename = Utils.GetSuggestedFileName("result_image",++G_Export_img_count);
	Utils.downloadURI(url, filename);
}

function exportResultTrueImage(){
	// Export the actual as generated image as file download
	// this image may be smaller or larger than what is displayed on screen

	// export the image
	var filename = Utils.GetSuggestedFileName("result_image",++G_Export_img_count);

	Utils.ImageDataArrayToBlob(
		G_VSEM_IMAGE_CACHE.data, // raw pixel data cache
		G_VSEM_IMAGE_CACHE.width, // image width (px), height is auto calculated
		function(blob) { // callback for when the blob is ready
			const url = URL.createObjectURL(blob);
			Utils.downloadURI(url, filename);
		}
	);
}


// handles the browse for input image-changed event
$(G_INPUT_IMG_CTRL_SELECTOR).change(function(){
	// https://stackoverflow.com/a/34840295/883015
	var file    = this.files[0];
	var reader  = new FileReader();

	reader.onloadend = function () {
		console.log("Ground Truth Image changed to: "+file.name);

		// clear selection in the combobox for included images
		G_GUI_Controller.groundTruthImg = '';

		G_INPUT_IMAGE = reader.result; // returns a data base64 url
		// G_INPUT_IMAGE = URL.createObjectURL(file); // makes a blob:// url
		$(document.body).trigger('OnGroundtruthImageChange');
	};

	if (file) {
		reader.readAsDataURL(file);
	} else {
		console.log('Imported image selection cleared.');
		// preview.src = "";
	}
});
