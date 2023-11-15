/* globals
 * Utils,
 * G_BOX_SIZE, G_DEBUG, G_AUTO_PREVIEW_LIMIT,
 * G_VSEM_PAUSED, G_MATH_TOFIXED,
 * G_SHOW_SUBREGION_OVERLAY,
 * G_update_ImgMetrics
 */

/* exported
 * drawSpotProfileEdit, drawSubregionImage, drawSpotContent, drawSpotSignal,
 * drawProbeLayout, drawProbeLayoutSampling, drawResampled, drawGroundtruthImage,
 * drawVirtualSEM
 */

// used by "Resulting Image" box / drawVirtualSEM()
// to reduce artifacts from drawing pixel-by-pixel in canvas
var G_DRAW_WITH_OVERLAP = true;

// overlap amount in pixels to all edges (top, left, right, bottom)
var G_DRAW_OVERLAP_PIXELS = 1;

// Optionally draw with overlap when above a certain pixel (cell) count
// set to 0 to essentially ignore this threshold value...
// eslint-disable-next-line no-magic-numbers
var G_DRAW_OVERLAP_THRESHOLD = 10 * 10; // rows * cols

// Optionally, to draw normally (w/o overlap) after a number of passes
var G_DRAW_OVERLAP_PASSES = 1;

// The minimum average pixel/signal value for an image to be considered "non-blank"
var G_MIN_AVG_SIGNAL_VALUE = 2;

// the pixel size of the spot used for the subregion render view, updated elsewhere
var G_BEAMRADIUS_SUBREGION_PX = {x:1,y:1};


const KEYCODE_R = 82;
const KEYCODE_ESC = 27;

const G_ZOOM_FACTOR_PER_TICK = 1.2;

var G_VirtualSEM_animationFrameRequestId = null;
var G_SubResampled_animationFrameRequestId = null;

/**
 * Draws an node-editable ellipse shape on the given drawing stage.
 * @param {*} stage the stage to draw on.
 * @param {Function} updateCallback optional callback when a change occurs in spotSize
 * @returns the spot/beam (Ellipse) object
 */
function drawSpotProfileEdit(stage, updateCallback = null) {
	var layer = stage.getLayers()[0];
	layer.destroyChildren(); // avoid memory leaks

	// default beam shape values
	var defaultRadius = {
		x: 70,
		y: 70
	};

	// create our shape
	var beam = new Konva.Ellipse({
		x: stage.width() / 2,
		y: stage.height() / 2,
		radius: defaultRadius,
		fill: 'white',
		strokeWidth: 0,
	});

	layer.add(beam);
	layer.draw();

	// make it editable
	var tr = new Konva.Transformer({
		nodes: [beam],
		centeredScaling: true,

		// style the transformer:
		// https://konvajs.org/docs/select_and_transform/Transformer_Styling.html
		anchorSize: 11,
		anchorCornerRadius: 3,
		borderDash: [3, 3],

		// eslint-disable-next-line no-magic-numbers
		rotationSnaps: [0, 45, 90, 135, 180],

		// resize limits
		// https://konvajs.org/docs/select_and_transform/Resize_Limits.html
		boundBoxFunc: function (oldBoundBox, newBoundBox) {
			// if the new bounding box is too large or small
			// small than the stage size, but more than 1 px.
			// then, we return the old bounding box
			if ( newBoundBox.width > stage.width() || newBoundBox.width < 1
			|| newBoundBox.height > stage.height() || newBoundBox.height < 1) {
				return oldBoundBox;
			}
			return newBoundBox;
		}
	});
	layer.listening(true);
	layer.add(tr);

	// make it (de)selectable
	// based on https://konvajs.org/docs/select_and_transform/Basic_demo.html
	stage.off('click tap'); // prevent "eventHandler doubling" from subsequent calls
	stage.on('click tap', function (e) {
		// if click on empty area - remove all selections
		if (e.target === stage) {
			tr.nodes([]);
			return;
		}

		const isSelected = tr.nodes().indexOf(e.target) >= 0;
		if (!isSelected) {
			// was not already selected, so now we add it to the transformer
			// select just the one
			tr.nodes([e.target]);
		}
	});

	// keyboard events
	// based on https://konvajs.org/docs/events/Keyboard_Events.html
	var container = stage.container();
	// make it focusable
	container.tabIndex = 2;
	container.addEventListener('keydown', function(e) {
		// don't handle meta-key'd events for now...
		const metaPressed = e.shiftKey || e.ctrlKey || e.metaKey;
		if (metaPressed)
			return;

		switch (e.keyCode) {
			case KEYCODE_R: // 'r' key, reset beam shape
				beam.rotation(0);
				beam.scale({x:1, y:1});
				// update other beams based on this one
				// https://konvajs.org/docs/events/Fire_Events.html
				beam.fire('transform');
				break;
			
			case KEYCODE_ESC: // 'esc' key, deselect all
				tr.nodes([]);
				break;
		
			default: break;
		}
		e.preventDefault();
	});

	// Replacing userScaledImage / userImage
	// invisible shape to get scale X/Y as a control for spot size/mag
	// by mouse scroll or values being set on a konva object to call .ScaleX/Y()
	var rectW = stage.width(); 
	var magRect = new Konva.Rect({
		width: rectW,
		height: rectW,
		// fill: 'red',
		fillEnabled: false,
		// strokeWidth: 0,
		strokeWidth: 1,
		stroke: 'lime',
		// strokeEnabled: false,
		strokeScaleEnabled: false,
		listening: false,
		visible: false,
		perfectDrawEnabled: false,
	});

	// "pre-zoom" a bit, and start with center position
	// zoom/scale so that the spot size starts at 100%
	var _tempCellWidth = magRect.width() / Utils.getColsInput();
	var initialSpotScale = beam.width() / _tempCellWidth;
	Utils.scaleOnCenter(stage, magRect, 1, initialSpotScale);
	
	// optional event callback
	var doUpdate = function(){
		if (typeof updateCallback == 'function')
			return updateCallback();
	};

	stage.off('wheel').on('wheel', function(e){
		e.evt.preventDefault(); // stop default scrolling
			
		var scaleBy = G_ZOOM_FACTOR_PER_TICK;
		
		// Do half rate scaling, if shift is pressed
		if (e.evt.shiftKey) {
			scaleBy = 1 +((scaleBy-1) / 2);
		}

		// how to scale? Zoom in? Or zoom out?
		let direction = e.evt.deltaY > 0 ? -1 : 1;

		var oldScale = magRect.scaleX();
		var newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

		// limit the max zoom from scrolling, to prevent blank pixel data
		// because of too small of a spot size...
		const tolerance = -0.1;
		if (G_BEAMRADIUS_SUBREGION_PX.x + tolerance < 1
		|| G_BEAMRADIUS_SUBREGION_PX.y + tolerance < 1) {
			newScale = Math.min(oldScale, newScale);
		}
		
		Utils.centeredScale(magRect, newScale);

		doUpdate();
	});

	layer.add(magRect);

	return {beam: beam, spotSize: magRect};
}

/**
 * Draws the subregion image display.
 * @param {*} stage The stage to draw it on.
 * @param {*} oImg The ground truth image.
 * @param {Number} size (to be removed) The max size (width or height) of the image to draw.
 * @param {Boolean} doFill (to be removed?) Fill or letterbox mode to fit the image.
 * @param {Function} updateCallback 
 * @returns a reference to the subregion image object that can be panned and zoomed by the user.
 * 
 * @todo remove 'size' ... confusing and not useful.
 * @todo likely remove 'doFill' ... maybe confusing and not useful.
 */
function drawSubregionImage(stage, oImg, size, doFill = false, updateCallback = null) {
	var max = size;

	if (G_DEBUG)
		console.log("img natural size:", oImg.naturalWidth, oImg.naturalHeight);
	
	var img_width = oImg.naturalWidth, img_height = oImg.naturalHeight;

	// image ratio to "fit" in canvas
	var fitSize = Utils.fitImageProportions(img_width, img_height, max, doFill);

	// TODO: this shouldnt be need or it at least duplicate with part of drawGroundtruthImage()
	var kImage = new Konva.Image({
		x: (max - fitSize.w)/2,
		y: (max - fitSize.h)/2,
		image: oImg,
		width: fitSize.w, 
		height: fitSize.h,
		draggable: true,
	});

	var layer = stage.getLayers()[0];
	layer.destroyChildren(); // avoid memory leaks

	var constrainBounds = function(){
		var scaleX = kImage.scaleX(), scaleY = kImage.scaleY();
		var x = kImage.x(), y = kImage.y();
		var w = kImage.width() * scaleX, h = kImage.height() * scaleY;

		var sx = stage.x(), sw = stage.width();
		var sy = stage.y(), sh = stage.height();
		
		if (x > sx) { kImage.x(sx); }
		if (x < (sx - w + sw) ) { kImage.x(sx - w + sw); }
		if (y > sy) { kImage.y(sy); }
		if (y < (sy - h + sh) ) { kImage.y(sy - h + sh); }

		stage.draw();
	};

	// optional event callback
	var doUpdate = function(){
		if (typeof updateCallback == 'function')
			return updateCallback();
	};
	
	// Enable drag and interaction events
	layer.listening(true);
	kImage.on('mouseup', function() { doUpdate(); });
	kImage.on('dragmove', function() {
		// set bounds on object, by overriding position here
		constrainBounds();

		doUpdate();
	});
	kImage.on('wheel', Utils.MakeZoomHandler(stage, kImage, function(){
		// bounds check for zooming out
		constrainBounds();

		// callback here, e.g. doUpdate();
		doUpdate();
	}, G_ZOOM_FACTOR_PER_TICK, 1));

	layer.add(kImage);

	stage.draw();
	
	// keyboard events
	// TODO: similar or duplicate from drawSpotProfileEdit() or 
	// "Spot Profile" keyboard event code
	var container = stage.container();
	// make it focusable
	container.tabIndex = 1;
	container.addEventListener('keydown', function(e) {
		// don't handle meta-key'd events for now...
		const metaPressed = e.shiftKey || e.ctrlKey || e.metaKey;
		if (metaPressed)
			return;

		switch (e.keyCode) {
			case KEYCODE_R: // 'r' key, reset scale & position
				kImage.setAttrs({scaleX:1,scaleY:1,x:0,y:0});
				doUpdate();
				break;
		
			default: break;
		}
		e.preventDefault();
	});

	return kImage;
}

/**
 * Draws the spot content on the given drawing stage.
 * The given image is draggable (pan) and zoomable (scroll).
 * @param {*} stage the drawing stage.
 * @param {*} sImage the subregion image (will be cloned for the image object displayed).
 * @param {*} sBeam the beam/spot shape (used by reference).
 * @param {function} updateCallback a function to call when a change occurs such as pan-and-zoom.
 * @returns a reference to the image object being scaled by the user => "userScaledImage".
 */
function drawSpotContent(stage, sImage, sBeam, updateCallback = null) {
	var layer = stage.getLayers()[0];
	layer.destroyChildren();  // avoid memory leaks
	layer.listening(true);

	// Give yellow box border to indicate interactive
	$(stage.getContainer()).css('border-color','yellow');

	var image = sImage.clone();
	image.draggable(true);
	
	image.globalCompositeOperation('source-in');

	layer.add(sBeam);
	layer.add(image);

	// "pre-zoom" a bit, and start with center position
	// zoom/scale so that the spot size starts at 100%
	var _tempCellWidth = sImage.width() / Utils.getColsInput();
	var initialSpotScale = sBeam.width() / _tempCellWidth;
	Utils.scaleOnCenter(stage, image, 1, initialSpotScale);

	layer.draw();

	var doUpdate = function(){
		if (typeof updateCallback == 'function')
			return updateCallback();
	};

	// Events
	image.on('mouseup', function() { doUpdate(); });
	image.on('dragmove', function() { stage.draw(); });
	image.on('wheel', Utils.MakeZoomHandler(stage, image, function(){
		doUpdate();
	}, G_ZOOM_FACTOR_PER_TICK, 0, function(oldScale,newScale){
		// limit the max zoom from scrolling, to prevent blank pixel data
		// because of too small of a spot size...
		const tolerance = -0.1;
		if (G_BEAMRADIUS_SUBREGION_PX.x + tolerance < 1
		|| G_BEAMRADIUS_SUBREGION_PX.y + tolerance < 1) {
			return Math.min(oldScale, newScale);
		}
		return newScale;
	}));

	return image;
}

/**
 * Draws the Spot Signal - previews the averaged signal for a given spot.
 * @param {*} sourceStage the source stage to sample from.
 * @param {*} destStage the stage to draw on.
 * @param {*} sBeam the beam to sample (or "stencil") to with.
 * @returns an update function to call when a redraw is needed.
 */
function drawSpotSignal(sourceStage, destStage, sBeam) {
	var sourceLayer = sourceStage.getLayers()[0];
	var destLayer = destStage.getLayers()[0];

	destLayer.destroyChildren(); // avoid memory leaks

	var beam = sBeam; //.clone();

	var doUpdateAvgSpot = function(){
		var pCtx = sourceLayer.getContext();
		var allPx = pCtx.getImageData(0, 0, pCtx.canvas.width, pCtx.canvas.height);
		// var avgPx = Utils.get_avg_pixel_rgba(allPx);
		var avgPx = Utils.get_avg_pixel_gs(allPx); avgPx = [avgPx,avgPx,avgPx,1];

		var avgSpot = null;
		if (destLayer.getChildren().length <= 0){
			avgSpot = beam;
			destLayer.add(avgSpot);
		} else {
			avgSpot = destLayer.getChildren()[0];
		}

		var avgColor = "rgba("+ avgPx.join(',') +")";
		avgSpot.stroke(avgColor);
		avgSpot.fill(avgColor);

		destStage.getContainer().setAttribute('note', avgColor);

		destLayer.draw();
	};

	// run once immediately
	doUpdateAvgSpot();

	return doUpdateAvgSpot;
}

/**
 * Draws the probe layout.
 * @param {*} drawStage The stage to draw on.
 * @param {*} baseImage The subregion image to draw with (cloned).
 * @param {*} spotScale an object to query for the spot scale X/Y.
 * @param {*} beam the beam/spot shape to draw with (cloned and scaled).
 * @returns an update function to call when a redraw is needed.
 */
function drawProbeLayout(drawStage, baseImage, spotScale, beam) {
	// draws probe layout
	var layers = drawStage.getLayers();
	var baseLayer = layers[0];
	baseLayer.destroyChildren(); // avoid memory leaks

	var baseGridRect = new Konva.Rect(baseImage.getSelfRect());
	
	var imageCopy = baseImage.clone();

	baseLayer.add(imageCopy);
	baseLayer.draw();

	// setup "last" values to help optimize for draw performance
	// no need to redraw the grid lines and spot outlines if the
	// no. rows, columns, spot radii, or rotation didn't change...
	var _last = {
		rows: -1,
		cols: -1,
		radiusX: -1,
		radiusY: -1,
		rotation: 0,
		beamOpacity: Utils.getSpotLayoutOpacityInput(),
	};

	var updateProbeLayout = function(){
		// get the over-layer, create if not already added
		var gridLayer = null;
		var gridDrawn = false;
		if (layers.length < 2) {
			gridLayer = new Konva.Layer();
			drawStage.add(gridLayer);
		} else {
			gridLayer = layers[1];
			gridDrawn = true; // assume we drew it already
		}

		// get probe layer, make a new if not already there
		var probesLayer = null;
		if (layers.length < 3) {
			probesLayer = new Konva.Layer();
			drawStage.add(probesLayer);
		} else {
			probesLayer = layers[2];
		}

		///////////////////////////////
		// Do drawing work ...

		// update image based on user subregion
		imageCopy.x(baseImage.x());
		imageCopy.y(baseImage.y());
		imageCopy.scaleX(baseImage.scaleX());
		imageCopy.scaleY(baseImage.scaleY());

		var tRows = Utils.getRowsInput();
		var tCols = Utils.getColsInput();

		var radiusX = (beam.width() / spotScale.scaleX()) / 2; //(cell.width/2) * .8
		var radiusY = (beam.height() / spotScale.scaleY()) / 2; //(cell.height/2) * .8

		var beamRotation = beam.rotation();

		// preview spot display opacity
		var beamOpacity = Utils.getSpotLayoutOpacityInput();
		
		// only redraw grid lines and spot outlines if they would change
		if (_last.rows != tRows || _last.cols != tCols
		|| _last.radiusX != radiusX || _last.radiusY != radiusY
		|| _last.rotation != beamRotation
		|| _last.beamOpacity != beamOpacity){
			// record for next change detect
			_last.rows = tRows, _last.cols = tCols;
			_last.radiusX = radiusX, _last.radiusY = radiusY,
			_last.rotation = beamRotation;
			_last.beamOpacity = beamOpacity;

			// comment to draw grid only once
			gridDrawn = false; gridLayer.destroyChildren();

			// draw grid, based on rect
			if (!gridDrawn)
			Utils.drawGrid(gridLayer, baseGridRect, tRows, tCols);
			
			// clear the probe layer
			probesLayer.destroyChildren();

			var probe = new Konva.Ellipse({
				radius : {
					x : radiusX, 
					y : radiusY,
				},
				rotation: beamRotation,
				fill: 'rgba(255,0,0,'+beamOpacity+')',
				strokeWidth: 1,
				stroke: 'red'
			});
			
			Utils.repeatDrawOnGrid(probesLayer, baseGridRect, probe, tRows, tCols);
		}
	};

	// run once immediately
	updateProbeLayout();

	return updateProbeLayout;
}

/**
 * Draws the spot layout sampled image content. The image stenciled by the spot shape over a grid.
 * @param {*} drawStage The stage to draw on
 * @param {*} originalImage The image to "stencil" / "clip" or sample.
 * @param {*} spotScale an object to query for the spot scale X/Y.
 * @param {*} sBeam the spot/beam shape to use (cloned and scaled)
 * @returns an update function to call when a redraw is needed.
 */
function drawProbeLayoutSampling(drawStage, originalImage, spotScale, sBeam) {
	var imageCopy = originalImage.clone();
	var beam = sBeam; //.clone();

	var drawLayer = drawStage.getLayers()[0];
	drawLayer.destroyChildren(); // avoid memory leaks

	var baseGridRect = new Konva.Rect(imageCopy.getSelfRect());

	// setup "last" values to help optimize for draw performance
	// similar reason as for drawProbeLayout()
	var _last = {
		rows: -1,
		cols: -1,
		radiusX: -1,
		radiusY: -1,
		rotation: 0,
	};

	var updateProbeLayoutSampling = function(){
		var rows = Utils.getRowsInput();
		var cols = Utils.getColsInput();

		var radiusX = (beam.width() / spotScale.scaleX()) / 2;
		var radiusY = (beam.height() / spotScale.scaleY()) / 2;

		var beamRotation = beam.rotation();

		// only redraw as necessary: if the spots would change...
		if (_last.rows != rows || _last.cols != cols
		|| _last.radiusX != radiusX || _last.radiusY != radiusY
		|| _last.rotation != beamRotation){
			// record for next change detect
			_last.rows = rows, _last.cols = cols;
			_last.radiusX = radiusX, _last.radiusY = radiusY,
			_last.rotation = beamRotation;

			// clear the layer before we draw
			drawLayer.destroyChildren();

			var probe = new Konva.Ellipse({
				radius : {
					x : radiusX,
					y : radiusY,
				},
				rotation: beamRotation,
				fill: 'white',
				listening: false,
			});
			
			//Utils.computeResampledPreview(drawStage, imageCopy, probe, rows, cols, baseGridRect);
			
			Utils.repeatDrawOnGrid(drawLayer, baseGridRect, probe, rows, cols);
			imageCopy.globalCompositeOperation('source-in');
			drawLayer.add(imageCopy);

			// Not needed
			// drawStage.draw();
		}
		else 
		{
			// otherwise only the image needs to updated by size & position
			imageCopy.x(originalImage.x());
			imageCopy.y(originalImage.y());
			imageCopy.scaleX(originalImage.scaleX());
			imageCopy.scaleY(originalImage.scaleY());
		}
	};

	// run once immediately
	updateProbeLayoutSampling();

	return updateProbeLayoutSampling;
}

/**
 * Draws the sampled subregion.
 * @param {*} sourceStage The source stage to sample from
 * @param {*} destStage The stage to draw on
 * @param {*} originalImage the subregion image to sample or 'stencil' over.
 * @param {*} spotScale an object to query for the spot scale X/Y.
 * @param {*} sBeam the beam to sample with (cloned and scaled)
 * @returns an update function to call when a redraw is needed
 */
function drawResampled(sourceStage, destStage, originalImage, spotScale, sBeam) {
	var baseImage = originalImage; //.clone();
	var beam = sBeam; //.clone();

	var baseGridRect = new Konva.Rect(baseImage.getSelfRect());

	var rows = 0, cols = 0;
	var probe = null;

	var changeCount = 0, lastChange = 0;

	var updateConfigValues = function(){
		rows = Utils.getRowsInput();
		cols = Utils.getColsInput();

		probe = new Konva.Ellipse({
			radius : {
				x : (beam.width() / spotScale.scaleX()) / 2,
				y : (beam.height() / spotScale.scaleY()) / 2
			},
			rotation: beam.rotation(),
			fill: 'white',
			listening: false,
		});

		// update it globally, so we can limit zoom in Spot Content, based on this
		G_BEAMRADIUS_SUBREGION_PX = {x:probe.radiusX()*2, y:probe.radiusY()*2};

		// manage layers to allow for multilayer draw as needed for row-by-row drawing
		// guarantee at least one layer
		var layers = destStage.getLayers();
		if (layers.length < 1) { destStage.add(new Konva.Layer({ listening: false })); }

		// TODO: display pixel size in physical units and use Utils.formatUnitNm()

		changeCount++;
	};
	
	var currentRow = 0;

	function doUpdate(){
		var layers = destStage.getLayers();

		if (rows*cols > G_AUTO_PREVIEW_LIMIT) {
			// do row-by-row draw
			// otherwise, the app gets unresponsive since a frame may take too long to draw.

			if (!G_VSEM_PAUSED) {
				var row = currentRow++;

				if (currentRow >= rows) {
					currentRow = 0;
					var layer = new Konva.Layer({ listening: false });
					destStage.add(layer);
				}
		
				if (layers.length > 2) { layers[0].destroy(); }
				
				Utils.computeResampledSlow(sourceStage, destStage, baseImage, probe, rows, cols, baseGridRect
					,row,row+1,0,-1,false,true);
			}
		} else {
			// do frame-by-frame draw
			if (changeCount > lastChange) {
				// reset change counts instead of recording it,
				// a trick to avoid an integer rollover, yet still functional.
				lastChange = changeCount = 0;

				// ensure we only use one layer
				// prevents any left over partially draw layers on top coming from the row-by-row draw
				if (layers.length > 1) {
					destStage.destroyChildren();
					destStage.add(new Konva.Layer({ listening: false }));
				}

				// Utils.computeResampledFast(sourceStage, destStage, baseImage, probe, rows, cols);
				// Utils.computeResampledSlow(sourceStage, destStage, baseImage, probe, rows, cols, baseGridRect);
				Utils.computeResampledSlow(sourceStage, destStage, baseImage, probe, rows, cols, baseGridRect
					,0,-1,0,-1,true,false);
			}
		}

		// not needed
		// destStage.draw()
		
		G_SubResampled_animationFrameRequestId = requestAnimationFrame(doUpdate);
	}

	// run once immediately
	updateConfigValues();

	cancelAnimationFrame(G_SubResampled_animationFrameRequestId);
	G_SubResampled_animationFrameRequestId = requestAnimationFrame(doUpdate);

	return updateConfigValues;
}

/**
 * Draws the ground truth image and the subregion bounds overlay.
 * @param {*} stage the stage to draw on.
 * @param {*} imageObj the original/full-size image to draw
 * @param {*} subregionImage the subregion image (to get the bounds from)
 * @param {number} maxSize (to be removed) the maximum size (width or height) of the stage to fit the image?
 * @returns an object with an update function to call for needed redraws and the subregion bounds.
 * @todo remove maxSize if possible?
 * @todo do we really need to return the subregioRect as well?
 */
function drawGroundtruthImage(stage, imageObj, subregionImage, maxSize=G_BOX_SIZE){

	var fit = Utils.fitImageProportions(imageObj.naturalWidth, imageObj.naturalHeight, maxSize);

	var layer = stage.getLayers()[0];
	layer.destroyChildren(); // avoid memory leaks

	// TODO: this shouldnt be need or it at least duplicate with
	// part of drawSubregionImage()
	var image = new Konva.Image({
		x: (maxSize - fit.w)/2,
		y: (maxSize - fit.h)/2,
		image: imageObj,
		width: fit.w,
		height: fit.h,
		listening: false,
	});

	var rect = new Konva.Rect({
		x: image.x(),
		y: image.y(),
		width: image.width(),
		height: image.height(),
		fill: "rgba(0,255,255,0.4)",
		stroke: "#00FFFF",
		strokeWidth: 1,
		listening: false,
		strokeScaleEnabled: false,
	});

	layer.add(image);
	layer.add(rect);

	var update = function(){
		// calc location rect from subregionImage
		// and update bounds drawn rectangle
		var si = subregionImage;
		rect.position({
			x: (image.x() - si.x()) / si.scaleX(),
			y: (image.y() - si.y()) / si.scaleY(),
		});
		rect.size({
			width: si.width() / si.scaleX(),
			height: si.height() / si.scaleY(),
		});

		// subregion overlay visibility
		rect.visible(G_SHOW_SUBREGION_OVERLAY);

		stage.draw();

		// center of the rect coords
		var center = {
			x: rect.x() + rect.width()/2,
			y: rect.y() + rect.height()/2,
		};

		// transform to unit square coords
		var unitCoords = Utils.stageToUnitCoordinates(center.x, center.y, stage);

		// scale to original image pixel size
		var pxImgCoords = Utils.unitToImagePixelCoordinates(unitCoords.x, unitCoords.y, imageObj);

		var pxSizeNm = Utils.getPixelSizeNmInput();

		// scale as real physical units
		var middle = Utils.imagePixelToRealCoordinates(pxImgCoords.x, pxImgCoords.y, pxSizeNm);

		// get as optimal displayUnit
		var fmtMiddle = Utils.formatUnitNm(middle.x, middle.y);

		var sizeFOV = {
			w: (rect.width() / stage.width()) * imageObj.width * pxSizeNm,
		};
		var fmtSizeFOV = Utils.formatUnitNm(sizeFOV.w);

		// display coords & FOV size
		Utils.updateExtraInfo(stage, '('
			+ fmtMiddle.value.toFixed(G_MATH_TOFIXED.SHORT) + ', '
			+ fmtMiddle.value2.toFixed(G_MATH_TOFIXED.SHORT) + ')'
			+ ' ' + fmtMiddle.unit
			+ '<br>FOV width: ' + fmtSizeFOV.value.toFixed(G_MATH_TOFIXED.SHORT)
			+ ' ' + fmtSizeFOV.unit
		);
	};

	update();
	stage.draw();

	return {
		updateFunc: update,
		subregionRect: rect
	};
}

/**
 * Draws the resulting image continously row-by-row.
 * @param {*} stage the stage to draw on
 * @param {*} beam the beam to sample with
 * @param {*} subregionRect the bounds on the subregion
 * @param {*} subregionRectStage the stage for the gorund truth
 * @param {*} originalImageObj the ground truth image
 * @param {*} spotScale an object to query for the spot scale X/Y.
 * @returns an update function to call when the spot profile or the cell/pixel size changes.
 * @todo do we really need both subregionRect and subregionRectStage as
 * separate parameters? maybe the info needed can be obtained with less
 * or more cleanly?
 * @todo rename confusing subregionRectStage to groundTruthStage?
 * @todo can we get rid userScaleImage / userImage throughout the source if possible, cleaner?
 */
function drawVirtualSEM(stage, beam, subregionRect, subregionRectStage, originalImageObj, spotScale){
	var rows = 0, cols = 0;
	var cellW = 0, cellH = 0;
	var currentRow = 0;

	const indicatorWidth = 20;
	const indicatorHeight = 3;

	var pixelCount = 0;

	var currentDrawPass = 0;

	// use the canvas API directly in a konva stage
	// https://konvajs.org/docs/sandbox/Free_Drawing.html

	var layer = stage.getLayers()[0];
	layer.destroyChildren(); // avoid memory leaks
	
	var canvas = document.createElement('canvas');
	canvas.width = stage.width();
	canvas.height = stage.height();

	// the canvas is added to the layer as a "Konva.Image" element
	var image = new Konva.Image({
		image: canvas,
		x: 0,
		y: 0,
	});
	layer.add(image);

	// draw an indicator to show which row was last drawn
	var indicator = new Konva.Rect({
		x: stage.width() - indicatorWidth, y: 0,
		width: indicatorWidth,
		height: indicatorHeight,
		fill: 'red',
	});
	layer.add(indicator);

	var context = canvas.getContext('2d');
	context.imageSmoothingEnabled = false;

	var beamRadius = {x : 0, y: 0};

	var superScale = 1;

	// original image size
	var iw = originalImageObj.naturalWidth, ih = originalImageObj.naturalHeight;
	// get scale factor for full image size
	var irw = (iw / stage.width()), irh = (ih / stage.height());

	var updateConfigValues = function(){
		var ratioX = subregionRectStage.width() / subregionRect.width();
		var ratioY = subregionRectStage.height() / subregionRect.height();

		// multiply by the ratio, since we should have more cells on the full image
		rows = Math.round(Utils.getRowsInput() * ratioY);
		cols = Math.round(Utils.getColsInput() * ratioX);

		// the total number of "pixels" (cells) that will drawn
		pixelCount = rows * cols;

		// save last value, to detect significant change
		var lastCellW = cellW, lastCellH = cellH;

		cellW = stage.width() / cols;
		cellH = stage.height() / rows;

		var significantChange = (cellW != lastCellW) && (cellH != lastCellH);

		// get beam size based on user-scaled image
		beamRadius = {
			// divide by the ratio, since the spot should be smaller when mapped onto
			// the full image which is scaled down to the same stage size...
			x : (beam.width() / spotScale.scaleX()) / 2 / ratioX,
			y : (beam.height() / spotScale.scaleY()) / 2 / ratioY
		};

		// check if we need to scale up the image for sampling...
		// if the avg spot radius is less than 1, scale up at 1 / x (inversely proportional)
		var radiusAvg = (beamRadius.x+beamRadius.y)/2;
		superScale = (radiusAvg < 1) ? 1 / radiusAvg : 1;

		// we can clear the screen here, if we want to avoid lines from previous configs...
		if (significantChange) { // if it affects the drawing
			context.clearRect(0, 0, canvas.width, canvas.height);
			currentRow = 0; // restart drawing from the top
			currentDrawPass = 0;
		}

		// display image size / pixel counts and the pixel size
		var fullImgWidthNm = iw * Utils.getPixelSizeNmInput();
		var fmtPxSize = Utils.formatUnitNm(
			fullImgWidthNm / cols,
			fullImgWidthNm / rows,
		);
		var displayUnit = fmtPxSize.unit + "/px";
		Utils.updateExtraInfo(stage, cols + ' x ' + rows
			+ ' px<br>' + fmtPxSize.value.toFixed(G_MATH_TOFIXED.SHORT)
			+ " x " + fmtPxSize.value2.toFixed(G_MATH_TOFIXED.SHORT)
			+ " " + displayUnit);
	};
	updateConfigValues();

	// var colors = ['blue', 'yellow', 'red', 'green', 'cyan', 'pink'];
	var colors = ['#DDDDDD','#EEEEEE','#CCCCCC','#999999','#666666','#333333','#B6B6B6','#1A1A1A'];
	var color = colors[Utils.getRandomInt(colors.length)];

	var doUpdate = function(){
		if (!G_VSEM_PAUSED) {
			// track time to draw the row
			var timeRowStart = Date.now();

			var row = currentRow++;
			var ctx = context;

			if (currentRow >= rows) {
				currentRow = 0;
				currentDrawPass += 1;
			}

			var rowIntensitySum = 0;

			// interate over X
			for (let i = 0; i < cols; i++) {
				const cellX = i * cellW;
				const cellY = row * cellH;

				// TODO: check these values and the Utils.ComputeProbeValue_gs again
				// since the final image seems to differ...

				// map/transform values to full resolution image coordinates
				const scaledProbe = {
					centerX: (cellX + cellW/2) * irw,
					centerY: (cellY + cellH/2) * irh,
					rotationRad: Utils.toRadians(beam.rotation()),
					radiusX: beamRadius.x * irw,
					radiusY: beamRadius.y * irh,
				};

				// compute the pixel value, for the given spot/probe profile
				var gsValue = Utils.ComputeProbeValue_gs(originalImageObj, scaledProbe, superScale);
				color = 'rgba('+[gsValue,gsValue,gsValue].join(',')+',1)';

				ctx.fillStyle = color;

				rowIntensitySum += gsValue;

				// optionally, draw with overlap to reduce visual artifacts
				if ((currentDrawPass < G_DRAW_OVERLAP_PASSES)
				&& (G_DRAW_WITH_OVERLAP && pixelCount >= G_DRAW_OVERLAP_THRESHOLD)) {
					ctx.fillRect(
						cellX -G_DRAW_OVERLAP_PIXELS,
						cellY -G_DRAW_OVERLAP_PIXELS,
						cellW +G_DRAW_OVERLAP_PIXELS,
						cellH +G_DRAW_OVERLAP_PIXELS
					);
				} else {
					ctx.fillRect(cellX, cellY, cellW, cellH);
				}
			}

			// if the last drawn was essentially completely black
			// assume the spot size was too small or no signal
			// for 1-2 overlapped-draw passes...
			var rowIntensityAvg = rowIntensitySum / cols;
			if (rowIntensityAvg <= G_MIN_AVG_SIGNAL_VALUE) { // out of 255
				currentDrawPass = -1;
			}

			// move/update the indicator
			indicator.y((row+1) * cellH - indicator.height());

			layer.batchDraw();

			// use this for debugging, less heavy, draw random color rows
			// color = colors[Utils.getRandomInt(colors.length)];
			// updateConfigValues();

			var timeDrawTotal = Date.now() - timeRowStart;
			stage.getContainer().setAttribute('note', timeDrawTotal + " ms/Row");

			// update the image metric automatically a few times
			// so the score updates as parts of the images changes
			if (typeof G_update_ImgMetrics == "function") {
				// update it every quarter of the rows drawn
				let imgMetricUpdateTick = (currentRow % Math.floor(rows / 4) == 0) && (currentRow > 1);
				
				// or update if the draw-rate is fast (less than 50 ms/row)
				const rowTime = 50; //ms
				
				// and not an SSIM-based algorithm, since they are comparatively slow...
				var isSSIM = (Utils.getImageMetricAlgorithm()).indexOf('SSIM') >= 0;

				if ( (timeDrawTotal < rowTime && !isSSIM) || imgMetricUpdateTick) {
					G_update_ImgMetrics();
				}
			}
		}
		
		// see comment on using this instead of setInterval below
		G_VirtualSEM_animationFrameRequestId = requestAnimationFrame(doUpdate);
	};

	// a warning is logged with slow setTimeout or requestAnimationFrame callbacks
	// for each frame taking longer than ~60+ ms... resulting in hundreds/thousands,
	// possibly slowing down the browser over time...

	// ... read next comment block first, then come back to this one ...
	// This cancel is needed, otherwise subsequent calls will multiple rogue update functions
	// (going out of scope) running forever, but never allow itself to be garbage collected
	// because the execution never ends... A similar case would likely happen with timers
	// as well, e.g. self-calling setTimeout or setInterval...
	cancelAnimationFrame(G_VirtualSEM_animationFrameRequestId);

	// ... but we use requestAnimationFrame to let the browser determine what the
	// fastest possible ideal speed is.
	G_VirtualSEM_animationFrameRequestId = requestAnimationFrame(doUpdate);

	return updateConfigValues;
}
