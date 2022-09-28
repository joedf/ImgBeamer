function drawBaseBeam(stage) {
	// create our shape
	var beam = new Konva.Circle({
		x: stage.width() / 2,
		y: stage.height() / 2,
		radius: 70,
		fill: 'white',
		strokeWidth: 0,
	});

	var layer = stages[0].getLayers()[0];
	layer.add(beam);
	layer.draw();

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

	var beam = sBeam.clone();
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

	var beam = sBeam.clone();

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

		destStage.getContainer().setAttribute('pixel_value', avgColor);

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
	var beam = sBeam.clone();

	var baseGridRect = new Konva.Rect(baseImage.getSelfRect());

	var updateProbeLayoutSampling = function(){
		var rows = getRowsInput();
		var cols = getColsInput();

		var probe = new Konva.Ellipse({
			radius : {
				x : (beam.width() / userImage.scaleX()) / 2,
				y : (beam.height() / userImage.scaleY()) / 2
			},
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
	var beam = sBeam.clone();

	var baseGridRect = new Konva.Rect(baseImage.getSelfRect());

	var updateResampledDraw = function(){
		var rows = getRowsInput();
		var cols = getColsInput();

		var probe = new Konva.Ellipse({
			radius : {
				x : (beam.width() / userImage.scaleX()) / 2,
				y : (beam.height() / userImage.scaleY()) / 2
			},
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
			x: (0 - s.x()) / s.scaleX(),
			y: (0 - s.y()) / s.scaleY(),
		});
		rect.size({
			width: s.width() / s.scaleX(),
			height: s.height() / s.scaleY(),
		});

		stage.draw();
	};

	update();
	stage.draw();

	return update;
}
