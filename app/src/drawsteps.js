function drawBaseBeam(stage) {
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

	var layer = stage.getLayers()[0];
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
	});
	layer.listening(true);
	layer.add(tr);

	// make it (de)selectable
	// based on https://konvajs.org/docs/select_and_transform/Basic_demo.html
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
	container.tabIndex = 1;
	container.addEventListener('keydown', function(e) {
		// don't handle meta-key'd events for now...
		const metaPressed = e.shiftKey || e.ctrlKey || e.metaKey;
		if (metaPressed)
			return;

		switch (e.keyCode) {
			case 82: // 'r' key, reset beam shape
				beam.rotation(0);
				beam.scale({x:1, y:1});
				// update other beams based on this one
				// https://konvajs.org/docs/events/Fire_Events.html
				beam.fire('transform');
				break;
			
			case 27: // 'esc' key, deselect all
				tr.nodes([]);
				break;
		
			default: break;
		}
		e.preventDefault();
	});

	return beam;
}

function drawBaseImage(stage, oImg, size, doFill = false, updateCallback = null) {
	var max = size;

	if (G_DEBUG)
		console.log("img natural size:", oImg.naturalWidth, oImg.naturalHeight);
	
	var img_width = oImg.naturalWidth, img_height = oImg.naturalHeight;

	// image ratio to "fit" in canvas
	var fitSize = fitImageProportions(img_width, img_height, max, doFill);

	var kImage = new Konva.Image({
		x: (max - fitSize.w)/2,
		y: (max - fitSize.h)/2,
		image: oImg,
		width: fitSize.w, 
		height: fitSize.h,
		draggable: true,
	});

	var layer = stage.getLayers()[0];

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
	kImage.on('wheel', MakeZoomHandler(stage, kImage, function(e){
		// bounds check for zooming out
		constrainBounds();

		// callback here, e.g. doUpdate();
		doUpdate();
	}, 1.2, 1));

	layer.add(kImage);

	stage.draw();

	return kImage;
}

function drawBaseComposite(stage, sImage, sBeam, updateCallback) {
	var layer = stage.getLayers()[0];
	layer.listening(true);

	// Give yellow box border to indicate interactive
	$(stage.getContainer()).css('border-color','yellow')

	var beam = sBeam;//.clone();
	var image = sImage.clone();
	image.draggable(true);
	
	image.globalCompositeOperation(COMPOSITE_OP);

	layer.add(beam);
	layer.add(image);

	// "pre-zoom" a bit, and start with center position
	scaleOnCenter(stage, image, 1, 4);

	layer.draw();

	var doUpdate = function(){
		if (typeof updateCallback == 'function')
			return updateCallback();
	};

	// Events
	image.on('mouseup', function() { doUpdate(); });
	image.on('dragmove', function() { stage.draw(); });
	image.on('wheel', MakeZoomHandler(stage, image, function(e){
		doUpdate();
	}));

	return image;
}

function drawAvgCircle(sourceStage, destStage, sBeam) {
	var sourceLayer = sourceStage.getLayers()[0];
	var destLayer = destStage.getLayers()[0];

	var beam = sBeam; //.clone();

	var updateAvgCircle = function(){
		var pCtx = sourceLayer.getContext();
		var allPx = pCtx.getImageData(0, 0, pCtx.canvas.width, pCtx.canvas.height);
		// var avgPx = get_avg_pixel_rgba(allPx);
		var avgPx = get_avg_pixel_gs(allPx); avgPx = [avgPx,avgPx,avgPx,1];

		var avgCircle = null;
		if (destLayer.getChildren().length <= 0){
			avgCircle = beam;
			destLayer.add(avgCircle);
		} else {
			avgCircle = destLayer.getChildren()[0];
		}

		var avgColor = "rgba("+ avgPx.join(',') +")";
		avgCircle.stroke(avgColor);
		avgCircle.fill(avgColor);

		destStage.getContainer().setAttribute('note', avgColor);

		destLayer.draw();
	};

	// run once immediately
	updateAvgCircle();

	return updateAvgCircle;
}

function drawProbeLayout(drawStage, baseImage, userImage, beam) {
	// draws probe layout
	var layers = drawStage.getLayers();
	var baseLayer = layers[0];

	var baseGridRect = new Konva.Rect(baseImage.getSelfRect());
	
	var imageCopy = baseImage.clone();

	baseLayer.add(imageCopy);
	baseLayer.draw();

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
		imageCopy.draw();

		var tRows = getRowsInput();
		var tCols = getColsInput();
		
		// uncomment to draw grid only once
		gridDrawn = false; gridLayer.destroyChildren();

		// draw grid, based on rect
		if (!gridDrawn)
			drawGrid(gridLayer, baseGridRect, tRows, tCols);
		
		// clear the probe layer
		probesLayer.destroyChildren();

		var probe = new Konva.Ellipse({
			radius : {
				x : (beam.width() / userImage.scaleX()) / 2, //(cell.width/2) * .8,
				y : (beam.height() / userImage.scaleY()) / 2 //(cell.height/2) * .8
			},
			rotation: beam.rotation(),
			fill: 'rgba(255,0,0,.4)',
			strokeWidth: 1,
			stroke: 'red'
		});
		
		repeatDrawOnGrid(probesLayer, baseGridRect, probe, tRows, tCols);
	};

	// run once immediately
	updateProbeLayout();

	return {
		updateCallback: updateProbeLayout,
		image: imageCopy
	};
}

function drawProbeLayoutSampling(drawStage, originalImage, userImage, sBeam) {
	var baseImage = originalImage; //.clone();
	var beam = sBeam; //.clone();

	var baseGridRect = new Konva.Rect(baseImage.getSelfRect());

	var updateProbeLayoutSampling = function(){
		var rows = getRowsInput();
		var cols = getColsInput();

		var probe = new Konva.Ellipse({
			radius : {
				x : (beam.width() / userImage.scaleX()) / 2,
				y : (beam.height() / userImage.scaleY()) / 2
			},
			rotation: beam.rotation(),
			fill: 'white',
			listening: false,
		});

		computeResampledPreview(drawStage, baseImage, probe, rows, cols, baseGridRect);

		drawStage.draw();
	};

	// run once immediately
	updateProbeLayoutSampling();

	return updateProbeLayoutSampling;
}

function drawResampled(sourceStage, destStage, originalImage, userImage, sBeam) {
	var baseImage = originalImage; //.clone();
	var beam = sBeam; //.clone();

	var baseGridRect = new Konva.Rect(baseImage.getSelfRect());

	var updateResampledDraw = function(){
		var rows = getRowsInput();
		var cols = getColsInput();

		var probe = new Konva.Ellipse({
			radius : {
				x : (beam.width() / userImage.scaleX()) / 2,
				y : (beam.height() / userImage.scaleY()) / 2
			},
			rotation: beam.rotation(),
			fill: 'white',
			listening: false,
		});

		// computeResampledFast(sourceStage, destStage, baseImage, probe, rows, cols);
		computeResampledSlow(sourceStage, destStage, baseImage, probe, rows, cols, baseGridRect);

		destStage.draw();
	};

	// run once immediately
	updateResampledDraw();

	return updateResampledDraw;
}

function drawGroundtruthImage(stage, imageObj, subregionImage, maxSize=300){

	var fit = fitImageProportions(imageObj.naturalWidth, imageObj.naturalHeight, maxSize);

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
	});

	var layer = stage.getLayers()[0];
	layer.add(image);
	layer.add(rect)

	var update = function(){
		// calc location rect from subregionImage
		// and update bounds drawn rectangle
		var s = subregionImage;
		rect.position({
			x: (image.x() - s.x()) / s.scaleX(),
			y: (image.y() - s.y()) / s.scaleY(),
		});
		rect.size({
			width: s.width() / s.scaleX(),
			height: s.height() / s.scaleY(),
		});

		stage.draw();
	};

	update();
	stage.draw();

	return {
		updateFunc: update,
		subregionRect: rect
	};
}

function drawVirtualSEM(stage, beam, subregionRect, subregionRectStage, originalImageObj, userScaledImage){
	var rows = 0, cols = 0;
	var cellW = 0, cellH = 0;
	var currentRow = 0;

	var refreshDelay = 500;

	// use the canvas API directly in a konva stage
	// https://konvajs.org/docs/sandbox/Free_Drawing.html

	var layer = stage.getLayers()[0];
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
		x: stage.width() - 20, y: 0,
		width: 20,
		height: 3,
		fill: 'red',
	});
	layer.add(indicator);

	var context = canvas.getContext('2d');
	context.imageSmoothingEnabled = false;

	var beamRadius = {x : 0, y: 0};

	var updateConfigValues = function(){
		var ratioX = subregionRectStage.width() / subregionRect.width();
		var ratioY = subregionRectStage.height() / subregionRect.height();

		// multiply by the ratio, since we should have more cells on the full image
		rows = Math.round(getRowsInput() * ratioY);
		cols = Math.round(getColsInput() * ratioX);

		// save last value, to detect significant change
		var lastCellW = cellW, lastCellH = cellH;

		cellW = stage.width() / cols;
		cellH = stage.height() / rows;

		var significantChange = (cellW != lastCellW) && (cellH != lastCellH);

		// get beam size based on user-scaled image
		beamRadius = {
			// divide by the ratio, since the spot should be smaller when mapped onto
			// the full image which is scaled down to the same stage size...
			x : (beam.width() / userScaledImage.scaleX()) / 2 / ratioX,
			y : (beam.height() / userScaledImage.scaleY()) / 2 / ratioY
		};

		refreshDelay = getSEMRefreshDelay();

		// we can clear the screen here, if we want to avoid lines from previous configs...
		if (significantChange) { // if it affects the drawing
			context.clearRect(0, 0, canvas.width, canvas.height);
		}
	};
	updateConfigValues();

	// var colors = ['blue', 'yellow', 'red', 'green', 'cyan', 'pink'];
	var colors = ['#DDDDDD','#EEEEEE','#CCCCCC','#999999','#666666','#333333','#B6B6B6','#1A1A1A'];
	var color = colors[getRandomInt(colors.length)];

	// original image size
	var iw = originalImageObj.naturalWidth, ih = originalImageObj.naturalHeight;
	// get scale factor for full image size
	var irw = (iw / stage.width()), irh = (ih / stage.height());

	var doUpdate = function(){
		// track time to draw the row
		var timeRowStart = Date.now();

		var row = currentRow++;
		var ctx = context;

		if (currentRow >= rows)
			currentRow = 0;

		// interate over X
		for (let i = 0; i < cols; i++) {
			const cellX = i * cellW;
			const cellY = row * cellH;

			// TODO: check these values and the ComputeProbeValue_gs again
			// since the final image seems to differ...

			// map/transform values to full resolution image coordinates
			const scaledProbe = {
				centerX: (cellX + cellW/2) * irw,
				centerY: (cellY + cellH/2) * irh,
				rotationRad: toRadians(beam.rotation()),
				radiusX: beamRadius.x * irw,
				radiusY: beamRadius.y * irh,
			};

			// compute the pixel value, for the given spot/probe profile
			var gsValue = ComputeProbeValue_gs(originalImageObj, scaledProbe);
			color = 'rgba('+[gsValue,gsValue,gsValue].join(',')+',1)';

			ctx.fillStyle = color;
			ctx.fillRect(cellX, cellY, cellW, cellH);
		}

		// move/update the indicator
		indicator.y((row+1) * cellH - indicator.height());

		layer.batchDraw();

		// use this for debugging, less heavy, draw random color rows
		// color = colors[getRandomInt(colors.length)];
		// updateConfigValues();

		var timeDrawTotal = Date.now() - timeRowStart;
		stage.getContainer().setAttribute('note', timeDrawTotal + " ms/Row");
		
		// see comment on using this instead of setInterval below
		// setTimeout(doUpdate, refreshDelay);
		requestAnimationFrame(doUpdate);
	};

	//var updateLoop = setInterval(doUpdate, 500);
	// use setTimer instead, to adapt delay while running
	// https://stackoverflow.com/questions/1280263/changing-the-interval-of-setinterval-while-its-running
	// setTimeout(doUpdate, refreshDelay);
	requestAnimationFrame(doUpdate);

	return updateConfigValues;
}
